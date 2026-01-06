import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TermoMonitoramento {
  id: string;
  termo: string;
  categoria: string;
  prioridade: string;
}

// Padrões para detectar audiências
const AUDIENCIA_PATTERNS = [
  /audiência.*(?:designada|marcada|realizada|agendada)/i,
  /(?:designada|marcada|agendada).*audiência/i,
  /pauta.*audiência/i,
  /audiência.*(?:conciliação|instrução|julgamento|una)/i,
  /(?:intimado|intimação).*audiência/i,
  /data.*audiência.*(\d{2}\/\d{2}\/\d{4})/i,
];

// Padrões para detectar intimações
const INTIMACAO_PATTERNS = [
  /intim(?:ado|ação|ar)/i,
  /prazo.*(?:\d+)\s*dias/i,
  /manifesta(?:r|ção)/i,
  /ciência/i,
  /notifica(?:do|ção)/i,
  /cumpra-se/i,
  /despacho.*intim/i,
];

// Extrair data de audiência do texto
function extractAudienciaDate(text: string): string | null {
  const patterns = [
    /(\d{2}\/\d{2}\/\d{4})\s*[àa]?s?\s*(\d{1,2}[h:]\d{2})?/i,
    /dia\s*(\d{1,2})\s*(?:de\s*)?(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s*)?(\d{4})?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[1].includes('/')) {
        const [day, month, year] = match[1].split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }
  return null;
}

// Extrair hora da audiência
function extractAudienciaHora(text: string): string | null {
  const patterns = [
    /(\d{1,2})[h:](\d{2})/i,
    /às?\s*(\d{1,2})\s*horas?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const hora = match[1].padStart(2, '0');
      const minutos = match[2] ? match[2].padStart(2, '0') : '00';
      return `${hora}:${minutos}`;
    }
  }
  return null;
}

// Extrair prazo em dias
function extractPrazoDias(text: string): number | null {
  const match = text.match(/prazo\s*(?:de\s*)?(\d+)\s*dias?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Detectar tipo de audiência
function detectTipoAudiencia(text: string): string {
  const textLower = text.toLowerCase();
  if (textLower.includes('conciliação') || textLower.includes('conciliatória')) return 'Conciliação';
  if (textLower.includes('instrução')) return 'Instrução';
  if (textLower.includes('julgamento')) return 'Julgamento';
  if (textLower.includes('una')) return 'Una';
  if (textLower.includes('inicial')) return 'Inicial';
  return 'Geral';
}

// Detectar tipo de intimação
function detectTipoIntimacao(text: string): string {
  const textLower = text.toLowerCase();
  if (textLower.includes('manifestar') || textLower.includes('manifestação')) return 'Manifestação';
  if (textLower.includes('contestar') || textLower.includes('contestação')) return 'Contestação';
  if (textLower.includes('recurso') || textLower.includes('recorrer')) return 'Recurso';
  if (textLower.includes('cumprimento') || textLower.includes('cumprir')) return 'Cumprimento';
  if (textLower.includes('ciência')) return 'Ciência';
  if (textLower.includes('pagamento') || textLower.includes('pagar')) return 'Pagamento';
  return 'Geral';
}

async function notifyCoordination(
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

    console.log(`Notified ${usersToNotify.length} users about alert for term "${termo}"`);
  } catch (error) {
    console.error('Error notifying coordination:', error);
  }
}

async function registrarAudienciaDetectada(
  supabase: any,
  processoId: string,
  processoNumero: string,
  descricao: string,
  movimentacaoId: string
) {
  try {
    // Verificar se já existe audiência para essa movimentação
    const { data: existing } = await supabase
      .from('audiencias_detectadas')
      .select('id')
      .eq('movimentacao_id', movimentacaoId)
      .single();

    if (existing) {
      console.log(`Audiência já registrada para movimentação ${movimentacaoId}`);
      return null;
    }

    const dataAudiencia = extractAudienciaDate(descricao);
    const horaAudiencia = extractAudienciaHora(descricao);
    const tipoAudiencia = detectTipoAudiencia(descricao);

    const audiencia = {
      processo_id: processoId,
      processo_numero: processoNumero,
      data_audiencia: dataAudiencia,
      hora: horaAudiencia,
      tipo_audiencia: tipoAudiencia,
      conteudo_publicacao: descricao.substring(0, 2000),
      contexto: descricao.substring(0, 500),
      status: 'pendente',
      origem: 'monitoracao_360',
    };

    const { data, error } = await supabase
      .from('audiencias_detectadas')
      .insert(audiencia)
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao inserir audiência:', error);
      return null;
    }

    console.log(`Audiência detectada e registrada: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('Erro em registrarAudienciaDetectada:', error);
    return null;
  }
}

async function registrarIntimacaoDetectada(
  supabase: any,
  processoId: string,
  processoNumero: string,
  descricao: string,
  movimentacaoId: string
) {
  try {
    // Verificar se já existe intimação para essa movimentação
    const { data: existing } = await supabase
      .from('intimacoes_detectadas')
      .select('id')
      .eq('movimentacao_id', movimentacaoId)
      .single();

    if (existing) {
      console.log(`Intimação já registrada para movimentação ${movimentacaoId}`);
      return null;
    }

    const prazoDias = extractPrazoDias(descricao);
    const tipoIntimacao = detectTipoIntimacao(descricao);
    
    // Calcular data limite se prazo encontrado
    let dataLimite: string | null = null;
    if (prazoDias) {
      const hoje = new Date();
      hoje.setDate(hoje.getDate() + prazoDias);
      dataLimite = hoje.toISOString().split('T')[0];
    }

    const intimacao = {
      processo_id: processoId,
      processo_numero: processoNumero,
      movimentacao_id: movimentacaoId,
      tipo_intimacao: tipoIntimacao,
      descricao: descricao.substring(0, 500),
      conteudo_publicacao: descricao.substring(0, 2000),
      contexto: descricao.substring(0, 500),
      prazo_dias: prazoDias,
      data_limite: dataLimite,
      data_intimacao: new Date().toISOString(),
      status: 'pendente',
      prioridade: prazoDias && prazoDias <= 5 ? 'urgente' : prazoDias && prazoDias <= 10 ? 'alta' : 'media',
      origem: 'monitoracao_360',
    };

    const { data, error } = await supabase
      .from('intimacoes_detectadas')
      .insert(intimacao)
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao inserir intimação:', error);
      return null;
    }

    console.log(`Intimação detectada e registrada: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('Erro em registrarIntimacaoDetectada:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting term monitoring scan...');

    // Buscar termos ativos
    const { data: termos, error: termosError } = await supabase
      .from('termos_monitoramento')
      .select('id, termo, categoria, prioridade')
      .eq('ativo', true);

    if (termosError) throw termosError;

    if (!termos || termos.length === 0) {
      console.log('No active terms configured');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum termo configurado', alertasGerados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${termos.length} active terms`);

    // Buscar movimentações com dados do processo
    const { data: movimentacoes, error: movError } = await supabase
      .from('movimentacoes')
      .select('id, processo_id, descricao, data_movimentacao, processo:processos(numero)')
      .order('data_movimentacao', { ascending: false })
      .limit(2000);

    if (movError) throw movError;

    console.log(`Scanning ${movimentacoes?.length || 0} movements`);

    // Buscar alertas existentes para evitar duplicatas
    const { data: alertasExistentes } = await supabase
      .from('alertas_monitoramento')
      .select('movimentacao_id, termo_id');

    const alertasSet = new Set(
      (alertasExistentes || []).map(a => `${a.movimentacao_id}-${a.termo_id}`)
    );

    let alertasGerados = 0;
    let notificacoesEnviadas = 0;
    let audienciasDetectadas = 0;
    let intimacoesDetectadas = 0;
    const novosAlertas: any[] = [];
    const alertasParaNotificar: Array<{ processoId: string; termo: string; prioridade: string; contexto: string }> = [];
    const movimentacoesProcessadas = new Set<string>();

    // Varrer movimentações buscando termos
    for (const mov of movimentacoes || []) {
      const descricaoLower = mov.descricao.toLowerCase();
      const processoNumero = (mov.processo as any)?.numero || '';

      for (const termo of termos) {
        const termoLower = termo.termo.toLowerCase();
        
        if (descricaoLower.includes(termoLower)) {
          const key = `${mov.id}-${termo.id}`;
          
          if (!alertasSet.has(key)) {
            const index = descricaoLower.indexOf(termoLower);
            const start = Math.max(0, index - 50);
            const end = Math.min(mov.descricao.length, index + termo.termo.length + 50);
            const contexto = (start > 0 ? '...' : '') + 
                            mov.descricao.slice(start, end) + 
                            (end < mov.descricao.length ? '...' : '');

            novosAlertas.push({
              termo_id: termo.id,
              processo_id: mov.processo_id,
              movimentacao_id: mov.id,
              termo_encontrado: termo.termo,
              contexto,
              prioridade: termo.prioridade,
              status: 'pendente',
            });

            alertasParaNotificar.push({
              processoId: mov.processo_id,
              termo: termo.termo,
              prioridade: termo.prioridade,
              contexto,
            });

            alertasSet.add(key);
            alertasGerados++;

            // Detectar audiências e intimações (uma vez por movimentação)
            if (!movimentacoesProcessadas.has(mov.id)) {
              movimentacoesProcessadas.add(mov.id);

              // Verificar se é uma audiência
              const isAudiencia = AUDIENCIA_PATTERNS.some(pattern => pattern.test(mov.descricao));
              if (isAudiencia) {
                const audienciaId = await registrarAudienciaDetectada(
                  supabase,
                  mov.processo_id,
                  processoNumero,
                  mov.descricao,
                  mov.id
                );
                if (audienciaId) audienciasDetectadas++;
              }

              // Verificar se é uma intimação
              const isIntimacao = INTIMACAO_PATTERNS.some(pattern => pattern.test(mov.descricao));
              if (isIntimacao) {
                const intimacaoId = await registrarIntimacaoDetectada(
                  supabase,
                  mov.processo_id,
                  processoNumero,
                  mov.descricao,
                  mov.id
                );
                if (intimacaoId) intimacoesDetectadas++;
              }
            }
          }
        }
      }
    }

    // Inserir alertas em lotes
    if (novosAlertas.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < novosAlertas.length; i += BATCH_SIZE) {
        const batch = novosAlertas.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('alertas_monitoramento')
          .insert(batch);

        if (insertError) {
          console.error('Error inserting alerts batch:', insertError);
        }
      }
    }

    // Enviar notificações (limitar a 20)
    const alertasParaNotificarLimitados = alertasParaNotificar.slice(0, 20);
    for (const alerta of alertasParaNotificarLimitados) {
      await notifyCoordination(
        supabase,
        alerta.processoId,
        alerta.termo,
        alerta.prioridade,
        alerta.contexto
      );
      notificacoesEnviadas++;
    }

    console.log(`Scan complete. Generated ${alertasGerados} alerts, ${audienciasDetectadas} hearings, ${intimacoesDetectadas} summons, sent ${notificacoesEnviadas} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertasGerados,
        audienciasDetectadas,
        intimacoesDetectadas,
        notificacoesEnviadas,
        movimentacoesVerificadas: movimentacoes?.length || 0,
        termosAtivos: termos.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in term monitoring:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
