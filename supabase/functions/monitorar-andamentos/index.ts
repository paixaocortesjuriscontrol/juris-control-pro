import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Erro ao registrar intimação:', error);
    return null;
  }
  
  console.log(`Intimação detectada para processo ${processoNumero}: ${tipo}`);
  
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
      data_audiencia: data?.toISOString() || null,
      tipo_audiencia: tipo,
      contexto,
      conteudo_publicacao: descricao,
      status: 'pendente',
    })
    .select('id')
    .single();
  
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numeroLimpo } }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const hits = data.hits?.hits || [];
    
    if (hits.length === 0) return null;

    return hits[0]._source;
  } catch (error) {
    console.error(`Error querying process ${numeroProcesso}:`, error);
    return null;
  }
}

// Processa um único lote de processos
async function processBatch(supabase: any): Promise<{
  isComplete: boolean;
  results: any;
  progress: { current: number; total: number; percentage: number };
}> {
  // Reduced batch size to avoid WORKER_LIMIT errors
  const PROCESSES_PER_RUN = 50;
  
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
    errors: 0,
    totalProcesses: totalCount || 0,
    currentOffset,
    nextOffset: currentOffset + (processos?.length || 0),
    details: [] as any[]
  };

  // Process in parallel batches (5 concurrent requests to avoid resource limits)
  const PARALLEL_BATCH_SIZE = 5;

  for (let i = 0; i < (processos?.length || 0); i += PARALLEL_BATCH_SIZE) {
    const batch = processos!.slice(i, i + PARALLEL_BATCH_SIZE);
    
    const batchPromises = batch.map(async (processo: any) => {
      try {
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

        for (const mov of recentMovimentos) {
          const movName = mov.nome || mov.movimentoNacional?.nome || 'Movimento';
          let descricaoCompleta = movName;
          
          // Add complement if available
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
              const { data: insertedMov, error: insertError } = await supabase
                .from('movimentacoes')
                .insert({
                  processo_id: processo.id,
                  descricao: descricaoCompleta,
                  data_movimentacao: movDate,
                  tipo: movName,
                  fonte: 'DataJud/CNJ'
                })
                .select('id')
                .single();

              if (!insertError && insertedMov) {
                insertedCount++;
                existingSet.add(key);
                newMovementDetails.push(descricaoCompleta.substring(0, 50));

                // Varredura automática de termos no novo andamento
                await scanMovementForTerms(supabase, insertedMov.id, processo.id, descricaoCompleta);
                
                // Detectar audiências no andamento
                await registrarAudienciaDetectada(
                  supabase,
                  processo.id,
                  processo.numero,
                  insertedMov.id,
                  descricaoCompleta,
                  movDate
                );
                
                // Detectar intimações no andamento
                await registrarIntimacaoDetectada(
                  supabase,
                  processo.id,
                  processo.numero,
                  insertedMov.id,
                  descricaoCompleta,
                  movDate
                );
              }
            }
        }

        if (insertedCount > 0) {
          results.newMovements += insertedCount;
          results.processesWithNewMovements++;

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

          // Create notifications
          for (const userId of usersToNotify) {
            await supabase
              .from('notificacoes')
              .insert({
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
              });
          }

          // Send email to users who have email notifications enabled
          const { data: usersWithEmail } = await supabase
            .from('profiles')
            .select('id, email, nome')
            .in('id', usersToNotify)
            .eq('notificacoes_email', true);

          for (const user of usersWithEmail || []) {
            try {
              await resend.emails.send({
                from: 'Juris Control <noreply@juriscontrol.adv.br>',
                to: user.email,
                subject: `Novos andamentos - Processo ${processo.numero}`,
                html: `
                  <h2>Novos Andamentos Detectados</h2>
                  <p>Olá ${user.nome},</p>
                  <p>Foram encontrados <strong>${insertedCount}</strong> novo(s) andamento(s) no processo <strong>${processo.numero}</strong>.</p>
                  <h3>Detalhes:</h3>
                  <ul>
                    ${newMovementDetails.map(d => `<li>${d}</li>`).join('')}
                  </ul>
                  <p><a href="https://juriscontrol.adv.br/processos/${processo.id}">Visualizar processo</a></p>
                `
              });
            } catch (emailError) {
              console.error(`Error sending email to ${user.email}:`, emailError);
            }
          }

          results.details.push({
            processo: processo.numero,
            novosAndamentos: insertedCount,
            detalhes: newMovementDetails
          });
        }

      } catch (error) {
        console.error(`Error processing ${processo.numero}:`, error);
        results.errors++;
      }
    });

    await Promise.all(batchPromises);
  }

  // Calculate next offset and check if complete
  const nextOffset = currentOffset + (processos?.length || 0);
  const isComplete = nextOffset >= (totalCount || 0);
  
  // Update metadata and ultima_execucao
  const newMetadata = {
    next_offset: isComplete ? 0 : nextOffset,
    last_batch_size: processos?.length || 0,
    last_complete_run: isComplete ? new Date().toISOString() : (lastCompleteRun?.toISOString() || null)
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
  if (isComplete) {
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
  }

  console.log("Batch monitoring completed:", results);
  
  return {
    isComplete,
    results,
    progress: {
      current: nextOffset,
      total: totalCount || 0,
      percentage: Math.round((nextOffset / (totalCount || 1)) * 100)
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for completeRun parameter
    let completeRun = false;
    try {
      const body = await req.json();
      completeRun = body?.completeRun === true;
    } catch {
      // No body or invalid JSON, proceed with single batch
    }

    console.log(`Starting andamentos monitoring... (completeRun: ${completeRun})`);

    // Clear terms cache at start
    termosCache = null;

    if (completeRun) {
      // Execute complete run - process all batches until done
      let totalResults = {
        checked: 0,
        newMovements: 0,
        processesWithNewMovements: 0,
        errors: 0,
      };
      let batchCount = 0;
      let lastProgress = { current: 0, total: 0, percentage: 0 };

      while (true) {
        batchCount++;
        console.log(`Processing batch ${batchCount}...`);
        
        const { isComplete, results, progress } = await processBatch(supabase);
        
        totalResults.checked += results.checked;
        totalResults.newMovements += results.newMovements;
        totalResults.processesWithNewMovements += results.processesWithNewMovements;
        totalResults.errors += results.errors;
        lastProgress = progress;

        if (isComplete) {
          console.log(`Complete run finished after ${batchCount} batches`);
          break;
        }

        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Monitoramento completo: ${totalResults.checked} processos verificados, ${totalResults.newMovements} novos andamentos`,
          results: totalResults,
          isComplete: true,
          batchCount,
          progress: lastProgress
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Single batch execution
      const { isComplete, results, progress } = await processBatch(supabase);

      return new Response(
        JSON.stringify({
          success: true,
          message: isComplete 
            ? "Monitoramento completo de todos os processos" 
            : `Lote processado: ${results.currentOffset + 1} a ${results.nextOffset} de ${results.totalProcesses}`,
          results,
          isComplete,
          progress
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
