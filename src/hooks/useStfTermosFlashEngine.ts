/**
 * STF Termos Flash Engine v1.0
 *
 * Motor independente que faz busca direta no portal STF Digital
 * (digital.stf.jus.br/publico/publicacoes), espelhando a UX do DJEN Termos Flash.
 *
 * Padrão: singleton + checkpoint em localStorage + subscribe pattern.
 * Reutiliza `monitoramentos_djen` como fonte de termos (descrição/termo_busca,
 * exclusoes, condicao_concomitante, termos_or, coordenacao_id).
 *
 * Diferenças vs. DJEN Flash:
 *  - Não há tribunal: STF é único.
 *  - API retorna dados HTML enriquecidos (texto, processo, relator, tipo).
 *  - Validação por frase exata (reusa djenTermoMatch).
 *  - INSERT em `publicacoes_djen` com tribunal STF.
 */

import { supabase } from '@/integrations/supabase/client';
import { buscarTodasPaginasStf, type StfPublicacao } from '@/utils/stfDigitalClient';
import { conteudoContemFraseExata } from '@/utils/djenTermoMatch';

// ============================================================================
// TIPOS
// ============================================================================

export interface StfTermosFlashProgress {
  status: 'idle' | 'executando' | 'concluido' | 'cancelado' | 'erro';
  globalCurrent: number;
  globalTotal: number;
  percentage: number;
  diaAtualYmd: string | null;
  diaAtualIndice: number;
  totalDias: number;
  termoAtualNoDia: number;
  totalTermos: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  mensagem: string;
  termoAtual: string | null;
  tempoDecorrido: number;
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
  falhasBusca: number;
  ultimoErroBusca: string | null;
  chamadasApi: number;
  paginasBuscadas: number;
  runStartIso?: string | null;
  coordenacaoIdFiltro?: string | null;
  monitoramentoIdsFiltro?: string[] | null;
}

interface Monitoramento {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string | null;
  uf?: string | null;
  ativo: boolean;
  exclusoes?: string[] | null;
  termos_or?: string[] | null;
  descricao?: string | null;
  condicao_concomitante?: string | null;
  coordenacao_id?: string | null;
}

interface Checkpoint {
  runKey: string;
  diaIndice: number;
  termoIndice: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  tempoInicio: number;
  dataInicioYmd: string;
  dataFimYmd: string;
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  delay_between_terms: 1500,
  delay_between_pages: 800,
  max_pages_per_term: 30,
  page_size: 50,
};

const STORAGE_KEY = 'stf-termos-flash-checkpoint-v1';
const BR_TZ = 'America/Sao_Paulo';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// SINGLETON STATE
// ============================================================================

let state: {
  isRunning: boolean;
  progress: StfTermosFlashProgress;
  checkpoint: Checkpoint | null;
  abortController: AbortController | null;
  listeners: Set<(p: StfTermosFlashProgress) => void>;
  timerInterval: ReturnType<typeof setInterval> | null;
  executionId: string | null;
} = {
  isRunning: false,
  progress: createDefaultProgress(),
  checkpoint: null,
  abortController: null,
  listeners: new Set(),
  timerInterval: null,
  executionId: null,
};

function createDefaultProgress(): StfTermosFlashProgress {
  return {
    status: 'idle', globalCurrent: 0, globalTotal: 0, percentage: 0,
    diaAtualYmd: null, diaAtualIndice: 0, totalDias: 0,
    termoAtualNoDia: 0, totalTermos: 0,
    novas: 0, duplicadas: 0, descartadas: 0,
    mensagem: '', termoAtual: null, tempoDecorrido: 0,
    dataInicioYmd: null, dataFimYmd: null,
    falhasBusca: 0, ultimoErroBusca: null,
    chamadasApi: 0, paginasBuscadas: 0,
    runStartIso: null,
    coordenacaoIdFiltro: null,
    monitoramentoIdsFiltro: null,
  };
}

function notifyListeners() {
  for (const l of state.listeners) l(state.progress);
}

function updateProgress(partial: Partial<StfTermosFlashProgress>) {
  state.progress = { ...state.progress, ...partial };
  notifyListeners();
}

// ============================================================================
// HELPERS
// ============================================================================

function ymdBrasilia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
}

function gerarListaDatas(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  const d = new Date(`${inicio}T12:00:00`);
  const end = new Date(`${fim}T12:00:00`);
  while (d <= end) {
    datas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return datas;
}

function saveCheckpoint(cp: Checkpoint | null) {
  if (cp) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cp, savedAt: Date.now() }));
  else localStorage.removeItem(STORAGE_KEY);
  state.checkpoint = cp;
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function gerarHash(textoLimpo: string, processo: string): string {
  const proc = (processo || '').replace(/\D/g, '');
  const key = `${proc}|${textoLimpo}`.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 800);
  let h1 = 0, h2 = 0x9e3779b9;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = ((h1 << 5) - h1) + c; h1 = h1 & h1;
    h2 = ((h2 << 7) ^ h2) + c; h2 = h2 & h2;
  }
  return Math.abs(h1).toString(16) + Math.abs(h2).toString(16);
}

function nextBusinessDateYmd(dateLike: string | null): string {
  const base = String(dateLike || ymdBrasilia()).slice(0, 10);
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dataDisponibilizacaoStf(s: any, fallbackYmd: string): string {
  const parsed = parseDataBR(s);
  const ymd = parsed ? parsed.slice(0, 10) : fallbackYmd;
  return `${ymd}T15:00:00.000Z`;
}

function parseDataBR(s: any): string | null {
  if (!s) return null;
  if (typeof s === 'number') return new Date(s).toISOString();
  const str = String(s).trim();
  // Formato BR: "DD/MM/YYYY" ou "DD/MM/YYYY HH:MM"
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yy, hh = '12', mi = '00'] = m;
    return `${yy}-${mm}-${dd}T${hh}:${mi}:00.000Z`;
  }
  // ISO
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

// ============================================================================
// VALIDAÇÃO LOCAL (frase exata + exclusões + condição concomitante)
// ============================================================================

function validarPublicacao(pub: StfPublicacao, mon: Monitoramento, textoLimpo: string): { valida: boolean; motivo?: string } {
  // 1) Termo principal: frase exata (suporte a "+" como AND)
  const termo = mon.termo_busca?.trim() || '';
  if (!termo) return { valida: false, motivo: 'termo vazio' };

  const partesAnd = termo.includes('+')
    ? termo.split('+').map((p) => p.trim()).filter((p) => p && !/^OAB\s/i.test(p))
    : [termo];

  const todasPresentes = partesAnd.every((parte) => conteudoContemFraseExata(textoLimpo, parte));

  // termos_or: aceita match alternativo
  let matchOr = false;
  if (!todasPresentes && Array.isArray(mon.termos_or) && mon.termos_or.length > 0) {
    for (const raw of mon.termos_or) {
      const t = String(raw || '').trim();
      if (!t) continue;
      // Limpeza simples para "OAB/NOME" → NOME
      const limpo = t.replace(/^\d{3,6}\s*\/\s*/, '').replace(/^.+?\s*\/\s*\d{3,6}$/, (m) => m.replace(/\s*\/\s*\d{3,6}$/, ''));
      if (conteudoContemFraseExata(textoLimpo, limpo)) { matchOr = true; break; }
    }
  }

  if (!todasPresentes && !matchOr) {
    return { valida: false, motivo: 'termo principal não encontrado' };
  }

  // 2) Exclusões: se qualquer exclusão aparecer, descarta
  if (Array.isArray(mon.exclusoes) && mon.exclusoes.length > 0) {
    for (const exc of mon.exclusoes) {
      const e = String(exc || '').trim();
      if (e && conteudoContemFraseExata(textoLimpo, e)) {
        return { valida: false, motivo: `exclusão: "${e}"` };
      }
    }
  }

  // 3) Condição concomitante: OR de grupos AND separados por "|"
  if (mon.condicao_concomitante && mon.condicao_concomitante.trim()) {
    const grupos = mon.condicao_concomitante.split('|').map((g) => g.trim()).filter(Boolean);
    if (grupos.length > 0) {
      const algumGrupo = grupos.some((grupo) => {
        const tokens = grupo.split(',').map((t) => t.trim()).filter(Boolean);
        return tokens.length === 0 || tokens.every((t) => conteudoContemFraseExata(textoLimpo, t));
      });
      if (!algumGrupo) return { valida: false, motivo: 'condição concomitante não atendida' };
    }
  }

  return { valida: true };
}

// ============================================================================
// PROCESSAMENTO DE UM TERMO
// ============================================================================

interface TermoResult {
  novas: number;
  duplicadas: number;
  descartadas: number;
  falhasBusca: number;
  ultimoErroBusca: string | null;
  chamadasApi: number;
  paginasBuscadas: number;
}

function emptyResult(): TermoResult {
  return {
    novas: 0, duplicadas: 0, descartadas: 0,
    falhasBusca: 0, ultimoErroBusca: null,
    chamadasApi: 0, paginasBuscadas: 0,
  };
}

async function processarTermo(mon: Monitoramento, diaYmd: string, signal: AbortSignal): Promise<TermoResult> {
  if (signal.aborted) return emptyResult();

  const result = emptyResult();

  // Pega o termo "amplo" para mandar à API STF (a validação local depois confirma)
  const termoApi = (mon.termo_busca || '').trim();
  if (!termoApi) return result;

  let publicacoes: StfPublicacao[] = [];
  try {
    const resp = await buscarTodasPaginasStf(
      {
        termo: termoApi,
        dataInicio: diaYmd,
        dataFim: diaYmd,
        quantidade: CONFIG.page_size,
        signal,
      },
      {
        delayMs: CONFIG.delay_between_pages,
        maxPages: CONFIG.max_pages_per_term,
      },
    );
    publicacoes = resp.publicacoes;
    result.paginasBuscadas = resp.pagesFetched;
    result.chamadasApi = resp.pagesFetched;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    result.falhasBusca = 1;
    result.ultimoErroBusca = e?.message || 'Falha de busca STF';
    console.warn(`[STF Flash] Falha em "${termoApi}" (${diaYmd}):`, e?.message);
    return result;
  }

  if (publicacoes.length === 0) return result;

  // Validar + preparar payloads
  const payloads: any[] = [];
  const seenHash = new Set<string>();

  for (const pub of publicacoes) {
    if (signal.aborted) break;

    const textoHtml = String(pub.texto || '');
    const textoLimpo = stripHtml(textoHtml);
    const processo = String(pub.processo || '').trim();

    const validacao = validarPublicacao(pub, mon, `${textoLimpo} ${processo}`);
    if (!validacao.valida) {
      result.descartadas += 1;
      continue;
    }

    const idDjen = pub.id != null ? `stf:${String(pub.id)}` : null;
    const dataDisponibilizacao = dataDisponibilizacaoStf(pub.divulgacao, diaYmd);
    const dataPublicacao = parseDataBR(pub.publicacao) || `${nextBusinessDateYmd(dataDisponibilizacao)}T15:00:00.000Z`;
    const hash = gerarHash(`${idDjen || ''}|${dataDisponibilizacao}|${textoLimpo.slice(0, 600)}`, processo);
    if (seenHash.has(hash)) {
      result.duplicadas += 1;
      continue;
    }
    seenHash.add(hash);

    payloads.push({
      monitoramento_id: mon.id,
      coordenacao_id: mon.coordenacao_id ?? null,
      id_djen: idDjen,
      processo_numero: processo || null,
      tipo_publicacao: 'intimacao',
      tribunal: 'STF',
      orgao: pub.relator || null,
      tipo_comunicacao: pub.tipo || null,
      meio: 'D',
      data_disponibilizacao: dataDisponibilizacao,
      data_publicacao: dataPublicacao,
      conteudo: textoLimpo.slice(0, 200_000),
      hash_conteudo: hash,
      fonte: 'stf_digital',
      lida: false,
    });
  }

  if (payloads.length === 0) return result;

  let inseridas = 0;
  for (const payload of payloads) {
    if (payload.id_djen) {
      let existingQuery: any = supabase
        .from('publicacoes_djen')
        .select('id')
        .eq('id_djen', payload.id_djen);
      existingQuery = payload.coordenacao_id
        ? existingQuery.eq('coordenacao_id', payload.coordenacao_id)
        : existingQuery.is('coordenacao_id', null);
      const { data: existing } = await existingQuery.maybeSingle();
      if (existing?.id) {
        result.duplicadas += 1;
        continue;
      }
    }

    const { data, error } = await supabase
      .from('publicacoes_djen')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      const msg = error.message || '';
      if (error.code === '23505' || msg.includes('duplicate')) {
        result.duplicadas += 1;
        continue;
      }
      console.error(`[STF Flash] Erro ao salvar publicação para "${mon.termo_busca}":`, error);
      result.falhasBusca += 1;
      result.ultimoErroBusca = error.message;
      continue;
    }
    if (data?.id) inseridas += 1;
  }

  result.novas = inseridas;
  return result;
}

// ============================================================================
// EXECUÇÃO PRINCIPAL
// ============================================================================

async function executarLoop(
  dataInicioYmd: string,
  dataFimYmd: string,
  retomar: boolean,
  coordenacaoId?: string,
  monitoramentoIds?: string[],
) {
  if (state.isRunning) {
    console.warn('[STF Flash] Já existe execução em andamento');
    return;
  }

  state.isRunning = true;
  state.abortController = new AbortController();
  const signal = state.abortController.signal;
  const tempoInicio = Date.now();
  let executionId: string | null = null;

  state.timerInterval = setInterval(() => {
    updateProgress({ tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000) });
  }, 1000);

  try {
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .neq('somente_kurier', true);

    if (coordenacaoId) query = query.eq('coordenacao_id', coordenacaoId);
    if (monitoramentoIds?.length) query = query.in('id', monitoramentoIds);

    const { data: termos, error } = await query;
    if (error) throw error;

    if (!termos?.length) {
      updateProgress({
        status: 'erro',
        mensagem: 'Nenhum monitoramento ativo encontrado para o filtro selecionado.',
        percentage: 0,
      });
      return;
    }

    const monitoramentos: Monitoramento[] = termos.map((t: any) => ({
      id: t.id, tipo: t.tipo, termo_busca: t.termo_busca,
      oab: t.oab, uf: t.uf, ativo: t.ativo,
      exclusoes: t.exclusoes, termos_or: t.termos_or,
      descricao: t.descricao,
      condicao_concomitante: t.condicao_concomitante,
      coordenacao_id: t.coordenacao_id,
    }));

    const datas = gerarListaDatas(dataInicioYmd, dataFimYmd);
    const totalOps = datas.length * monitoramentos.length;

    if (totalOps <= 0) {
      updateProgress({ status: 'erro', mensagem: 'Período inválido.', percentage: 0 });
      return;
    }

    const cp = retomar ? loadCheckpoint() : null;
    const runKey = `${dataInicioYmd}..${dataFimYmd}`;
    let startDiaIdx = 0;
    let startTermoIdx = 0;
    let acumNovas = 0, acumDup = 0, acumDesc = 0, acumFalhas = 0;
    let acumChamadas = 0, acumPaginas = 0;

    if (cp && cp.runKey === runKey) {
      startDiaIdx = cp.diaIndice;
      startTermoIdx = cp.termoIndice;
      acumNovas = cp.novas;
      acumDup = cp.duplicadas;
      acumDesc = cp.descartadas;
    }

    // Registrar execução no banco
    try {
      const { data: inserted } = await supabase
        .from('execucoes_agendadas')
        .insert({
          tipo: 'stf_flash',
          status: 'executando',
          job_name: 'STF Termos Flash',
          iniciado_em: new Date().toISOString(),
          detalhes: { totalTermos: monitoramentos.length, totalDias: datas.length, dataInicioYmd, dataFimYmd },
        })
        .select('id');
      if (inserted && inserted.length > 0) {
        executionId = inserted[0].id;
        state.executionId = executionId;
      }
    } catch (e) {
      console.warn('[STF Flash] Falha ao registrar execução no banco:', e);
    }

    updateProgress({
      status: 'executando',
      globalTotal: totalOps,
      totalDias: datas.length,
      totalTermos: monitoramentos.length,
      dataInicioYmd, dataFimYmd,
      novas: acumNovas, duplicadas: acumDup, descartadas: acumDesc,
      falhasBusca: acumFalhas, ultimoErroBusca: null,
      chamadasApi: acumChamadas, paginasBuscadas: acumPaginas,
      mensagem: 'Iniciando STF Termos Flash...',
      runStartIso: new Date(tempoInicio).toISOString(),
      coordenacaoIdFiltro: coordenacaoId ?? null,
      monitoramentoIdsFiltro: monitoramentoIds ?? null,
    });

    for (let diaIdx = startDiaIdx; diaIdx < datas.length; diaIdx++) {
      if (signal.aborted) break;
      const diaYmd = datas[diaIdx];
      const termoStart = diaIdx === startDiaIdx ? startTermoIdx : 0;

      for (let termoIdx = termoStart; termoIdx < monitoramentos.length; termoIdx++) {
        if (signal.aborted) break;
        const mon = monitoramentos[termoIdx];
        const completedBefore = diaIdx * monitoramentos.length + termoIdx;
        const globalCurrent = completedBefore + 1;
        const pctBefore = Math.min(99, Math.round((completedBefore / totalOps) * 100));

        updateProgress({
          diaAtualYmd: diaYmd,
          diaAtualIndice: diaIdx + 1,
          termoAtualNoDia: termoIdx + 1,
          termoAtual: mon.descricao || mon.termo_busca,
          globalCurrent: completedBefore,
          percentage: pctBefore,
          mensagem: `[${diaYmd}] ${mon.descricao || mon.termo_busca}`,
        });

        saveCheckpoint({
          runKey, diaIndice: diaIdx, termoIndice: termoIdx,
          novas: acumNovas, duplicadas: acumDup, descartadas: acumDesc,
          tempoInicio, dataInicioYmd, dataFimYmd,
        });

        const r = await processarTermo(mon, diaYmd, signal);
        acumNovas += r.novas;
        acumDup += r.duplicadas;
        acumDesc += r.descartadas;
        acumFalhas += r.falhasBusca;
        acumChamadas += r.chamadasApi;
        acumPaginas += r.paginasBuscadas;

        const pctAfter = Math.min(99, Math.round((globalCurrent / totalOps) * 100));
        updateProgress({
          globalCurrent,
          percentage: pctAfter,
          novas: acumNovas, duplicadas: acumDup, descartadas: acumDesc,
          falhasBusca: acumFalhas,
          ultimoErroBusca: r.ultimoErroBusca ?? state.progress.ultimoErroBusca,
          chamadasApi: acumChamadas, paginasBuscadas: acumPaginas,
        });

        saveCheckpoint({
          runKey, diaIndice: diaIdx, termoIndice: termoIdx + 1,
          novas: acumNovas, duplicadas: acumDup, descartadas: acumDesc,
          tempoInicio, dataInicioYmd, dataFimYmd,
        });

        await delay(CONFIG.delay_between_terms);
      }
    }

    if (!signal.aborted) {
      saveCheckpoint(null);
      updateProgress({
        status: 'concluido',
        percentage: 100,
        globalCurrent: totalOps,
        mensagem: `Concluído! ${acumNovas} novas, ${acumDup} duplicadas, ${acumDesc} descartadas` +
          ` • API: ${acumChamadas} chamadas em ${acumPaginas} páginas` +
          (acumFalhas ? ` • falhas: ${acumFalhas}` : ''),
      });
    } else {
      updateProgress({ status: 'cancelado', mensagem: 'Execução cancelada' });
    }
  } catch (err: any) {
    console.error('[STF Flash] Erro:', err);
    updateProgress({ status: 'erro', mensagem: `Erro: ${err?.message || String(err)}` });
  } finally {
    state.isRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (executionId) {
      try {
        const finalStatus = state.progress.status === 'erro' ? 'erro' : (state.progress.status === 'cancelado' ? 'cancelado' : 'concluido');
        await supabase
          .from('execucoes_agendadas')
          .update({
            status: finalStatus,
            finalizado_em: new Date().toISOString(),
            detalhes: {
              novas: state.progress.novas,
              duplicadas: state.progress.duplicadas,
              descartadas: state.progress.descartadas,
              percentage: state.progress.percentage,
              mensagem: state.progress.mensagem,
              dataInicioYmd, dataFimYmd,
            },
          })
          .eq('id', executionId);
      } catch (e) {
        console.warn('[STF Flash] Erro ao finalizar execução no banco:', e);
      }
      state.executionId = null;
    }
    if (state.progress.status === 'executando') {
      state.progress = { ...state.progress, status: 'concluido' };
    }
    notifyListeners();
  }
}

// ============================================================================
// API PÚBLICA (singleton)
// ============================================================================

export function executarStfTermosFlash(
  dataInicioYmd?: string,
  dataFimYmd?: string,
  retomar = false,
  coordenacaoId?: string,
  monitoramentoIds?: string[],
) {
  const hoje = ymdBrasilia();
  const inicio = dataInicioYmd || hoje;
  const fim = dataFimYmd || hoje;
  executarLoop(inicio, fim, retomar, coordenacaoId, monitoramentoIds);
}

export function cancelarStfTermosFlash() {
  if (state.abortController) {
    state.abortController.abort();
    updateProgress({ status: 'cancelado', mensagem: 'Cancelando...' });
  }
  supabase
    .from('execucoes_agendadas')
    .update({
      status: 'cancelado',
      finalizado_em: new Date().toISOString(),
      detalhes: { mensagem: 'Cancelado pelo usuário' },
    })
    .eq('tipo', 'stf_flash')
    .eq('status', 'executando')
    .then(() => {});
  state.executionId = null;
}

export function limparEstadoStfTermosFlash() {
  state.progress = createDefaultProgress();
  notifyListeners();
}

export function forceKillStfTermosFlash(clearCheckpoint = false) {
  cancelarStfTermosFlash();
  state.isRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (clearCheckpoint) saveCheckpoint(null);
  state.progress = createDefaultProgress();
  notifyListeners();
}

export function getStfTermosFlashProgress(): StfTermosFlashProgress {
  return state.progress;
}

export function isStfTermosFlashRunning(): boolean {
  return state.isRunning;
}

export function getCheckpointStfFlash(): Checkpoint | null {
  return state.checkpoint || loadCheckpoint();
}

export function subscribeStfTermosFlash(listener: (p: StfTermosFlashProgress) => void): () => void {
  state.listeners.add(listener);
  return () => { state.listeners.delete(listener); };
}