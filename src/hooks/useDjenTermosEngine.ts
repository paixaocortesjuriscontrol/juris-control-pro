/**
 * DJEN Termos Engine v2.0
 * 
 * Arquitetura singleton com execução em background:
 * - Continua rodando mesmo ao sair da tela
 * - 1 dia completo antes de avançar para o próximo
 * - Progresso global + indicador do dia atual
 * - Retomada somente manual (sem auto-restart)
 * 
 * REGRAS:
 * 1. Apenas uma execução ativa por vez (singleton)
 * 2. Cada dia é processado completamente antes do próximo
 * 3. Checkpoints salvos após cada termo para retomada exata
 * 4. Totalizadores são globais (soma de todos os dias)
 */

import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaPaginado } from "@/utils/pjeComunicaClient";

// ============================================================================
// TIPOS
// ============================================================================

export interface DjenTermosProgress {
  status: 'idle' | 'executando' | 'concluido' | 'cancelado' | 'erro';
  
  // Progresso global
  globalCurrent: number;     // termos processados no total (todos os dias)
  globalTotal: number;       // total de termos × dias
  percentage: number;        // % global
  
  // Indicador do dia atual
  diaAtualYmd: string | null;
  diaAtualIndice: number;    // 1-based
  totalDias: number;
  termoAtualNoDia: number;   // índice do termo no dia (1-based)
  totalTermos: number;       // total de termos (por dia)
  
  // Estatísticas acumuladas
  novas: number;
  duplicadas: number;
  descartadas: number;
  
  // UI
  mensagem: string;
  termoAtual: string | null;
  tempoDecorrido: number;
  
  // Intervalo de busca
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
}

interface Checkpoint {
  runKey: string;            // identificador único da execução (dataFim)
  diaIndice: number;         // índice do dia (0-based)
  termoIndice: number;       // índice do termo (0-based)
  novas: number;
  duplicadas: number;
  descartadas: number;
  tempoInicio: number;
  dataInicioYmd: string;
  dataFimYmd: string;
}

interface Monitoramento {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string;
  uf?: string;
  ativo: boolean;
  exclusoes?: string[];
  tribunais?: string[];
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  delay_between_terms: 4000,     // 4s entre termos
  delay_between_tribunals: 3000, // 3s entre tribunais
  delay_between_variants: 1000,  // 1s entre variantes
  delay_on_rate_limit: 15000,    // 15s no rate limit
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// SINGLETON STATE (persiste mesmo saindo da tela)
// ============================================================================

let singletonState: {
  isRunning: boolean;
  progress: DjenTermosProgress;
  checkpoint: Checkpoint | null;
  abortController: AbortController | null;
  executionId: string | null;
  listeners: Set<(p: DjenTermosProgress) => void>;
  timerInterval: ReturnType<typeof setInterval> | null;
} = {
  isRunning: false,
  progress: createDefaultProgress(),
  checkpoint: null,
  abortController: null,
  executionId: null,
  listeners: new Set(),
  timerInterval: null,
};

const STORAGE_KEY = 'djen-termos-checkpoint-v2';
const BR_TZ = 'America/Sao_Paulo';

// ============================================================================
// HELPERS
// ============================================================================

function createDefaultProgress(): DjenTermosProgress {
  return {
    status: 'idle',
    globalCurrent: 0,
    globalTotal: 0,
    percentage: 0,
    diaAtualYmd: null,
    diaAtualIndice: 0,
    totalDias: 0,
    termoAtualNoDia: 0,
    totalTermos: 0,
    novas: 0,
    duplicadas: 0,
    descartadas: 0,
    mensagem: '',
    termoAtual: null,
    tempoDecorrido: 0,
    dataInicioYmd: null,
    dataFimYmd: null,
  };
}

function ymdInTimeZone(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function getHojeBrasilia(): string {
  return ymdInTimeZone(new Date());
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
  if (cp) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cp, savedAt: Date.now() }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  singletonState.checkpoint = cp;
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expirar após 24h
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function notifyListeners() {
  for (const listener of singletonState.listeners) {
    listener(singletonState.progress);
  }
}

function updateProgress(partial: Partial<DjenTermosProgress>) {
  singletonState.progress = { ...singletonState.progress, ...partial };
  notifyListeners();
}

// ============================================================================
// LÓGICA DE BUSCA (com validação completa)
// ============================================================================

const TODOS_CIVEIS = ['TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO'];
const TODOS_TRT = ['TST','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'];

function expandirTribunais(tribunais?: string[]): string[] {
  if (!tribunais?.length) return [];
  const set = new Set<string>();
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') TODOS_CIVEIS.forEach(x => set.add(x));
    else if (t === 'TODOS_TRT') TODOS_TRT.forEach(x => set.add(x));
    else set.add(t.toUpperCase());
  }
  return Array.from(set);
}

function gerarHash(conteudo: string, data: string): string {
  const key = `${data}|${conteudo}`.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// VALIDAÇÃO DE CONTEÚDO (crítico para qualidade)
// ============================================================================

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Valida se o conteúdo realmente contém o termo buscado.
 * 
 * Para ADVOGADO:
 *  - OAB deve estar presente (regex flexível)
 *  - Nome deve ter 80% das palavras encontradas
 * 
 * Para PALAVRA-CHAVE/PARTE:
 *  - 80% das palavras do termo devem estar no conteúdo
 */
function conteudoContemTermo(
  conteudo: string,
  termo: string,
  tipo: string,
  oab?: string
): boolean {
  if (!conteudo) return false;

  const conteudoNorm = normalizar(conteudo);

  // Para advogado: validar OAB + Nome
  if (tipo === 'advogado') {
    // 1. OAB DEVE estar presente
    if (oab) {
      const oabDigits = String(oab).replace(/\D/g, '');
      if (oabDigits.length < 3) return false;
      
      // Regex flexível: aceita pontos/espaços entre dígitos (ex: 15.553 ou 15 553)
      const oabPattern = new RegExp(oabDigits.split('').join('[.\\s-]?'), 'i');
      if (!oabPattern.test(conteudo)) {
        return false;
      }
    }

    // 2. Nome do advogado (se informado) - 80% das palavras
    if (termo) {
      const termoNorm = normalizar(termo);
      const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);

      if (palavrasTermo.length > 0) {
        const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
        const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));

        if (palavrasEncontradas.length < minPalavras) {
          return false;
        }
      }
    }

    return true;
  }

  // Para palavra-chave/parte: 80% das palavras devem estar presentes
  if (!termo) return true;

  const termoNorm = normalizar(termo);
  const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);

  if (palavrasTermo.length === 0) return true;

  const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
  const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));

  return palavrasEncontradas.length >= minPalavras;
}

// ============================================================================
// PROCESSAMENTO DE TERMO
// ============================================================================

async function processarTermo(
  mon: Monitoramento,
  diaYmd: string,
  signal: AbortSignal
): Promise<{ novas: number; duplicadas: number; descartadas: number }> {
  if (signal.aborted) return { novas: 0, duplicadas: 0, descartadas: 0 };

  const tipo = mon.tipo === 'parte' ? 'palavra-chave' : mon.tipo;

  const params: any = {
    tipo,
    dataInicio: diaYmd,
    dataFim: diaYmd,
    pageSize: 50,
  };

  if (tipo === 'advogado' && mon.oab) {
    params.oab = String(mon.oab).replace(/\D/g, '');
    const uf = String(mon.uf || '').trim().toUpperCase();
    if (uf && uf !== 'TODAS' && uf.length === 2) {
      params.uf = uf;
    }
  } else if (tipo === 'processo') {
    params.numeroProcesso = mon.termo_busca.replace(/\D/g, '');
  } else {
    params.palavraChave = mon.termo_busca;
  }

  const tribunais = expandirTribunais(mon.tribunais);
  const tribunaisLoop = tribunais.length > 0 ? tribunais : [undefined];

  const seen = new Set<string>();
  const resultados: any[] = [];

  for (const trib of tribunaisLoop) {
    if (signal.aborted) break;

    try {
      const resp = await buscarPjeComunicaPaginado(
        {
          ...params,
          siglaTribunal: trib,
          page: 0,
        },
        {
          signal,
          maxPages: 10,
          delayMs: 3000,
        }
      );

      for (const item of resp.items) {
        const id = String(item?.id ?? '');
        const key = id || JSON.stringify(item).slice(0, 400);
        if (!seen.has(key)) {
          seen.add(key);
          resultados.push(item);
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') break;
      console.warn(`[DJEN] Erro ${trib ?? 'TODOS'}:`, e?.message);

      if (String(e?.message ?? '').includes('429')) {
        await delay(CONFIG.delay_on_rate_limit);
      }
    }

    await delay(CONFIG.delay_between_tribunals);
  }

  if (signal.aborted || resultados.length === 0) {
    return { novas: 0, duplicadas: 0, descartadas: 0 };
  }

  // ================================================================
  // VALIDAÇÃO CRÍTICA: Filtrar publicações que NÃO contêm o termo
  // ================================================================
  let descartadas = 0;
  const pubsValidas = resultados.filter(pub => {
    const conteudo = pub.conteudo || pub.teor || pub.texto || '';
    if (!conteudo) {
      descartadas++;
      return false;
    }

    // 1. Verificar exclusões (termos bloqueados)
    if (mon.exclusoes?.some(exc => 
      conteudo.toUpperCase().includes(String(exc).toUpperCase())
    )) {
      descartadas++;
      return false;
    }

    // 2. Verificar se o termo/OAB realmente está no conteúdo
    if (!conteudoContemTermo(conteudo, mon.termo_busca, mon.tipo, mon.oab)) {
      descartadas++;
      return false;
    }

    return true;
  });

  // Gerar hashes e deduplicar internamente
  const hashMap = new Map<string, typeof pubsValidas[0]>();
  for (const pub of pubsValidas) {
    const conteudo = pub.conteudo || pub.teor || pub.texto || '';
    const dataDisp = (pub.dataDisponibilizacao || pub.dataDJe || diaYmd).slice(0, 10);
    const hash = gerarHash(conteudo, dataDisp);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, { ...pub, hash_conteudo: hash, data_disponibilizacao: dataDisp });
    }
  }
  const pubsUnicas = Array.from(hashMap.values());
  const duplicadasInternas = pubsValidas.length - pubsUnicas.length;

  // Verificar duplicatas no banco
  const hashes = pubsUnicas.map(p => p.hash_conteudo);
  let existentes = new Set<string>();
  if (hashes.length > 0) {
    const { data } = await supabase
      .from('publicacoes_djen')
      .select('hash_conteudo')
      .eq('monitoramento_id', mon.id)
      .in('hash_conteudo', hashes);
    existentes = new Set((data || []).map(d => d.hash_conteudo));
  }

  const novas = pubsUnicas.filter(p => !existentes.has(p.hash_conteudo));
  const duplicadasBanco = pubsUnicas.length - novas.length;

  // Inserir novas
  if (novas.length > 0) {
    const payload = novas.map(pub => ({
      monitoramento_id: mon.id,
      hash_conteudo: pub.hash_conteudo,
      processo_numero: pub.numeroProcesso || pub.processo || null,
      conteudo: pub.conteudo || pub.teor || pub.texto || null,
      data_disponibilizacao: `${pub.data_disponibilizacao}T12:00:00.000Z`,
      data_publicacao: null,
      fonte: pub.tribunal || pub.orgao || pub.siglaTribunal || 'DJEN',
      lida: false,
    }));

    await supabase
      .from('publicacoes_djen')
      .upsert(payload, { onConflict: 'monitoramento_id,hash_conteudo', ignoreDuplicates: true });
  }

  return {
    novas: novas.length,
    duplicadas: duplicadasInternas + duplicadasBanco,
    descartadas,
  };
}

// ============================================================================
// ENGINE PRINCIPAL
// ============================================================================

async function runEngine(
  dataInicioYmd: string,
  dataFimYmd: string,
  retomar: boolean
) {
  if (singletonState.isRunning) {
    console.warn('[DJEN] Já existe uma execução em andamento');
    return;
  }

  singletonState.isRunning = true;
  singletonState.abortController = new AbortController();
  const signal = singletonState.abortController.signal;
  
  const tempoInicio = Date.now();
  const runKey = dataFimYmd;

  // Carregar checkpoint se retomando
  let checkpoint = retomar ? loadCheckpoint() : null;
  if (checkpoint && checkpoint.runKey !== runKey) {
    // Checkpoint é de outra execução, ignorar
    checkpoint = null;
  }

  // Buscar monitoramentos ativos
  const { data: monitoramentos, error } = await supabase
    .from('monitoramentos_djen')
    .select('*')
    .eq('ativo', true);

  if (error || !monitoramentos?.length) {
    updateProgress({
      status: 'erro',
      mensagem: 'Nenhum monitoramento ativo encontrado',
    });
    singletonState.isRunning = false;
    return;
  }

  const termos = monitoramentos as unknown as Monitoramento[];
  const totalTermos = termos.length;
  const listaDatas = gerarListaDatas(dataInicioYmd, dataFimYmd);
  const totalDias = listaDatas.length;
  const globalTotal = totalDias * totalTermos;

  // Inicializar do checkpoint ou do zero
  let diaIdx = checkpoint?.diaIndice ?? 0;
  let termoIdx = checkpoint?.termoIndice ?? 0;
  let novas = checkpoint?.novas ?? 0;
  let duplicadas = checkpoint?.duplicadas ?? 0;
  let descartadas = checkpoint?.descartadas ?? 0;
  const startTime = checkpoint?.tempoInicio ?? tempoInicio;

  // Registrar execução no banco
  const { data: execData } = await supabase
    .from('execucoes_agendadas')
    .insert({
      tipo: 'djen',
      status: 'executando',
      iniciado_em: new Date(startTime).toISOString(),
      detalhes: { runKey, dataInicioYmd, dataFimYmd, totalDias, totalTermos },
    })
    .select('id')
    .single();
  singletonState.executionId = execData?.id ?? null;

  // Iniciar timer
  singletonState.timerInterval = setInterval(() => {
    if (singletonState.progress.status === 'executando') {
      updateProgress({
        tempoDecorrido: Math.floor((Date.now() - startTime) / 1000),
      });
    }
  }, 1000);

  // Progresso inicial
  const globalCurrent = (diaIdx * totalTermos) + termoIdx;
  updateProgress({
    status: 'executando',
    globalCurrent,
    globalTotal,
    percentage: Math.round((globalCurrent / globalTotal) * 100),
    diaAtualYmd: listaDatas[diaIdx] ?? null,
    diaAtualIndice: diaIdx + 1,
    totalDias,
    termoAtualNoDia: termoIdx,
    totalTermos,
    novas,
    duplicadas,
    descartadas,
    mensagem: retomar ? `Retomando dia ${diaIdx + 1}/${totalDias}...` : `Iniciando ${totalDias} dia(s)...`,
    termoAtual: null,
    tempoDecorrido: Math.floor((Date.now() - startTime) / 1000),
    dataInicioYmd,
    dataFimYmd,
  });

  try {
    // ================================================================
    // LOOP PRINCIPAL: DIA por DIA
    // ================================================================
    for (; diaIdx < totalDias; diaIdx++) {
      if (signal.aborted) break;

      const diaYmd = listaDatas[diaIdx];
      const diaFmt = `${diaYmd.slice(8, 10)}/${diaYmd.slice(5, 7)}`;

      updateProgress({
        diaAtualYmd: diaYmd,
        diaAtualIndice: diaIdx + 1,
        mensagem: `📅 ${diaFmt} • Iniciando...`,
      });

      // ================================================================
      // LOOP INTERNO: TERMOS do dia
      // ================================================================
      for (; termoIdx < totalTermos; termoIdx++) {
        if (signal.aborted) break;

        const mon = termos[termoIdx];
        const globalCurrent = (diaIdx * totalTermos) + termoIdx + 1;
        const percentage = Math.round((globalCurrent / globalTotal) * 100);

        updateProgress({
          globalCurrent,
          percentage,
          termoAtualNoDia: termoIdx + 1,
          termoAtual: mon.termo_busca,
          mensagem: `📅 ${diaFmt} • (${termoIdx + 1}/${totalTermos}) ${mon.termo_busca}`,
        });

        // Processar termo
        const result = await processarTermo(mon, diaYmd, signal);
        
        novas += result.novas;
        duplicadas += result.duplicadas;
        descartadas += result.descartadas;

        // Atualizar e salvar checkpoint
        const cp: Checkpoint = {
          runKey,
          diaIndice: diaIdx,
          termoIndice: termoIdx + 1, // próximo termo
          novas,
          duplicadas,
          descartadas,
          tempoInicio: startTime,
          dataInicioYmd,
          dataFimYmd,
        };
        saveCheckpoint(cp);

        updateProgress({
          novas,
          duplicadas,
          descartadas,
        });

        // Atualizar metadata no Supabase (a cada 5 termos)
        if ((termoIdx + 1) % 5 === 0) {
          await supabase
            .from('configuracoes_monitoramento')
            .update({
              metadata: {
                status: 'executando',
                current: globalCurrent,
                total: globalTotal,
                percentage,
                novas,
                duplicadas,
                descartadas,
                diaAtual: diaYmd,
                diaIndice: diaIdx + 1,
                totalDias,
                termoAtual: mon.termo_busca,
                run_key: runKey,
                data_inicio: dataInicioYmd,
                data_fim: dataFimYmd,
              },
            })
            .eq('tipo', 'djen')
            .is('coordenacao_id', null);
        }

        // Delay entre termos
        await delay(CONFIG.delay_between_terms);
      }

      // Dia concluído! Resetar índice de termo para próximo dia
      termoIdx = 0;

      if (!signal.aborted && diaIdx < totalDias - 1) {
        const proximoDia = listaDatas[diaIdx + 1];
        const proximoFmt = `${proximoDia.slice(8, 10)}/${proximoDia.slice(5, 7)}`;
        updateProgress({
          mensagem: `✅ ${diaFmt} concluído! Avançando para ${proximoFmt}...`,
        });
      }
    }

    // ================================================================
    // FINALIZAÇÃO
    // ================================================================
    const duracao = Math.floor((Date.now() - startTime) / 1000);

    if (signal.aborted) {
      updateProgress({
        status: 'cancelado',
        mensagem: `Cancelado. ${novas} novas encontradas.`,
        tempoDecorrido: duracao,
        termoAtual: null,
      });

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            status: 'cancelado',
            current: singletonState.progress.globalCurrent,
            total: globalTotal,
            novas,
            duplicadas,
            descartadas,
            run_key: runKey,
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } else {
      // Limpar checkpoint ao concluir
      saveCheckpoint(null);

      updateProgress({
        status: 'concluido',
        globalCurrent: globalTotal,
        percentage: 100,
        mensagem: `✅ Concluído! ${novas} novas, ${duplicadas} duplicadas`,
        tempoDecorrido: duracao,
        termoAtual: null,
      });

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            status: 'concluido',
            current: globalTotal,
            total: globalTotal,
            percentage: 100,
            novas,
            duplicadas,
            descartadas,
            run_key: runKey,
            last_run: new Date().toISOString(),
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    }

    // Finalizar execução
    if (singletonState.executionId) {
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: signal.aborted ? 'cancelado' : 'concluido',
          finalizado_em: new Date().toISOString(),
          detalhes: { novas, duplicadas, descartadas, duracao },
        })
        .eq('id', singletonState.executionId);
    }
  } catch (error: any) {
    console.error('[DJEN] Erro:', error);
    updateProgress({
      status: 'erro',
      mensagem: `Erro: ${error?.message || 'Falha'}`,
    });
  } finally {
    if (singletonState.timerInterval) {
      clearInterval(singletonState.timerInterval);
      singletonState.timerInterval = null;
    }
    singletonState.isRunning = false;
    singletonState.abortController = null;
    singletonState.executionId = null;
  }
}

// ============================================================================
// API PÚBLICA
// ============================================================================

export function executarDjenTermos(
  dataInicioYmd?: string,
  dataFimYmd?: string,
  retomar = false
) {
  const hoje = getHojeBrasilia();
  
  // Default: últimos 3 dias
  let inicio = dataInicioYmd;
  let fim = dataFimYmd;
  
  if (!inicio && !fim) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - 2);
    inicio = ymdInTimeZone(d);
    fim = hoje;
  } else if (inicio && !fim) {
    fim = inicio;
  } else if (!inicio && fim) {
    inicio = fim;
  }

  // Se retomando, carregar datas do checkpoint
  if (retomar) {
    const cp = loadCheckpoint();
    if (cp) {
      inicio = cp.dataInicioYmd;
      fim = cp.dataFimYmd;
    }
  }

  runEngine(inicio!, fim!, retomar);
}

export function cancelarDjenTermos() {
  singletonState.abortController?.abort();
  updateProgress({
    mensagem: 'Cancelando...',
  });
}

export function limparEstadoDjenTermos() {
  saveCheckpoint(null);
  singletonState.progress = createDefaultProgress();
  notifyListeners();
}

export function forceKillDjenTermos() {
  // Kill switch total
  singletonState.abortController?.abort();
  if (singletonState.timerInterval) {
    clearInterval(singletonState.timerInterval);
    singletonState.timerInterval = null;
  }
  singletonState.isRunning = false;
  singletonState.abortController = null;
  singletonState.executionId = null;
  saveCheckpoint(null);
  singletonState.progress = createDefaultProgress();
  notifyListeners();

  // Limpar banco
  supabase
    .from('execucoes_agendadas')
    .update({ status: 'cancelado', finalizado_em: new Date().toISOString() })
    .eq('tipo', 'djen')
    .eq('status', 'executando')
    .then(() => {});

  supabase
    .from('configuracoes_monitoramento')
    .update({ metadata: { status: 'idle' } })
    .eq('tipo', 'djen')
    .is('coordenacao_id', null)
    .then(() => {});
}

export function getDjenTermosProgress(): DjenTermosProgress {
  return singletonState.progress;
}

export function isDjenTermosRunning(): boolean {
  return singletonState.isRunning;
}

export function getCheckpoint(): Checkpoint | null {
  return loadCheckpoint();
}

export function subscribeDjenTermos(listener: (p: DjenTermosProgress) => void): () => void {
  singletonState.listeners.add(listener);
  // Enviar estado atual imediatamente
  listener(singletonState.progress);
  return () => {
    singletonState.listeners.delete(listener);
  };
}
