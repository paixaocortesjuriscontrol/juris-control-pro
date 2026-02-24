/**
 * DJEN Termos Pro Engine v1.0
 * 
 * Engine completamente novo e independente do DJEN Termos original.
 * Usa metadados estruturados da API PJE Comunica (destinatarios, destinatarioadvogados)
 * para validação precisa ao invés de regex no corpo do texto.
 * 
 * Principais diferenças do engine original:
 * - Validação de advogado via destinatarioadvogados[].advogado (OAB + nome exatos)
 * - Validação de parte via destinatarios[].nome (matching direto)
 * - Condições concomitantes verificadas contra texto + metadados estruturados
 * - Código limpo e focado, sem vícios legados
 */

import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaPaginado, type PjeSearchType } from "@/utils/pjeComunicaClient";
import { buildDjenLikeConteudo } from "@/utils/djenLikeConteudo";

// ============================================================================
// TIPOS
// ============================================================================

export interface DjenTermosProProgress {
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
  termos_or?: string[];
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
  delay_between_pages: 1500,
  max_retries: 4,
  retry_base_delay: 10000,
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// SINGLETON STATE
// ============================================================================

let state: {
  isRunning: boolean;
  progress: DjenTermosProProgress;
  checkpoint: Checkpoint | null;
  abortController: AbortController | null;
  listeners: Set<(p: DjenTermosProProgress) => void>;
  timerInterval: ReturnType<typeof setInterval> | null;
} = {
  isRunning: false,
  progress: createDefaultProgress(),
  checkpoint: null,
  abortController: null,
  listeners: new Set(),
  timerInterval: null,
};

const STORAGE_KEY = 'djen-termos-pro-checkpoint-v1';
const BR_TZ = 'America/Sao_Paulo';

// ============================================================================
// HELPERS
// ============================================================================

function createDefaultProgress(): DjenTermosProProgress {
  return {
    status: 'idle', globalCurrent: 0, globalTotal: 0, percentage: 0,
    diaAtualYmd: null, diaAtualIndice: 0, totalDias: 0,
    termoAtualNoDia: 0, totalTermos: 0,
    novas: 0, duplicadas: 0, descartadas: 0,
    mensagem: '', termoAtual: null, tempoDecorrido: 0,
    dataInicioYmd: null, dataFimYmd: null,
  };
}

function ymdBrasilia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
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

function notifyListeners() {
  for (const listener of state.listeners) listener(state.progress);
}

function updateProgress(partial: Partial<DjenTermosProProgress>) {
  state.progress = { ...state.progress, ...partial };
  notifyListeners();
}

// ============================================================================
// NORMALIZAÇÃO E VALIDAÇÃO (usando metadados estruturados)
// ============================================================================

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ').replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

function contemFrase(textoNorm: string, fraseNorm: string): boolean {
  if (!fraseNorm) return true;
  const escaped = fraseNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(textoNorm);
}

/**
 * Valida advogado usando metadados estruturados da API.
 * Campos: destinatarioadvogados[].advogado.{nome, numero_oab, uf_oab}
 */
function validarAdvogadoMetadados(pub: any, oab?: string, nome?: string): boolean {
  const advogados = pub?.destinatarioadvogados;
  if (!Array.isArray(advogados) || advogados.length === 0) return false;
  
  const oabDigits = oab ? String(oab).replace(/\D/g, '') : '';
  const nomeNorm = nome ? normalizar(nome) : '';
  
  for (const entry of advogados) {
    const adv = entry?.advogado || entry;
    if (!adv) continue;
    
    // Match por OAB (exato nos dígitos)
    if (oabDigits && adv.numero_oab) {
      const advOabDigits = String(adv.numero_oab).replace(/\D/g, '');
      if (advOabDigits === oabDigits) return true;
    }
    
    // Match por nome (normalizado)
    if (nomeNorm && adv.nome) {
      const advNomeNorm = normalizar(adv.nome);
      if (advNomeNorm === nomeNorm || advNomeNorm.includes(nomeNorm) || nomeNorm.includes(advNomeNorm)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Valida parte usando metadados estruturados da API.
 * Campos: destinatarios[].{nome, polo}
 */
function validarParteMetadados(pub: any, nomeParte: string): boolean {
  const dests = pub?.destinatarios;
  if (!Array.isArray(dests) || dests.length === 0) return false;
  
  const nomeNorm = normalizar(nomeParte);
  if (!nomeNorm) return false;
  
  for (const d of dests) {
    if (!d?.nome) continue;
    const destNorm = normalizar(d.nome);
    if (destNorm.includes(nomeNorm) || nomeNorm.includes(destNorm)) return true;
  }
  return false;
}

/**
 * Constrói texto completo para validação (conteúdo + metadados).
 */
function buildTextoCompleto(pub: any): string {
  const partes: string[] = [];
  
  // Texto principal
  const texto = pub?.texto || pub?.conteudo || pub?.teor || '';
  if (texto) partes.push(texto);
  
  // Destinatários (partes)
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) {
      if (d?.nome) partes.push(d.nome);
    }
  }
  
  // Advogados
  if (Array.isArray(pub?.destinatarioadvogados)) {
    for (const entry of pub.destinatarioadvogados) {
      const adv = entry?.advogado || entry;
      if (adv?.nome) partes.push(adv.nome);
      if (adv?.numero_oab) partes.push(`OAB ${adv.uf_oab || ''} ${adv.numero_oab}`);
    }
  }
  
  return partes.join('\n');
}

/** Verifica exclusões contra texto + metadados */
function temExclusao(pub: any, exclusoes?: string[]): string | null {
  if (!exclusoes?.length) return null;
  const textoNorm = normalizar(buildTextoCompleto(pub));
  for (const exc of exclusoes) {
    const excNorm = normalizar(exc);
    if (excNorm && textoNorm.includes(excNorm)) return exc;
  }
  return null;
}

/** Verifica condição concomitante (OR de grupos AND separados por |) */
function condicaoConcomitanteAtendida(pub: any, condicao?: string | null): boolean {
  if (!condicao) return true;
  const grupos = String(condicao).split('|').map(g => g.trim()).filter(Boolean);
  if (grupos.length === 0) return true;
  
  const textoNorm = normalizar(buildTextoCompleto(pub));
  
  return grupos.some(grupo => {
    const termosAnd = grupo.split(',').map(t => t.trim()).filter(Boolean);
    if (termosAnd.length === 0) return true;
    return termosAnd.every(t => contemFrase(textoNorm, normalizar(t)));
  });
}

/** Valida se a publicação contém o termo buscado (usando metadados estruturados) */
function validarTermo(pub: any, mon: Monitoramento): boolean {
  const tipo = mon.tipo;
  const textoCompleto = buildTextoCompleto(pub);
  const textoNorm = normalizar(textoCompleto);
  
  if (tipo === 'advogado') {
    // 1. Validar via metadados estruturados (mais confiável)
    if (validarAdvogadoMetadados(pub, mon.oab, mon.termo_busca)) return true;
    
    // 2. Fallback: validar no texto
    const nomeNorm = normalizar(mon.termo_busca);
    if (nomeNorm && contemFrase(textoNorm, nomeNorm)) return true;
    
    // 3. Fallback: OAB no texto
    if (mon.oab) {
      const oabDigits = String(mon.oab).replace(/\D/g, '');
      if (oabDigits.length >= 3 && textoNorm.includes(oabDigits)) return true;
    }
    
    // 4. Verificar termos_or (outros advogados)
    if (mon.termos_or?.length) {
      for (const termoOr of mon.termos_or) {
        const orNorm = normalizar(termoOr.trim());
        if (orNorm && contemFrase(textoNorm, orNorm)) return true;
        if (validarAdvogadoMetadados(pub, undefined, termoOr.trim())) return true;
      }
    }
    
    return false;
  }
  
  if (tipo === 'parte') {
    // 1. Validar via metadados estruturados
    if (validarParteMetadados(pub, mon.termo_busca)) return true;
    
    // 2. Fallback: texto
    const nomeNorm = normalizar(mon.termo_busca);
    if (nomeNorm && contemFrase(textoNorm, nomeNorm)) return true;
    
    return false;
  }
  
  if (tipo === 'processo') {
    const numDigits = mon.termo_busca.replace(/\D/g, '');
    const pubNum = String(pub?.numero_processo || pub?.numeroProcesso || pub?.processo || '').replace(/\D/g, '');
    return pubNum.includes(numDigits);
  }
  
  // palavra-chave
  const termoNorm = normalizar(mon.termo_busca);
  if (termoNorm && contemFrase(textoNorm, termoNorm)) return true;
  
  // termos_or
  if (mon.termos_or?.length) {
    for (const t of mon.termos_or) {
      const tNorm = normalizar(t.trim());
      if (tNorm && contemFrase(textoNorm, tNorm)) return true;
    }
  }
  
  return false;
}

// ============================================================================
// TRIBUNAL HELPERS
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

function getSiglaTribunal(item: any): string | null {
  const raw = item?.siglaTribunal || item?.tribunal || item?.nomeOrgao || null;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.toUpperCase().match(/\b(TJ\w+|TRT\d+|TRF\d+|TST|STJ|STF)\b/);
  return m?.[1] ?? raw.trim().toUpperCase();
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

function calcularProximoDiaUtil(dataBase: Date): Date {
  const resultado = new Date(dataBase);
  while (resultado.getDay() === 0 || resultado.getDay() === 6) resultado.setDate(resultado.getDate() + 1);
  const mes = resultado.getMonth();
  const dia = resultado.getDate();
  if ((mes === 11 && dia >= 20) || (mes === 0 && dia <= 6)) {
    if (mes === 11) resultado.setFullYear(resultado.getFullYear() + 1);
    resultado.setMonth(0); resultado.setDate(7);
    while (resultado.getDay() === 0 || resultado.getDay() === 6) resultado.setDate(resultado.getDate() + 1);
  }
  return resultado;
}

function calcularDataPublicacao(dataDispYmd: string): string {
  const base = new Date(`${dataDispYmd}T12:00:00`);
  base.setDate(base.getDate() + 1);
  return calcularProximoDiaUtil(base).toISOString().slice(0, 10);
}

// ============================================================================
// PROCESSAMENTO DE PUBLICAÇÃO
// ============================================================================

function extrairAdvogadosEstruturados(pub: any): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  
  if (Array.isArray(pub?.destinatarioadvogados)) {
    for (const entry of pub.destinatarioadvogados) {
      const adv = entry?.advogado || entry;
      if (!adv?.nome) continue;
      const key = `${adv.nome}|${adv.numero_oab || ''}`.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const oabStr = adv.numero_oab ? ` - OAB ${adv.uf_oab || ''}${adv.numero_oab}` : '';
      result.push(`${adv.nome}${oabStr}`);
    }
  }
  return result;
}

function extrairPartesEstruturadas(pub: any): Array<{ nome: string; polo: string }> {
  if (!Array.isArray(pub?.destinatarios)) return [];
  return pub.destinatarios
    .filter((d: any) => d?.nome)
    .map((d: any) => ({ nome: d.nome, polo: d.polo || '?' }));
}

// ============================================================================
// PROCESSAMENTO DE UM TERMO
// ============================================================================

async function processarTermoPro(
  mon: Monitoramento,
  diaYmd: string,
  signal: AbortSignal,
): Promise<{ novas: number; duplicadas: number; descartadas: number }> {
  if (signal.aborted) return { novas: 0, duplicadas: 0, descartadas: 0 };
  
  const tipo: PjeSearchType = mon.tipo === 'parte' ? 'parte' : mon.tipo;
  const tribunais = expandirTribunais(mon.tribunais);
  
  // Buscar publicações da API
  const resultados: any[] = [];
  const seen = new Set<string>();
  
  const addResults = (items: any[], tribunalOverride?: string) => {
    for (const item of items) {
      const id = String(item?.id ?? '');
      const key = id || JSON.stringify(item).slice(0, 400);
      if (!seen.has(key)) {
        seen.add(key);
        const enriched = tribunalOverride
          ? { ...item, siglaTribunal: item?.siglaTribunal ?? tribunalOverride }
          : item;
        resultados.push(enriched);
      }
    }
  };
  
  // Configurar parâmetros base
  const baseParams: any = {
    tipo,
    dataInicio: diaYmd,
    dataFim: diaYmd,
    pageSize: 50,
  };
  
  if (tipo === 'parte') {
    baseParams.nomeParte = mon.termo_busca;
  } else if (tipo === 'advogado') {
    baseParams.oab = mon.oab ? String(mon.oab).replace(/\D/g, '') : undefined;
    // Normalizar acentos do nomeAdvogado — a API PJE Comunica aceita sem acentos
    // e o parâmetro nomeAdvogado é de BUSCA (não match exato no campo destinatarioadvogados)
    baseParams.nomeAdvogado = mon.termo_busca
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    baseParams.uf = mon.uf;
  } else if (tipo === 'processo') {
    baseParams.numeroProcesso = mon.termo_busca.replace(/\D/g, '');
  } else {
    // palavra-chave
    baseParams.palavraChave = mon.termo_busca;
  }
  
  // Determinar loops de tribunal
  const isAdvogadoComOab = tipo === 'advogado' && !!mon.oab;
  const tribLoop = (tribunais.length > 0)
    ? tribunais
    : [undefined as string | undefined];
  
  for (const trib of tribLoop) {
    if (signal.aborted) break;
    
    try {
      const resp = await buscarPjeComunicaPaginado(
        { ...baseParams, siglaTribunal: trib, page: 1 },
        { signal, maxPages: 20, delayMs: CONFIG.delay_between_pages, maxRetries: CONFIG.max_retries, retryBaseDelay: CONFIG.retry_base_delay }
      );
      addResults(resp.items, trib);
    } catch (e: any) {
      if (e?.name === 'AbortError') break;
      console.warn(`[DJEN Pro] Erro busca ${trib ?? 'TODOS'}:`, e?.message);
    }
    
    if (tribLoop.length > 1) await delay(1200);
  }
  
  // Retry sem ufOab quando busca por OAB não retornou resultados do tribunal desejado.
  // IMPORTANTE: A API PJE Comunica frequentemente ignora siglaTribunal em buscas por OAB,
  // retornando resultados de outros tribunais. Precisamos verificar se temos resultados
  // que REALMENTE correspondem aos tribunais configurados, não apenas se temos resultados.
  const temResultadosDoTribunal = tribunais.length === 0 || resultados.some(pub => {
    const sigla = getSiglaTribunal(pub);
    return sigla && tribunais.includes(sigla);
  });
  if (isAdvogadoComOab && !temResultadosDoTribunal && !signal.aborted) {
    const tribunaisRetry = tribunais.length > 0 ? tribunais : [];
    // Normalizar acentos do nome para busca — a API aceita melhor sem acentos
    const nomeNormalizado = mon.termo_busca
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    
    for (const trib of tribunaisRetry) {
      if (signal.aborted) break;
      try {
        console.log(`[DJEN Pro] Retry sem ufOab para ${trib}, buscando por nome: ${nomeNormalizado}`);
        const resp = await buscarPjeComunicaPaginado(
          { 
            tipo: 'advogado' as PjeSearchType,
            nomeAdvogado: nomeNormalizado,
            siglaTribunal: trib,
            dataInicio: diaYmd, dataFim: diaYmd, 
            pageSize: 50, page: 1 
          },
          { signal, maxPages: 20, delayMs: CONFIG.delay_between_pages, maxRetries: CONFIG.max_retries, retryBaseDelay: CONFIG.retry_base_delay }
        );
        addResults(resp.items, trib);
      } catch (e: any) {
        if (e?.name === 'AbortError') break;
        console.warn(`[DJEN Pro] Retry sem ufOab ${trib}:`, e?.message);
      }
      await delay(1200);
    }
  }
  
  // Busca complementar por texto para advogados (captura menções no corpo)
  if ((tipo === 'advogado') && !signal.aborted) {
    const nomesTexto = new Set<string>();
    if (mon.termo_busca) nomesTexto.add(mon.termo_busca);
    if (mon.oab) nomesTexto.add(String(mon.oab).replace(/\D/g, ''));
    if (mon.termos_or?.length) {
      for (const t of mon.termos_or) if (t.trim()) nomesTexto.add(t.trim());
    }
    
    for (const termo of nomesTexto) {
      if (signal.aborted) break;
      const textTribLoop = tribunais.length > 0 ? tribunais : [undefined as string | undefined];
      for (const trib of textTribLoop) {
        if (signal.aborted) break;
        try {
          const resp = await buscarPjeComunicaPaginado(
            { tipo: 'palavra-chave', palavraChave: termo, siglaTribunal: trib, dataInicio: diaYmd, dataFim: diaYmd, pageSize: 50, page: 1 },
            { signal, maxPages: 20, delayMs: CONFIG.delay_between_pages, maxRetries: CONFIG.max_retries, retryBaseDelay: CONFIG.retry_base_delay }
          );
          addResults(resp.items, trib);
        } catch (e: any) {
          if (e?.name === 'AbortError') break;
          console.warn(`[DJEN Pro] Erro busca texto "${termo}" trib=${trib}:`, e?.message);
        }
        await delay(600);
      }
    }
  }
  
  if (signal.aborted || resultados.length === 0) {
    return { novas: 0, duplicadas: 0, descartadas: 0 };
  }
  
  // ================================================================
  // VALIDAÇÃO usando metadados estruturados
  // ================================================================
  let descartadas = 0;
  const pubsDescartadas: any[] = [];
  
  const pubsValidas = resultados.filter(pub => {
    // 1. Filtro de tribunal
    if (tribunais.length > 0) {
      const sigla = getSiglaTribunal(pub);
      if (!sigla || !tribunais.includes(sigla)) {
        descartadas++;
        pubsDescartadas.push({ ...pub, motivo_descarte: 'tribunal_nao_permitido' });
        return false;
      }
    }
    
    // 2. Verificar exclusões
    const excEncontrada = temExclusao(pub, mon.exclusoes);
    if (excEncontrada) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: `excluido: ${excEncontrada}` });
      return false;
    }
    
    // 3. Validar termo (usando metadados estruturados)
    if (!validarTermo(pub, mon)) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: 'termo_nao_encontrado' });
      return false;
    }
    
    // 4. Condição concomitante
    if (!condicaoConcomitanteAtendida(pub, mon.condicao_concomitante)) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: 'condicao_concomitante' });
      return false;
    }
    
    return true;
  });
  
  // Deduplicar por hash
  const hashMap = new Map<string, any>();
  for (const pub of pubsValidas) {
    const conteudo = pub.texto || pub.conteudo || pub.teor || '';
    const dataDisp = (pub.dataDisponibilizacao || pub.data_disponibilizacao || diaYmd).slice(0, 10);
    const hash = gerarHash(conteudo, dataDisp);
    if (!hashMap.has(hash)) {
      hashMap.set(hash, { ...pub, hash_conteudo: hash, data_disponibilizacao_ymd: dataDisp });
    }
  }
  const pubsUnicas = Array.from(hashMap.values());
  
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
    const payload = novas.map(pub => {
      const conteudoOriginal = pub.texto || pub.conteudo || pub.teor || null;
      const conteudoFormatado = buildDjenLikeConteudo({
        pub, diaYmd,
        monitoramento: { tipo: mon.tipo, termo: mon.termo_busca, oab: mon.oab, uf: mon.uf },
        conteudoOriginal,
      });
      
      const dataDisp = pub.data_disponibilizacao_ymd;
      const dataPub = calcularDataPublicacao(dataDisp);
      
      // Metadados estruturados (direto da API)
      const advogados = extrairAdvogadosEstruturados(pub);
      const partes = extrairPartesEstruturadas(pub);
      
      return {
        monitoramento_id: mon.id,
        hash_conteudo: pub.hash_conteudo,
        processo_numero: pub.numeroProcesso || pub.numero_processo || pub.processo || null,
        conteudo: conteudoFormatado,
        data_disponibilizacao: `${dataDisp}T12:00:00.000Z`,
        data_publicacao: `${dataPub}T12:00:00.000Z`,
        tribunal: getSiglaTribunal(pub),
        fonte: pub.siglaTribunal || pub.tribunal || 'DJEN-PRO',
        lida: false,
        orgao: pub.nomeOrgao || pub.nome_orgao || null,
        tipo_comunicacao: pub.tipoComunicacao || null,
        meio: pub.meio || pub.meiocompleto || null,
        advogados_json: advogados.length > 0 ? JSON.stringify(advogados) : null,
        partes_json: partes.length > 0 ? JSON.stringify(partes) : null,
      };
    });
    
    await supabase
      .from('publicacoes_djen')
      .upsert(payload, { onConflict: 'monitoramento_id,hash_conteudo', ignoreDuplicates: true });
  }
  
  // Persistir descartadas
  if (pubsDescartadas.length > 0) {
    const payloadDesc = pubsDescartadas.slice(0, 200).map(pub => {
      const conteudoOriginal = pub.texto || pub.conteudo || pub.teor || '';
      const conteudoFormatado = buildDjenLikeConteudo({
        pub, diaYmd,
        monitoramento: { tipo: mon.tipo, termo: mon.termo_busca, oab: mon.oab, uf: mon.uf },
        conteudoOriginal,
      });
      const dataDisp = (pub.dataDisponibilizacao || pub.data_disponibilizacao || diaYmd).slice(0, 10);
      const hash = gerarHash(conteudoFormatado + (pub.motivo_descarte || ''), dataDisp);
      
      const advogados = extrairAdvogadosEstruturados(pub);
      const partes = extrairPartesEstruturadas(pub);
      
      return {
        monitoramento_id: mon.id,
        hash_conteudo: hash,
        processo_numero: pub.numeroProcesso || pub.numero_processo || null,
        conteudo: conteudoFormatado.slice(0, 10000),
        data_publicacao: `${calcularDataPublicacao(dataDisp)}T12:00:00.000Z`,
        data_disponibilizacao: `${dataDisp}T12:00:00.000Z`,
        tribunal: getSiglaTribunal(pub),
        fonte: pub.siglaTribunal || 'DJEN-PRO',
        motivo_descarte: pub.motivo_descarte || 'desconhecido',
        orgao: pub.nomeOrgao || null,
        tipo_comunicacao: pub.tipoComunicacao || null,
        meio: pub.meio || null,
        advogados_json: advogados.length > 0 ? JSON.stringify(advogados) : null,
        partes_json: partes.length > 0 ? JSON.stringify(partes) : null,
      };
    });
    
    await supabase
      .from('publicacoes_djen_descartadas')
      .upsert(payloadDesc, { onConflict: 'monitoramento_id,hash_conteudo', ignoreDuplicates: true });
  }
  
  return {
    novas: novas.length,
    duplicadas: duplicadasBanco + (pubsValidas.length - pubsUnicas.length),
    descartadas,
  };
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
    console.warn('[DJEN Pro] Já existe uma execução em andamento');
    return;
  }
  
  state.isRunning = true;
  state.abortController = new AbortController();
  const signal = state.abortController.signal;
  const tempoInicio = Date.now();
  
  // Timer de tempo decorrido
  state.timerInterval = setInterval(() => {
    updateProgress({ tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000) });
  }, 1000);
  
  try {
    // Carregar monitoramentos
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true);
    
    if (coordenacaoId) query = query.eq('coordenacao_id', coordenacaoId);
    if (monitoramentoIds?.length) query = query.in('id', monitoramentoIds);
    
    const { data: termos, error } = await query;
    if (error) throw error;
    if (!termos?.length) {
      updateProgress({ status: 'concluido', mensagem: 'Nenhum monitoramento ativo encontrado', percentage: 100 });
      return;
    }
    
    const monitoramentos: Monitoramento[] = termos.map((t: any) => ({
      id: t.id, tipo: t.tipo, termo_busca: t.termo_busca,
      oab: t.oab, uf: t.uf, ativo: t.ativo,
      exclusoes: t.exclusoes, tribunais: t.tribunais,
      termos_or: t.termos_or, descricao: t.descricao,
      condicao_concomitante: t.condicao_concomitante,
      coordenacao_id: t.coordenacao_id,
    }));
    
    const datas = gerarListaDatas(dataInicioYmd, dataFimYmd);
    const totalOps = datas.length * monitoramentos.length;
    
    // Checkpoint para retomada
    const cp = retomar ? loadCheckpoint() : null;
    const runKey = `${dataInicioYmd}..${dataFimYmd}`;
    let startDiaIdx = 0;
    let startTermoIdx = 0;
    let acumNovas = 0;
    let acumDuplicadas = 0;
    let acumDescartadas = 0;
    
    if (cp && cp.runKey === runKey) {
      startDiaIdx = cp.diaIndice;
      startTermoIdx = cp.termoIndice;
      acumNovas = cp.novas;
      acumDuplicadas = cp.duplicadas;
      acumDescartadas = cp.descartadas;
    }
    
    updateProgress({
      status: 'executando',
      globalTotal: totalOps,
      totalDias: datas.length,
      totalTermos: monitoramentos.length,
      dataInicioYmd,
      dataFimYmd,
      novas: acumNovas,
      duplicadas: acumDuplicadas,
      descartadas: acumDescartadas,
      mensagem: 'Iniciando DJEN Termos Pro...',
    });
    
    for (let diaIdx = startDiaIdx; diaIdx < datas.length; diaIdx++) {
      if (signal.aborted) break;
      const diaYmd = datas[diaIdx];
      
      const termoStart = (diaIdx === startDiaIdx) ? startTermoIdx : 0;
      
      for (let termoIdx = termoStart; termoIdx < monitoramentos.length; termoIdx++) {
        if (signal.aborted) break;
        const mon = monitoramentos[termoIdx];
        const globalCurrent = diaIdx * monitoramentos.length + termoIdx + 1;
        
        updateProgress({
          diaAtualYmd: diaYmd,
          diaAtualIndice: diaIdx + 1,
          termoAtualNoDia: termoIdx + 1,
          termoAtual: mon.descricao || mon.termo_busca,
          globalCurrent,
          percentage: Math.round((globalCurrent / totalOps) * 100),
          mensagem: `[${diaYmd}] ${mon.descricao || mon.termo_busca}`,
        });
        
        const resultado = await processarTermoPro(mon, diaYmd, signal);
        acumNovas += resultado.novas;
        acumDuplicadas += resultado.duplicadas;
        acumDescartadas += resultado.descartadas;
        
        updateProgress({
          novas: acumNovas,
          duplicadas: acumDuplicadas,
          descartadas: acumDescartadas,
        });
        
        // Checkpoint
        saveCheckpoint({
          runKey, diaIndice: diaIdx, termoIndice: termoIdx + 1,
          novas: acumNovas, duplicadas: acumDuplicadas, descartadas: acumDescartadas,
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
        mensagem: `Concluído! ${acumNovas} novas, ${acumDuplicadas} duplicadas, ${acumDescartadas} descartadas`,
      });
    } else {
      updateProgress({ status: 'cancelado', mensagem: 'Execução cancelada' });
    }
  } catch (err: any) {
    console.error('[DJEN Pro] Erro:', err);
    updateProgress({ status: 'erro', mensagem: `Erro: ${err?.message || String(err)}` });
  } finally {
    state.isRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }
}

// ============================================================================
// API PÚBLICA (singleton)
// ============================================================================

export function executarDjenTermosPro(
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

export function cancelarDjenTermosPro() {
  if (state.abortController) {
    state.abortController.abort();
    updateProgress({ status: 'cancelado', mensagem: 'Cancelando...' });
  }
}

export function limparEstadoDjenTermosPro() {
  state.progress = createDefaultProgress();
  notifyListeners();
}

export function forceKillDjenTermosPro(clearCheckpoint = false) {
  cancelarDjenTermosPro();
  state.isRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (clearCheckpoint) saveCheckpoint(null);
  state.progress = createDefaultProgress();
  notifyListeners();
}

export function getDjenTermosProProgress(): DjenTermosProProgress {
  return state.progress;
}

export function isDjenTermosProRunning(): boolean {
  return state.isRunning;
}

export function getCheckpointPro(): Checkpoint | null {
  return state.checkpoint || loadCheckpoint();
}

export function subscribeDjenTermosPro(listener: (p: DjenTermosProProgress) => void): () => void {
  state.listeners.add(listener);
  return () => { state.listeners.delete(listener); };
}
