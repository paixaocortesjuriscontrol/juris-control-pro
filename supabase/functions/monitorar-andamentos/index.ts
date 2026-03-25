import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATAJUD_TIMEOUT_MS = 6_000; // 6s timeout for faster fail-fast

class CancelledError extends Error {
  constructor(message = 'cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

function createCancelChecker(
  supabase: any,
  tipo: string,
  execucaoId?: string,
  throttleMs = 1500
) {
  let lastCheck = 0;
  let cachedCancelled = false;

  return async function isCancelled() {
    if (cachedCancelled) return true;
    const now = Date.now();
    if (now - lastCheck < throttleMs) return false;
    lastCheck = now;

    // Cancelamento forçado via tracking: se a execução foi marcada como cancelada,
    // paramos mesmo que o metadata não tenha sido persistido.
    if (execucaoId) {
      const { data: exec } = await supabase
        .from('execucoes_agendadas')
        .select('status')
        .eq('id', execucaoId)
        .maybeSingle();

      if (exec?.status === 'cancelado') {
        cachedCancelled = true;
        return true;
      }
    }

    const { data } = await supabase
      .from('configuracoes_monitoramento')
      .select('metadata')
      .eq('tipo', tipo)
      .is('coordenacao_id', null)
      .maybeSingle();

    cachedCancelled = ((data?.metadata as any) || {})?.cancelado === true;
    return cachedCancelled;
  };
}

async function markCancelled(supabase: any, tipo: string, extra: Record<string, any> = {}) {
  const { data } = await supabase
    .from('configuracoes_monitoramento')
    .select('metadata')
    .eq('tipo', tipo)
    .is('coordenacao_id', null)
    .maybeSingle();

  const meta = ((data?.metadata as any) || {}) as Record<string, any>;
  await supabase
    .from('configuracoes_monitoramento')
    .update({
      metadata: {
        ...meta,
        cancelado: false,
        status: 'cancelado',
        continuingRun: false,
        cancelled_at: new Date().toISOString(),
        ...extra,
      },
    })
    .eq('tipo', tipo)
    .is('coordenacao_id', null);
}

async function markExecucaoCancelled(supabase: any, execucaoId?: string, details: Record<string, any> = {}) {
  if (!execucaoId) return;
  await supabase
    .from('execucoes_agendadas')
    .update({
      status: 'cancelado',
      finalizado_em: new Date().toISOString(),
      detalhes: { cancelled: true, ...details },
    })
    .eq('id', execucaoId);
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// API Key pública do DataJud/CNJ
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Mapa de tribunais baseado na numeração única
const tribunais: Record<string, Record<string, { endpoint: string; nome: string }>> = {
  "3": { "0": { endpoint: "api_publica_stj", nome: "STJ" } },
  "4": {
    "1": { endpoint: "api_publica_trf1", nome: "TRF1" },
    "2": { endpoint: "api_publica_trf2", nome: "TRF2" },
    "3": { endpoint: "api_publica_trf3", nome: "TRF3" },
    "4": { endpoint: "api_publica_trf4", nome: "TRF4" },
    "5": { endpoint: "api_publica_trf5", nome: "TRF5" },
    "6": { endpoint: "api_publica_trf6", nome: "TRF6" }
  },
  "5": {
    "0": { endpoint: "api_publica_tst", nome: "TST" },
    "1": { endpoint: "api_publica_trt1", nome: "TRT1" },
    "2": { endpoint: "api_publica_trt2", nome: "TRT2" },
    "3": { endpoint: "api_publica_trt3", nome: "TRT3" },
    "4": { endpoint: "api_publica_trt4", nome: "TRT4" },
    "5": { endpoint: "api_publica_trt5", nome: "TRT5" },
    "6": { endpoint: "api_publica_trt6", nome: "TRT6" },
    "7": { endpoint: "api_publica_trt7", nome: "TRT7" },
    "8": { endpoint: "api_publica_trt8", nome: "TRT8" },
    "9": { endpoint: "api_publica_trt9", nome: "TRT9" },
    "10": { endpoint: "api_publica_trt10", nome: "TRT10" },
    "11": { endpoint: "api_publica_trt11", nome: "TRT11" },
    "12": { endpoint: "api_publica_trt12", nome: "TRT12" },
    "13": { endpoint: "api_publica_trt13", nome: "TRT13" },
    "14": { endpoint: "api_publica_trt14", nome: "TRT14" },
    "15": { endpoint: "api_publica_trt15", nome: "TRT15" },
    "16": { endpoint: "api_publica_trt16", nome: "TRT16" },
    "17": { endpoint: "api_publica_trt17", nome: "TRT17" },
    "18": { endpoint: "api_publica_trt18", nome: "TRT18" },
    "19": { endpoint: "api_publica_trt19", nome: "TRT19" },
    "20": { endpoint: "api_publica_trt20", nome: "TRT20" },
    "21": { endpoint: "api_publica_trt21", nome: "TRT21" },
    "22": { endpoint: "api_publica_trt22", nome: "TRT22" },
    "23": { endpoint: "api_publica_trt23", nome: "TRT23" },
    "24": { endpoint: "api_publica_trt24", nome: "TRT24" }
  },
  "6": { "0": { endpoint: "api_publica_tse", nome: "TSE" } },
  "7": { "0": { endpoint: "api_publica_stm", nome: "STM" } },
  "8": {
    "1": { endpoint: "api_publica_tjac", nome: "TJAC" },
    "2": { endpoint: "api_publica_tjal", nome: "TJAL" },
    "3": { endpoint: "api_publica_tjap", nome: "TJAP" },
    "4": { endpoint: "api_publica_tjam", nome: "TJAM" },
    "5": { endpoint: "api_publica_tjba", nome: "TJBA" },
    "6": { endpoint: "api_publica_tjce", nome: "TJCE" },
    "7": { endpoint: "api_publica_tjdft", nome: "TJDFT" },
    "8": { endpoint: "api_publica_tjes", nome: "TJES" },
    "9": { endpoint: "api_publica_tjgo", nome: "TJGO" },
    "10": { endpoint: "api_publica_tjma", nome: "TJMA" },
    "11": { endpoint: "api_publica_tjmt", nome: "TJMT" },
    "12": { endpoint: "api_publica_tjms", nome: "TJMS" },
    "13": { endpoint: "api_publica_tjmg", nome: "TJMG" },
    "14": { endpoint: "api_publica_tjpa", nome: "TJPA" },
    "15": { endpoint: "api_publica_tjpb", nome: "TJPB" },
    "16": { endpoint: "api_publica_tjpr", nome: "TJPR" },
    "17": { endpoint: "api_publica_tjpe", nome: "TJPE" },
    "18": { endpoint: "api_publica_tjpi", nome: "TJPI" },
    "19": { endpoint: "api_publica_tjrj", nome: "TJRJ" },
    "20": { endpoint: "api_publica_tjrn", nome: "TJRN" },
    "21": { endpoint: "api_publica_tjrs", nome: "TJRS" },
    "22": { endpoint: "api_publica_tjro", nome: "TJRO" },
    "23": { endpoint: "api_publica_tjrr", nome: "TJRR" },
    "24": { endpoint: "api_publica_tjsc", nome: "TJSC" },
    "25": { endpoint: "api_publica_tjse", nome: "TJSE" },
    "26": { endpoint: "api_publica_tjsp", nome: "TJSP" },
    "27": { endpoint: "api_publica_tjto", nome: "TJTO" }
  }
};

function limparNumeroProcesso(numero: string): string {
  return numero.replace(/\D/g, '').padStart(20, '0');
}

function extrairInfoTribunal(numeroLimpo: string): { j: string; tr: string } | null {
  if (numeroLimpo.length !== 20) return null;
  const j = numeroLimpo.charAt(13);
  const tr = numeroLimpo.substring(14, 16).replace(/^0+/, '') || "0";
  return { j, tr };
}

function getTribunalInfo(numeroProcesso: string): { endpoint: string; nome: string } | null {
  const numeroLimpo = limparNumeroProcesso(numeroProcesso);
  const info = extrairInfoTribunal(numeroLimpo);
  if (!info) return null;
  const jurisdicao = tribunais[info.j];
  if (!jurisdicao) return null;
  return jurisdicao[info.tr] || null;
}

// Cache de termos ativos para varredura
let termosCache: Array<{ id: string; termo: string; prioridade: string }> | null = null;

async function getActiveTermos(supabase: any) {
  if (termosCache) return termosCache;
  
  const { data: termos } = await supabase
    .from('termos_monitoramento')
    .select('id, termo, prioridade')
    .eq('ativo', true);
  
  termosCache = termos || [];
  return termosCache;
}

// ============ FUNÇÃO PARA VERIFICAR DUPLICATAS ============
async function verificarTarefaExistente(
  supabase: any,
  processoId: string,
  responsavelId: string,
  titulo: string
): Promise<boolean> {
  // Busca tarefas com mesmo processo, responsável e título similar nos últimos 30 dias
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);
  
  const tituloBase = titulo.toLowerCase().replace(/\s+/g, ' ').trim();
  
  const { data: existentes } = await supabase
    .from('tarefas')
    .select('id, titulo')
    .eq('processo_id', processoId)
    .eq('responsavel_id', responsavelId)
    .gte('created_at', dataLimite.toISOString())
    .limit(50);
  
  if (!existentes || existentes.length === 0) return false;
  
  // Verifica se alguma tarefa existente tem título muito similar
  for (const t of existentes) {
    const tituloExistente = (t.titulo || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (tituloExistente === tituloBase) {
      console.log(`[DEDUP] Tarefa duplicada detectada: "${titulo}"`);
      return true;
    }
    // Se ambos começam com [Andamento] e têm mesmo tipo
    if (tituloBase.startsWith('[andamento]') && tituloExistente.startsWith('[andamento]')) {
      const numMatch = tituloBase.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      const numExistenteMatch = tituloExistente.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      if (numMatch && numExistenteMatch && numMatch[0] === numExistenteMatch[0]) {
        // Mesmo processo, verifica se é audiência ou intimação similar
        if (tituloBase.includes('audiência') && tituloExistente.includes('audiência')) {
          console.log(`[DEDUP] Tarefa de audiência duplicada detectada`);
          return true;
        }
        if (tituloBase.includes('intimação') && tituloExistente.includes('intimação')) {
          console.log(`[DEDUP] Tarefa de intimação duplicada detectada`);
          return true;
        }
      }
    }
  }
  
  return false;
}

// ============ FUNÇÃO PARA CRIAR TAREFAS ============
async function criarTarefaParaAudiencia(
  supabase: any,
  processoId: string,
  processoNumero: string,
  audienciaId: string,
  tipoAudiencia: string | null,
  dataAudiencia: Date | null
) {
  if (!processoId) return;
  
  try {
    // Buscar responsáveis do processo
    const { data: responsaveis } = await supabase
      .from('processos_responsaveis')
      .select('usuario_id')
      .eq('processo_id', processoId);
    
    const { data: processo } = await supabase
      .from('processos')
      .select('advogado_responsavel_id')
      .eq('id', processoId)
      .maybeSingle();
    
    const usuariosParaTarefa = new Set<string>();
    
    responsaveis?.forEach((r: any) => usuariosParaTarefa.add(r.usuario_id));
    if (processo?.advogado_responsavel_id) {
      usuariosParaTarefa.add(processo.advogado_responsavel_id);
    }
    
    if (usuariosParaTarefa.size === 0) {
      console.log(`Nenhum responsável encontrado para processo ${processoNumero}`);
      return;
    }
    
    // Calcular prazo (2 dias antes da audiência ou 5 dias a partir de hoje)
    let dataVencimento: Date;
    if (dataAudiencia) {
      dataVencimento = new Date(dataAudiencia);
      dataVencimento.setDate(dataVencimento.getDate() - 2);
    } else {
      dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 5);
    }
    
    const titulo = `[Andamento] ${tipoAudiencia || 'Audiência'} - ${processoNumero}`;
    
    for (const usuarioId of usuariosParaTarefa) {
      // Verificar duplicata antes de criar
      const jáExiste = await verificarTarefaExistente(supabase, processoId, usuarioId, titulo);
      if (jáExiste) {
        console.log(`[DEDUP] Pulando tarefa de audiência duplicada para usuário ${usuarioId}`);
        continue;
      }
      
      const { data: tarefaCriada, error: tarefaError } = await supabase
        .from('tarefas')
        .insert({
          titulo,
          descricao: `Audiência detectada via monitoramento de andamentos. Verifique detalhes e prepare-se para a audiência.`,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          responsavel_id: usuarioId,
          processo_id: processoId,
          prioridade: 'alta',
          status: 'pendente',
          origem: 'monitoramento_andamentos',
        })
        .select('id')
        .single();
      
      if (tarefaCriada) {
        console.log(`Tarefa criada para audiência ${audienciaId}: ${tarefaCriada.id}`);
        // Vincular tarefa à audiência
        await supabase
          .from('audiencias_detectadas')
          .update({ tarefa_id: tarefaCriada.id })
          .eq('id', audienciaId);
      }
      if (tarefaError) {
        console.error('Erro ao criar tarefa de audiência:', tarefaError);
      }
    }
  } catch (error) {
    console.error('Erro ao criar tarefa para audiência:', error);
  }
}

async function criarTarefaParaIntimacao(
  supabase: any,
  processoId: string,
  processoNumero: string,
  intimacaoId: string,
  tipoIntimacao: string | null,
  dataLimite: Date | null,
  prazoDias: number | null
) {
  if (!processoId) return;
  
  try {
    // Buscar responsáveis do processo
    const { data: responsaveis } = await supabase
      .from('processos_responsaveis')
      .select('usuario_id')
      .eq('processo_id', processoId);
    
    const { data: processo } = await supabase
      .from('processos')
      .select('advogado_responsavel_id')
      .eq('id', processoId)
      .maybeSingle();
    
    const usuariosParaTarefa = new Set<string>();
    
    responsaveis?.forEach((r: any) => usuariosParaTarefa.add(r.usuario_id));
    if (processo?.advogado_responsavel_id) {
      usuariosParaTarefa.add(processo.advogado_responsavel_id);
    }
    
    if (usuariosParaTarefa.size === 0) {
      console.log(`Nenhum responsável encontrado para processo ${processoNumero}`);
      return;
    }
    
    // Calcular prazo
    let dataVencimento: Date;
    if (dataLimite) {
      dataVencimento = new Date(dataLimite);
    } else if (prazoDias) {
      dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + prazoDias);
    } else {
      dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 15);
    }
    
    const prioridade = prazoDias && prazoDias <= 5 ? 'urgente' : 'alta';
    const titulo = `[Andamento] ${tipoIntimacao || 'Intimação'} - ${processoNumero}`;
    
    for (const usuarioId of usuariosParaTarefa) {
      // Verificar duplicata antes de criar
      const jáExiste = await verificarTarefaExistente(supabase, processoId, usuarioId, titulo);
      if (jáExiste) {
        console.log(`[DEDUP] Pulando tarefa de intimação duplicada para usuário ${usuarioId}`);
        continue;
      }
      
      const { data: tarefaCriada, error: tarefaError } = await supabase
        .from('tarefas')
        .insert({
          titulo,
          descricao: `Intimação detectada via monitoramento de andamentos. Prazo: ${prazoDias || 'a confirmar'} dias.`,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          responsavel_id: usuarioId,
          processo_id: processoId,
          prioridade,
          status: 'pendente',
          origem: 'monitoramento_andamentos',
        })
        .select('id')
        .single();
      
      if (tarefaCriada) {
        console.log(`Tarefa criada para intimação ${intimacaoId}: ${tarefaCriada.id}`);
        // Vincular tarefa à intimação
        await supabase
          .from('intimacoes_detectadas')
          .update({ tarefa_id: tarefaCriada.id })
          .eq('id', intimacaoId);
      }
      if (tarefaError) {
        console.error('Erro ao criar tarefa de intimação:', tarefaError);
      }
    }
  } catch (error) {
    console.error('Erro ao criar tarefa para intimação:', error);
  }
}

// ============ DETECÇÃO DE AUDIÊNCIAS ============
function detectAudienciaInMovement(descricao: string): {
  detected: boolean;
  tipo: string | null;
  data: Date | null;
  contexto: string;
} {
  const descLower = descricao.toLowerCase();
  
  // Termos que indicam audiência
  const termosAudiencia = [
    'audiência',
    'audiencia',
    'sessão de julgamento',
    'sessao de julgamento',
    'designada audiência',
    'designada audiencia',
    'pauta de julgamento',
    'intimação para audiência',
    'intimacao para audiencia',
  ];
  
  const detected = termosAudiencia.some(termo => descLower.includes(termo));
  if (!detected) {
    return { detected: false, tipo: null, data: null, contexto: '' };
  }
  
  // Detectar tipo de audiência
  let tipo = 'Audiência';
  if (descLower.includes('conciliação') || descLower.includes('conciliacao')) {
    tipo = 'Audiência de Conciliação';
  } else if (descLower.includes('instrução') || descLower.includes('instrucao')) {
    tipo = 'Audiência de Instrução';
  } else if (descLower.includes('julgamento')) {
    tipo = 'Sessão de Julgamento';
  } else if (descLower.includes('una') || descLower.includes('unica') || descLower.includes('única')) {
    tipo = 'Audiência Una';
  } else if (descLower.includes('inicial')) {
    tipo = 'Audiência Inicial';
  }
  
  // Tentar extrair data
  const regexData = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  const matches = descricao.match(regexData);
  let dataAudiencia: Date | null = null;
  
  if (matches && matches.length > 0) {
    const parts = matches[0].split(/[\/\-]/);
    if (parts.length === 3) {
      const dia = parseInt(parts[0]);
      const mes = parseInt(parts[1]) - 1;
      let ano = parseInt(parts[2]);
      if (ano < 100) ano += 2000;
      dataAudiencia = new Date(ano, mes, dia);
    }
  }
  
  // Extrair contexto (primeiros 300 caracteres)
  const contexto = descricao.substring(0, 300) + (descricao.length > 300 ? '...' : '');
  
  return { detected: true, tipo, data: dataAudiencia, contexto };
}

// ============ DETECÇÃO DE INTIMAÇÕES ============
function detectIntimacaoInMovement(descricao: string): {
  detected: boolean;
  tipo: string | null;
  prazo: number | null;
  dataLimite: Date | null;
  contexto: string;
} {
  const descLower = descricao.toLowerCase();
  
  // Termos que indicam intimação
  const termosIntimacao = [
    'intimação',
    'intimacao',
    'intimado',
    'intimada',
    'intimar',
    'intime-se',
    'intimem-se',
    'cite-se',
    'citação',
    'citacao',
    'citado',
    'citada',
    'notificação',
    'notificacao',
    'notificado',
    'notificada',
    'notifique-se',
    'cientifique-se',
    'cientificado',
    'para manifestação',
    'para manifestar',
    'prazo de',
    'no prazo',
    'em prazo',
  ];
  
  // Termos que indicam audiência (excluir se for audiência)
  const termosExclusaoAudiencia = [
    'audiência',
    'audiencia',
    'sessão de julgamento',
    'sessao de julgamento',
    'pauta de julgamento',
  ];
  
  // Se contém termos de audiência, não é intimação pura
  const isAudiencia = termosExclusaoAudiencia.some(termo => descLower.includes(termo));
  
  const detected = termosIntimacao.some(termo => descLower.includes(termo)) && !isAudiencia;
  if (!detected) {
    return { detected: false, tipo: null, prazo: null, dataLimite: null, contexto: '' };
  }
  
  // Detectar tipo de intimação
  let tipo = 'Intimação';
  if (descLower.includes('manifestação') || descLower.includes('manifestacao') || descLower.includes('manifestar')) {
    tipo = 'Intimação para Manifestação';
  } else if (descLower.includes('sentença') || descLower.includes('sentenca')) {
    tipo = 'Intimação de Sentença';
  } else if (descLower.includes('despacho')) {
    tipo = 'Intimação de Despacho';
  } else if (descLower.includes('decisão') || descLower.includes('decisao')) {
    tipo = 'Intimação de Decisão';
  } else if (descLower.includes('citação') || descLower.includes('citacao') || descLower.includes('cite-se')) {
    tipo = 'Citação';
  } else if (descLower.includes('notificação') || descLower.includes('notificacao')) {
    tipo = 'Notificação';
  } else if (descLower.includes('contrarrazões') || descLower.includes('contrarrazoes') || descLower.includes('contra-razões')) {
    tipo = 'Intimação para Contrarrazões';
  } else if (descLower.includes('recurso')) {
    tipo = 'Intimação para Recurso';
  } else if (descLower.includes('cumprimento')) {
    tipo = 'Intimação para Cumprimento';
  } else if (descLower.includes('pagamento')) {
    tipo = 'Intimação para Pagamento';
  }
  
  // Tentar extrair prazo (ex: "prazo de 15 dias", "no prazo de 5 dias")
  let prazo: number | null = null;
  const regexPrazo = /prazo\s+(?:de\s+)?(\d+)\s*(?:dias?)?/i;
  const matchPrazo = descricao.match(regexPrazo);
  if (matchPrazo) {
    prazo = parseInt(matchPrazo[1]);
  }
  
  // Tentar extrair data limite
  let dataLimite: Date | null = null;
  const regexData = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  const matches = descricao.match(regexData);
  if (matches && matches.length > 0) {
    const parts = matches[0].split(/[\/\-]/);
    if (parts.length === 3) {
      const dia = parseInt(parts[0]);
      const mes = parseInt(parts[1]) - 1;
      let ano = parseInt(parts[2]);
      if (ano < 100) ano += 2000;
      dataLimite = new Date(ano, mes, dia);
    }
  }
  
  // Se não encontrou data mas encontrou prazo, calcular data limite
  if (!dataLimite && prazo) {
    dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + prazo);
  }
  
  // Extrair contexto (primeiros 400 caracteres)
  const contexto = descricao.substring(0, 400) + (descricao.length > 400 ? '...' : '');
  
  return { detected: true, tipo, prazo, dataLimite, contexto };
}

async function registrarIntimacaoDetectada(
  supabase: any,
  processoId: string,
  processoNumero: string,
  movimentacaoId: string,
  descricao: string,
  dataMovimentacao: string
) {
  const { detected, tipo, prazo, dataLimite, contexto } = detectIntimacaoInMovement(descricao);
  
  if (!detected) return null;
  
  // Verificar se já existe uma intimação similar
  const { data: existing } = await supabase
    .from('intimacoes_detectadas')
    .select('id')
    .eq('processo_numero', processoNumero)
    .eq('contexto', contexto)
    .maybeSingle();
  
  if (existing) {
    console.log(`Intimação já registrada para processo ${processoNumero}`);
    return null;
  }
  
  const { data: inserted, error } = await supabase
    .from('intimacoes_detectadas')
    .insert({
      processo_numero: processoNumero,
      processo_id: processoId,
      movimentacao_id: movimentacaoId,
      data_intimacao: dataMovimentacao,
      data_limite: dataLimite?.toISOString() || null,
      tipo_intimacao: tipo,
      prazo_dias: prazo,
      contexto,
      conteudo_publicacao: descricao,
      descricao: descricao.substring(0, 500),
      status: 'pendente',
      prioridade: prazo && prazo <= 5 ? 'alta' : prazo && prazo <= 3 ? 'urgente' : 'normal',
      origem: 'monitoramento_andamentos',
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Erro ao registrar intimação:', error);
    return null;
  }
  
  console.log(`Intimação detectada para processo ${processoNumero}: ${tipo}`);
  
  // Criar tarefa para os responsáveis
  if (inserted) {
    await criarTarefaParaIntimacao(supabase, processoId, processoNumero, inserted.id, tipo, dataLimite, prazo);
  }
  
  // Notificar usuários relevantes
  await notifyIntimacaoDetectada(supabase, processoId, processoNumero, tipo, dataLimite, prazo);
  
  return inserted;
}

async function notifyIntimacaoDetectada(
  supabase: any,
  processoId: string,
  processoNumero: string,
  tipoIntimacao: string | null,
  dataLimite: Date | null,
  prazo: number | null
) {
  try {
    const { data: processo } = await supabase
      .from('processos')
      .select('advogado_responsavel_id, coordenacao_id')
      .eq('id', processoId)
      .single();

    if (!processo) return;

    const usersToNotify: string[] = [];

    if (processo.advogado_responsavel_id) {
      usersToNotify.push(processo.advogado_responsavel_id);
    }

    if (processo.coordenacao_id) {
      const { data: membros } = await supabase
        .from('membros_coordenacao')
        .select('usuario_id')
        .eq('coordenacao_id', processo.coordenacao_id);

      membros?.forEach((m: any) => {
        if (!usersToNotify.includes(m.usuario_id)) {
          usersToNotify.push(m.usuario_id);
        }
      });
    }

    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'coordenador']);
    
    adminUsers?.forEach((u: any) => {
      if (!usersToNotify.includes(u.user_id)) {
        usersToNotify.push(u.user_id);
      }
    });

    const dataFormatada = dataLimite 
      ? dataLimite.toLocaleDateString('pt-BR')
      : 'Prazo a confirmar';
    
    const prazoText = prazo ? ` (${prazo} dias)` : '';
    const emoji = prazo && prazo <= 5 ? '🚨' : '📋';
    
    for (const userId of usersToNotify) {
      await supabase
        .from('notificacoes')
        .insert({
          usuario_id: userId,
          titulo: `${emoji} Intimação detectada: ${tipoIntimacao || 'Intimação'}`,
          mensagem: `Intimação identificada no processo ${processoNumero}. Prazo: ${dataFormatada}${prazoText}`,
          tipo: prazo && prazo <= 5 ? 'warning' : 'info',
          link: `/painel-intimacoes`,
          dados: {
            processo_numero: processoNumero,
            tipo_intimacao: tipoIntimacao,
            data_limite: dataLimite?.toISOString(),
            prazo_dias: prazo,
          }
        });
    }

    console.log(`Notified ${usersToNotify.length} users about new intimação`);
  } catch (error) {
    console.error('Error notifying about intimação:', error);
  }
}

async function registrarAudienciaDetectada(
  supabase: any,
  processoId: string,
  processoNumero: string,
  movimentacaoId: string,
  descricao: string,
  dataMovimentacao: string
) {
  const { detected, tipo, data, contexto } = detectAudienciaInMovement(descricao);
  
  if (!detected) return null;
  
  // Verificar se já existe uma audiência para este processo com dados similares
  const { data: existing } = await supabase
    .from('audiencias_detectadas')
    .select('id')
    .eq('processo_numero', processoNumero)
    .eq('contexto', contexto)
    .maybeSingle();
  
  if (existing) {
    console.log(`Audiência já registrada para processo ${processoNumero}`);
    return null;
  }
  
  const { data: inserted, error } = await supabase
    .from('audiencias_detectadas')
    .insert({
      processo_numero: processoNumero,
      processo_id: processoId,
      movimentacao_id: movimentacaoId,
      data_audiencia: data?.toISOString() || null,
      tipo_audiencia: tipo,
      contexto,
      conteudo_publicacao: descricao,
      status: 'pendente',
      origem: 'monitoramento_andamentos',
    })
    .select('id')
    .single();
  
  // Criar tarefa para os responsáveis
  if (inserted) {
    await criarTarefaParaAudiencia(supabase, processoId, processoNumero, inserted.id, tipo, data);
  }
  
  if (error) {
    console.error('Erro ao registrar audiência:', error);
    return null;
  }
  
  console.log(`Audiência detectada para processo ${processoNumero}: ${tipo}`);
  
  // Notificar usuários relevantes
  await notifyAudienciaDetectada(supabase, processoId, processoNumero, tipo, data);
  
  return inserted;
}

async function notifyAudienciaDetectada(
  supabase: any,
  processoId: string,
  processoNumero: string,
  tipoAudiencia: string | null,
  dataAudiencia: Date | null
) {
  try {
    const { data: processo } = await supabase
      .from('processos')
      .select('advogado_responsavel_id, coordenacao_id')
      .eq('id', processoId)
      .single();

    if (!processo) return;

    const usersToNotify: string[] = [];

    if (processo.advogado_responsavel_id) {
      usersToNotify.push(processo.advogado_responsavel_id);
    }

    if (processo.coordenacao_id) {
      const { data: membros } = await supabase
        .from('membros_coordenacao')
        .select('usuario_id')
        .eq('coordenacao_id', processo.coordenacao_id);

      membros?.forEach((m: any) => {
        if (!usersToNotify.includes(m.usuario_id)) {
          usersToNotify.push(m.usuario_id);
        }
      });
    }

    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'coordenador']);
    
    adminUsers?.forEach((u: any) => {
      if (!usersToNotify.includes(u.user_id)) {
        usersToNotify.push(u.user_id);
      }
    });

    const dataFormatada = dataAudiencia 
      ? dataAudiencia.toLocaleDateString('pt-BR')
      : 'Data a confirmar';
    
    for (const userId of usersToNotify) {
      await supabase
        .from('notificacoes')
        .insert({
          usuario_id: userId,
          titulo: `📅 Audiência detectada: ${tipoAudiencia || 'Audiência'}`,
          mensagem: `Audiência identificada no processo ${processoNumero}. Data: ${dataFormatada}`,
          tipo: 'warning',
          link: `/painel-audiencias`,
          dados: {
            processo_numero: processoNumero,
            tipo_audiencia: tipoAudiencia,
            data_audiencia: dataAudiencia?.toISOString(),
          }
        });
    }

    console.log(`Notified ${usersToNotify.length} users about new audiência`);

    // NOTA: O envio de alertas externos agora é consolidado em um resumo único ao finalizar
    // a execução completa do monitoramento (ver código ao final do processBatch)
    // Isso evita bombardeio de mensagens individuais para cada audiência detectada
  } catch (error) {
    console.error('Error notifying about audiência:', error);
  }
}

async function scanMovementForTerms(
  supabase: any, 
  movimentacaoId: string, 
  processoId: string, 
  descricao: string
) {
  try {
    const termos = await getActiveTermos(supabase);
    if (!termos || termos.length === 0) return;

    const descricaoLower = descricao.toLowerCase();

    for (const termo of termos!) {
      const termoLower = termo.termo.toLowerCase();
      
      if (descricaoLower.includes(termoLower)) {
        // Extrair contexto (100 caracteres ao redor do termo)
        const index = descricaoLower.indexOf(termoLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(descricao.length, index + termo.termo.length + 50);
        const contexto = (start > 0 ? '...' : '') + 
                        descricao.slice(start, end) + 
                        (end < descricao.length ? '...' : '');

        // Verificar se alerta já existe
        const { data: existing } = await supabase
          .from('alertas_monitoramento')
          .select('id')
          .eq('movimentacao_id', movimentacaoId)
          .eq('termo_id', termo.id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('alertas_monitoramento')
            .insert({
              termo_id: termo.id,
              processo_id: processoId,
              movimentacao_id: movimentacaoId,
              termo_encontrado: termo.termo,
              contexto,
              prioridade: termo.prioridade,
              status: 'pendente',
            });

          console.log(`Alert created for term "${termo.termo}" in movement ${movimentacaoId}`);

          // Enviar notificação para a coordenação
          await notifyCoordinationFor360Alert(supabase, processoId, termo.termo, termo.prioridade, contexto);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning movement for terms:', error);
  }
}

async function notifyCoordinationFor360Alert(
  supabase: any,
  processoId: string,
  termo: string,
  prioridade: string,
  contexto: string
) {
  try {
    const { data: processo } = await supabase
      .from('processos')
      .select('numero, advogado_responsavel_id, coordenacao_id')
      .eq('id', processoId)
      .single();

    if (!processo) return;

    const usersToNotify: string[] = [];

    if (processo.advogado_responsavel_id) {
      usersToNotify.push(processo.advogado_responsavel_id);
    }

    if (processo.coordenacao_id) {
      const { data: membros } = await supabase
        .from('membros_coordenacao')
        .select('usuario_id')
        .eq('coordenacao_id', processo.coordenacao_id);

      membros?.forEach((m: any) => {
        if (!usersToNotify.includes(m.usuario_id)) {
          usersToNotify.push(m.usuario_id);
        }
      });
    }

    // Get all admins and coordinators to notify
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'coordenador']);
    
    adminUsers?.forEach((u: any) => {
      if (!usersToNotify.includes(u.user_id)) {
        usersToNotify.push(u.user_id);
      }
    });

    const prioridadeEmoji = prioridade === 'urgente' ? '🚨' : prioridade === 'alta' ? '⚠️' : 'ℹ️';
    
    for (const userId of usersToNotify) {
      await supabase
        .from('notificacoes')
        .insert({
          usuario_id: userId,
          titulo: `${prioridadeEmoji} Alerta 360º: "${termo}"`,
          mensagem: `Termo "${termo}" encontrado no processo ${processo.numero}. ${contexto}`,
          tipo: prioridade === 'urgente' || prioridade === 'alta' ? 'warning' : 'info',
          link: `/monitoramento-360`,
          dados: {
            processo_id: processoId,
            numero: processo.numero,
            termo,
            prioridade,
          }
        });
    }

    console.log(`Notified ${usersToNotify.length} users about 360 alert for term "${termo}"`);
  } catch (error) {
    console.error('Error notifying coordination for 360 alert:', error);
  }
}

async function consultarProcessoAPI(numeroProcesso: string): Promise<any> {
  const tribunalInfo = getTribunalInfo(numeroProcesso);
  if (!tribunalInfo) return null;

  const numeroLimpo = limparNumeroProcesso(numeroProcesso);
  const url = `https://api-publica.datajud.cnj.jus.br/${tribunalInfo.endpoint}/_search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numeroLimpo } }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const hits = data.hits?.hits || [];
    
    if (hits.length === 0) return null;

    return hits[0]._source;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.toLowerCase().includes('aborted')) {
      console.error(`Error querying process ${numeroProcesso}:`, error);
    }
    return null;
  }
}

// Processa um único lote de processos
async function processBatch(supabase: any, execucaoId?: string): Promise<{
  isComplete: boolean;
  results: any;
  progress: { current: number; total: number; percentage: number };
}> {
  // Increased batch size for faster processing
  const PROCESSES_PER_RUN = 400;
  
  // Get count of active processes for pagination (only those with monitoring enabled)
  const { count: totalCount } = await supabase
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .in('status', ['ativo', 'pendente', 'urgente'])
    .eq('monitorar_andamentos', true);

  // Get current config with metadata
  const { data: configData } = await supabase
    .from('configuracoes_monitoramento')
    .select('metadata')
    .eq('tipo', 'andamentos')
    .maybeSingle();

  let currentOffset = 0;
  let lastCompleteRun: Date | null = null;
  const metadata = configData?.metadata || {};
  
  if (metadata.next_offset !== undefined) {
    currentOffset = metadata.next_offset;
  }
  if (metadata.last_complete_run) {
    lastCompleteRun = new Date(metadata.last_complete_run);
  }

  // Reset offset if we've processed all
  if (currentOffset >= (totalCount || 0)) {
    currentOffset = 0;
  }

  console.log(`Processing offset ${currentOffset} to ${currentOffset + PROCESSES_PER_RUN} of ${totalCount} total processes`);

  // Get batch of active processes with pagination (only those with monitoring enabled)
  const { data: processos, error: processosError } = await supabase
    .from('processos')
    .select('id, numero, advogado_responsavel_id, coordenacao_id')
    .in('status', ['ativo', 'pendente', 'urgente'])
    .eq('monitorar_andamentos', true)
    .order('id')
    .range(currentOffset, currentOffset + PROCESSES_PER_RUN - 1);

  if (processosError) {
    console.error("Error fetching processes:", processosError);
    throw processosError;
  }

  console.log(`Found ${processos?.length || 0} processes to check in this batch`);

  const results = {
    checked: 0,
    newMovements: 0,
    processesWithNewMovements: 0,
    audienciasDetectadas: 0,
    intimacoesDetectadas: 0,
    errors: 0,
    totalProcesses: totalCount || 0,
    currentOffset,
    nextOffset: currentOffset + (processos?.length || 0),
    details: [] as any[],
    cancelled: false,
  };

  // Process in parallel batches - higher parallelism for faster throughput
  const PARALLEL_BATCH_SIZE = 25;

  const isCancelled = createCancelChecker(supabase, 'andamentos', execucaoId);

  outer: for (let i = 0; i < (processos?.length || 0); i += PARALLEL_BATCH_SIZE) {
    if (await isCancelled()) {
      results.cancelled = true;
      await markCancelled(supabase, 'andamentos', { next_offset: currentOffset });
      break;
    }

    const batch = processos!.slice(i, i + PARALLEL_BATCH_SIZE);
    
    const batchPromises = batch.map(async (processo: any) => {
      try {
        if (await isCancelled()) throw new CancelledError();
        results.checked++;
        
        const apiData = await consultarProcessoAPI(processo.numero);
        if (!apiData) {
          return;
        }

        const movimentos = apiData.movimentos || [];
        if (movimentos.length === 0) return;

        // Filter movements since last complete run (or 30 days if no previous run)
        const filterDate = lastCompleteRun || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const recentMovimentos = movimentos.filter((mov: any) => {
          if (!mov.dataHora) return true;
          const movDate = new Date(mov.dataHora);
          return movDate > filterDate;
        });

        if (recentMovimentos.length === 0) return;

        // Get existing movements to avoid duplicates
        const { data: existingMovs } = await supabase
          .from('movimentacoes')
          .select('descricao, data_movimentacao')
          .eq('processo_id', processo.id);

        const existingSet = new Set(
          existingMovs?.map((m: any) => `${m.data_movimentacao}|${m.descricao}`) || []
        );

        let insertedCount = 0;
        const newMovementDetails: string[] = [];

        // Prepare all new movements for batch insert
        const movimentosToInsert: Array<{
          processo_id: string;
          descricao: string;
          data_movimentacao: string;
          tipo: string;
          fonte: string;
        }> = [];

        for (const mov of recentMovimentos) {
          const movName = mov.nome || mov.movimentoNacional?.nome || 'Movimento';
          let descricaoCompleta = movName;
          
          if (mov.complemento || mov.complementosTabelados) {
            const complementos: string[] = [];
            if (mov.complemento) complementos.push(mov.complemento);
            if (mov.complementosTabelados && Array.isArray(mov.complementosTabelados)) {
              mov.complementosTabelados.forEach((c: any) => {
                if (c.descricao) complementos.push(c.descricao);
                if (c.valor) complementos.push(String(c.valor));
              });
            }
            if (complementos.length > 0) {
              descricaoCompleta = `${movName} - ${complementos.join(', ')}`;
            }
          }

          const movDate = mov.dataHora 
            ? new Date(mov.dataHora).toISOString()
            : new Date().toISOString();
          
          const key = `${movDate.split('T')[0]}|${descricaoCompleta}`;

          if (!existingSet.has(key)) {
            existingSet.add(key);
            movimentosToInsert.push({
              processo_id: processo.id,
              descricao: descricaoCompleta,
              data_movimentacao: movDate,
              tipo: movName,
              fonte: 'DataJud/CNJ'
            });
            newMovementDetails.push(descricaoCompleta.substring(0, 50));
          }
        }

        // Batch insert all new movements at once
        if (movimentosToInsert.length > 0) {
          const { data: insertedMovs, error: insertError } = await supabase
            .from('movimentacoes')
            .insert(movimentosToInsert)
            .select('id, descricao, data_movimentacao');

          if (!insertError && insertedMovs) {
            insertedCount = insertedMovs.length;

            // Run detection checks only on newly inserted movements
            for (const insertedMov of insertedMovs) {
              if (await isCancelled()) throw new CancelledError();
              
              // Scan for terms, audiencias, intimacoes
              await scanMovementForTerms(supabase, insertedMov.id, processo.id, insertedMov.descricao);
              
              const audienciaResult = await registrarAudienciaDetectada(
                supabase, processo.id, processo.numero,
                insertedMov.id, insertedMov.descricao, insertedMov.data_movimentacao
              );
              if (audienciaResult) results.audienciasDetectadas++;
              
              const intimacaoResult = await registrarIntimacaoDetectada(
                supabase, processo.id, processo.numero,
                insertedMov.id, insertedMov.descricao, insertedMov.data_movimentacao
              );
              if (intimacaoResult) results.intimacoesDetectadas++;
            }
          }
        }

        if (insertedCount > 0) {
          results.newMovements += insertedCount;
          results.processesWithNewMovements++;

          if (await isCancelled()) throw new CancelledError();

          // Notify coordination about new movements
          const usersToNotify: string[] = [];
          
          if (processo.advogado_responsavel_id) {
            usersToNotify.push(processo.advogado_responsavel_id);
          }

          // Get coordination members
          if (processo.coordenacao_id) {
            const { data: membros } = await supabase
              .from('membros_coordenacao')
              .select('usuario_id')
              .eq('coordenacao_id', processo.coordenacao_id);
            
            membros?.forEach((m: any) => {
              if (!usersToNotify.includes(m.usuario_id)) {
                usersToNotify.push(m.usuario_id);
              }
            });
          }

          // Get all admins and coordinators to notify
          const { data: adminUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'coordenador']);
          
          adminUsers?.forEach((u: any) => {
            if (!usersToNotify.includes(u.user_id)) {
              usersToNotify.push(u.user_id);
            }
          });

          // Batch notification inserts
          const notificationRows = usersToNotify.map(userId => ({
            usuario_id: userId,
            titulo: 'Novos andamentos detectados',
            mensagem: `${insertedCount} novo(s) andamento(s) encontrado(s) no processo ${processo.numero}`,
            tipo: 'info',
            link: `/processos/${processo.id}`,
            dados: {
              processo_id: processo.id,
              numero: processo.numero,
              novos_andamentos: insertedCount,
              detalhes: newMovementDetails
            }
          }));

          if (notificationRows.length > 0) {
            await supabase.from('notificacoes').insert(notificationRows);
          }

          // NOTA: Emails/WhatsApp são enviados APENAS no resumo consolidado ao final
          // da execução completa (ver enviar-resumo-monitoramento)

          results.details.push({
            processo: processo.numero,
            novosAndamentos: insertedCount,
            detalhes: newMovementDetails
          });
        }

      } catch (error) {
        if (error instanceof CancelledError) {
          throw error;
        }
        console.error(`Error processing ${processo.numero}:`, error);
        results.errors++;
      }
    });

    try {
      await Promise.all(batchPromises);
      
      // HEARTBEAT INTERMEDIÁRIO: sinalizar vida a cada ~100 processos
      if (results.checked % 100 < PARALLEL_BATCH_SIZE) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({ ultima_execucao: new Date().toISOString() })
          .eq('tipo', 'andamentos')
          .is('coordenacao_id', null);
        console.log(`[HEARTBEAT] Atualizado em ${results.checked}/${totalCount || 0} processos`);
      }
    } catch (err) {
      if (err instanceof CancelledError) {
        results.cancelled = true;
        await markCancelled(supabase, 'andamentos', { next_offset: currentOffset });
        break outer;
      }
      throw err;
    }
  }

  // Calculate next offset and check if complete
  const nextOffset = currentOffset + (processos?.length || 0);
  const isComplete = results.cancelled ? true : nextOffset >= (totalCount || 0);
  
  // Update metadata and ultima_execucao
  // IMPORTANTE: preservar flags existentes (ex.: metadata.cancelado) para o cancelamento funcionar de forma confiável.
  const newMetadata = {
    ...(metadata as any),
    next_offset: results.cancelled ? currentOffset : (isComplete ? 0 : nextOffset),
    last_batch_size: processos?.length || 0,
    last_complete_run: isComplete ? new Date().toISOString() : (lastCompleteRun?.toISOString() || null),
    total: totalCount || 0,
    status: results.cancelled ? 'cancelado' : (isComplete ? 'concluido' : 'em_andamento'),
    continuingRun: results.cancelled ? false : !isComplete,
  };
  
  const { error: updateError } = await supabase
    .from('configuracoes_monitoramento')
    .update({ 
      ultima_execucao: new Date().toISOString(),
      metadata: newMetadata
    })
    .eq('tipo', 'andamentos');

  if (updateError) {
    console.error("Error updating config:", updateError);
  }

  // Save to history if complete
  if (isComplete && !results.cancelled) {
    await supabase
      .from('historico_monitoramento')
      .insert({
        tipo: 'andamentos',
        processos_verificados: totalCount || 0,
        novos_andamentos: results.newMovements,
        processos_com_novos: results.processesWithNewMovements,
        erros: results.errors,
        detalhes: { results }
      });

    // ========== ENVIO DE RESUMO CONSOLIDADO POR COORDENAÇÃO ==========
    // Buscar andamentos criados hoje agrupados por coordenação
    try {
      console.log('[RESUMO] Iniciando envio de resumo consolidado por coordenação...');
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();
      
      // Buscar todos os andamentos criados hoje com dados do processo
      const { data: andamentosHoje, error: andamentosError } = await supabase
        .from('movimentacoes')
        .select(`
          id,
          descricao,
          data_movimentacao,
          tipo,
          processo_id,
          processos!inner (
            id,
            numero,
            coordenacao_id,
            coordenacoes (
              id,
              nome
            )
          )
        `)
        .gte('created_at', hojeISO)
        .eq('fonte', 'DataJud/CNJ')
        .order('created_at', { ascending: false });

      if (andamentosError) {
        console.error('[RESUMO] Erro ao buscar andamentos:', andamentosError);
      } else if (andamentosHoje && andamentosHoje.length > 0) {
        console.log(`[RESUMO] ${andamentosHoje.length} andamentos encontrados hoje`);
        
        // Agrupar por coordenação
        const porCoordenacao = new Map<string, {
          coordenacao_id: string;
          coordenacao_nome: string;
          andamentos: Array<{ processo_numero: string; descricao: string }>;
        }>();

        for (const mov of andamentosHoje) {
          const processo = mov.processos as any;
          if (!processo?.coordenacao_id) continue;
          
          const coordId = processo.coordenacao_id;
          const coordNome = processo.coordenacoes?.nome || 'Coordenação';
          
          if (!porCoordenacao.has(coordId)) {
            porCoordenacao.set(coordId, {
              coordenacao_id: coordId,
              coordenacao_nome: coordNome,
              andamentos: []
            });
          }
          
          porCoordenacao.get(coordId)!.andamentos.push({
            processo_numero: processo.numero || 'N/A',
            descricao: mov.descricao?.substring(0, 200) || 'Sem descrição'
          });
        }

        if (porCoordenacao.size > 0) {
          // Montar payload para enviar resumo
          const resumosPorCoordenacao = Array.from(porCoordenacao.values()).map(coord => ({
            coordenacao_id: coord.coordenacao_id,
            coordenacao_nome: coord.coordenacao_nome,
            total_verificados: totalCount || 0,
            total_encontrados: coord.andamentos.length,
            // Enviar TODOS os andamentos, sem limite
            exemplos: coord.andamentos.map(a => ({
              processo_numero: a.processo_numero,
              descricao: a.descricao
            }))
          }));

          console.log(`[RESUMO] Enviando resumo para ${resumosPorCoordenacao.length} coordenações`);

          // Chamar edge function de envio de resumo
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          
          const resumoResponse = await fetch(`${supabaseUrl}/functions/v1/enviar-resumo-monitoramento`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              tipo_monitoramento: 'andamentos',
              resumos_por_coordenacao: resumosPorCoordenacao
            })
          });

          if (resumoResponse.ok) {
            const resumoResult = await resumoResponse.json();
            console.log(`[RESUMO] Resumos enviados com sucesso:`, resumoResult);
          } else {
            const errorText = await resumoResponse.text();
            console.error(`[RESUMO] Erro ao enviar resumos:`, errorText);
          }
        } else {
          console.log('[RESUMO] Nenhuma coordenação com andamentos para notificar');
        }
      } else {
        console.log('[RESUMO] Nenhum andamento novo encontrado hoje');
      }
    } catch (resumoError) {
      console.error('[RESUMO] Erro ao processar envio de resumo:', resumoError);
    }
    // ========== FIM DO ENVIO DE RESUMO ==========
  }

  console.log("Batch monitoring completed:", {
    ...results,
    audienciasDetectadas: results.audienciasDetectadas,
    intimacoesDetectadas: results.intimacoesDetectadas
  });
  
  return {
    isComplete,
    results,
    progress: {
      current: results.cancelled ? currentOffset : nextOffset,
      total: totalCount || 0,
      percentage: Math.round(((results.cancelled ? currentOffset : nextOffset) / (totalCount || 1)) * 100)
    }
  };
}

// Helper para atualizar execucoes_agendadas com progresso
async function updateExecucaoProgress(
  supabase: any,
  execucaoId: string | undefined,
  data: {
    status?: string;
    registros_processados?: number;
    registros_encontrados?: number;
    total_lotes?: number;
    detalhes?: Record<string, any>;
    finalizado_em?: string;
  }
) {
  if (!execucaoId) return;
  // NOTE: execucoes_agendadas não possui coluna updated_at.
  // Se enviarmos updated_at aqui, o update falha silenciosamente e o progresso nunca aparece no frontend.
  const { error } = await supabase
    .from('execucoes_agendadas')
    .update({
      ...data,
    })
    .eq('id', execucaoId);

  if (error) {
    console.error('Error updating execucoes_agendadas progress:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({} as any));
    const completeRun = body?.completeRun === true;
    const execucaoId = body?.execucaoId as string | undefined;
    // Auto-continuation should ALWAYS work for heavy types - remove managedByWrapper check
    // The orchestrator just kicks off the first batch, worker handles the rest

    console.log(`Starting andamentos monitoring... (completeRun: ${completeRun})`);

    // Clear terms cache at start
    termosCache = null;

    // Early cancellation check: if user requested cancel, stop immediately (don’t process another batch)
    if (completeRun) {
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, metadata')
        .eq('tipo', 'andamentos')
        .is('coordenacao_id', null)
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

      if (wasCancelled && freshConfig?.id) {
        console.log('Cancellation flag detected at start, skipping batch');
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...(freshConfig.metadata as any),
              cancelado: false,
              status: 'cancelado',
              continuingRun: false,
            },
          })
          .eq('id', freshConfig.id);

        await markExecucaoCancelled(supabase, execucaoId, { tipo: 'andamentos', phase: 'early' });

        return new Response(
          JSON.stringify({
            success: true,
            cancelled: true,
            isComplete: true,
            continuingRun: false,
            message: 'Execução cancelada (antes de iniciar o próximo lote)',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Single batch execution (used for both manual and complete runs)
    const { isComplete, results, progress } = await processBatch(supabase, execucaoId);

    // Atualizar progresso em tempo real na tabela execucoes_agendadas
    await updateExecucaoProgress(supabase, execucaoId, {
      status: results?.cancelled ? 'cancelado' : (isComplete ? 'concluido' : 'executando'),
      registros_processados: progress.current,
      registros_encontrados: results?.newMovements || 0,
      total_lotes: progress.total,
      detalhes: {
        progress: {
          current: progress.current,
          total: progress.total,
          percentage: progress.percentage,
        },
        audienciasDetectadas: results?.audienciasDetectadas || 0,
        intimacoesDetectadas: results?.intimacoesDetectadas || 0,
        errors: results?.errors || 0,
      },
      ...(isComplete || results?.cancelled ? { finalizado_em: new Date().toISOString() } : {}),
    });

    if (results?.cancelled) {
      await markExecucaoCancelled(supabase, execucaoId, { tipo: 'andamentos', phase: 'mid-batch' });
    }

    // Auto-continuation: if completeRun and not complete, trigger next batch
    // Check if cancellation was requested first
    if (completeRun && !isComplete) {
      const { data: freshConfig } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'andamentos')
        .is('coordenacao_id', null)
        .maybeSingle();

      const wasCancelled = (freshConfig?.metadata as any)?.cancelado === true;

      if (wasCancelled) {
        console.log('Execution cancelled by user, stopping auto-continuation');
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...(freshConfig?.metadata as any),
              cancelado: false,
              status: 'cancelado',
              continuingRun: false,
            },
          })
          .eq('tipo', 'andamentos')
          .is('coordenacao_id', null);
      } else {
        const functionUrl = `${supabaseUrl}/functions/v1/monitorar-andamentos`;
        // Use service role key for reliable auto-continuation (anon key may lack permissions)
        const serviceKey = supabaseServiceKey;

        // Fire and forget - trigger next batch asynchronously
        fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ completeRun: true, execucaoId }),
        }).catch(err => {
          console.error('Error triggering next batch:', err);
        });

        console.log(`Batch processed, triggered next batch. Progress: ${progress.percentage}%`);
      }
    }

    if (isComplete && completeRun) {
      console.log('Complete run finished');
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancelled: results?.cancelled === true,
        message: isComplete 
          ? "Monitoramento completo de todos os processos" 
          : `Lote processado: ${results.currentOffset + 1} a ${results.nextOffset} de ${results.totalProcesses}`,
        results,
        isComplete,
        progress,
        continuingRun: completeRun && !isComplete,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in monitoring function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
