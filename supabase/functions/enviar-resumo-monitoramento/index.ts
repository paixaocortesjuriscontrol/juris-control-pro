import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResumoPayload {
  tipo_monitoramento: 'andamentos' | 'redistribuicoes' | 'distribuicoes' | 'djen' | 'djen_processos' | 'termos' | 'prazos' | 'audiencias' | 'intimacoes';
  resumos_por_coordenacao: {
    coordenacao_id: string;
    coordenacao_nome?: string;
    total_verificados: number;
    total_encontrados: number;
    exemplos: Array<{
      processo_numero: string;
      descricao: string;
      data?: string;
      titulo?: string;
    }>;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TAG = "[enviar-resumo-monitoramento]";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ResumoPayload = await req.json();
    const { tipo_monitoramento, resumos_por_coordenacao } = payload;

    if (!tipo_monitoramento || !resumos_por_coordenacao?.length) {
      console.log(`${TAG} Nenhum resumo para enviar`);
      return new Response(
        JSON.stringify({ message: "Nenhum resumo para enviar", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mapeamento de tipo para tipo_alerta (config_alertas_coordenacao)
    const tipoAlertaMap: Record<string, string> = {
      'andamentos': 'andamentos',
      'redistribuicoes': 'redistribuicoes',
      'distribuicoes': 'distribuicoes',
      'djen': 'djen',
      'djen_processos': 'djen',
      'termos': 'alertas360',
      'prazos': 'prazos',
      'audiencias': 'audiencias',
      'intimacoes': 'intimacoes',
    };

    const tipoAlerta = tipoAlertaMap[tipo_monitoramento] || tipo_monitoramento;

    const normalizeTipoAlerta = (s: string) => String(s || '').toLowerCase().replace(/_/g, '');

    // Mapeamento de ícones e títulos
    const iconMap: Record<string, string> = {
      'andamentos': '📋',
      'redistribuicoes': '🔄',
      'distribuicoes': '⚖️',
      'djen': '📰',
      'djen_processos': '📰',
      'termos': '🔍',
      'prazos': '⏰',
      'audiencias': '📅',
      'intimacoes': '📬',
    };

    const tituloMap: Record<string, string> = {
      'andamentos': 'Resumo de Andamentos',
      'redistribuicoes': 'Resumo de Redistribuições',
      'distribuicoes': 'Resumo de Novas Distribuições',
      'djen': 'Resumo DJEN Termos',
      'djen_processos': 'Resumo DJEN Processos',
      'termos': 'Resumo Monitoração 360°',
      'prazos': 'Resumo de Prazos',
      'audiencias': 'Resumo de Audiências',
      'intimacoes': 'Resumo de Intimações',
    };

    const resultados = { emails: 0, whatsapp: 0, erros: [] as string[] };

    for (const resumo of resumos_por_coordenacao) {
      const { coordenacao_id, coordenacao_nome, total_verificados, total_encontrados, exemplos } = resumo;

      // Só envia se encontrou algo
      if (total_encontrados === 0) {
        console.log(`${TAG} Coordenação ${coordenacao_id}: nenhum item encontrado, pulando`);
        continue;
      }

      // Buscar configuração da coordenação
      const { data: config, error: configError } = await supabase
        .from('config_alertas_coordenacao')
        .select('*')
        .eq('coordenacao_id', coordenacao_id)
        .maybeSingle();

      if (configError || !config) {
        console.log(`${TAG} Coordenação ${coordenacao_id} sem configuração de alertas`);
        continue;
      }

      // Verificar se o tipo de alerta está habilitado
      const tiposAlertasNorm = (config.tipos_alerta || []).map((t: any) => normalizeTipoAlerta(t));
      if (!tiposAlertasNorm.includes(normalizeTipoAlerta(tipoAlerta))) {
        console.log(`${TAG} Tipo de alerta "${tipoAlerta}" não habilitado para coordenação ${coordenacao_id}`);
        continue;
      }

      // Verificar horário de envio (usando horário de Brasília)
      const agora = new Date();
      const brasiliaOffset = -3 * 60;
      const localOffset = agora.getTimezoneOffset();
      const brasiliaTime = new Date(agora.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
      
      const horaAtual = brasiliaTime.toTimeString().slice(0, 5);
      const diaSemana = brasiliaTime.getDay();

      if (config.dias_semana && !config.dias_semana.includes(diaSemana)) {
        console.log(`${TAG} Fora dos dias permitidos para envio`);
        continue;
      }

      if (config.horario_inicio && config.horario_fim) {
        if (horaAtual < config.horario_inicio || horaAtual > config.horario_fim) {
          console.log(`${TAG} Fora do horário permitido: ${horaAtual}`);
          continue;
        }
      }

      // Buscar membros da coordenação
      const { data: membros } = await supabase
        .from('membros_coordenacao')
        .select(`
          usuario_id,
          profiles!membros_coordenacao_usuario_id_fkey (
            id, nome, email, telefone
          )
        `)
        .eq('coordenacao_id', coordenacao_id);

      const emailsDestino: string[] = [];
      const telefonesDestino: string[] = [];

      for (const membro of membros || []) {
        const profile = membro.profiles as any;
        if (profile?.email) emailsDestino.push(profile.email);
        if (profile?.telefone) telefonesDestino.push(profile.telefone);
      }

      // Construir mensagem de resumo
      const icon = iconMap[tipo_monitoramento] || '📊';
      const titulo = `${icon} ${tituloMap[tipo_monitoramento] || 'Resumo de Monitoramento'}`;
      
      // Função para limpar HTML e formatar texto
      const limparHtml = (texto: string): string => {
        if (!texto) return '';
        return texto
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      };

      // Formatar mensagem WhatsApp específica por tipo de monitoramento
      const formatarMensagemWhatsApp = (): string => {
        const dataHoje = brasiliaTime.toLocaleDateString('pt-BR');
        let mensagem = '';

        switch (tipo_monitoramento) {
          case 'djen':
            // DJEN Termos: Número do processo e termos encontrados
            mensagem = `📰 *RESUMO DJEN TERMOS*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} publicação(ões) encontrada(s)\n\n`;
            mensagem += `📋 *Lista de Publicações:*\n`;
            for (const ex of exemplos) {
              const termoLimpo = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  Termo: ${termoLimpo.substring(0, 150)}${termoLimpo.length > 150 ? '...' : ''}\n`;
            }
            break;

          case 'djen_processos':
            // DJEN Processos: Números dos processos com novas publicações
            mensagem = `📰 *RESUMO DJEN PROCESSOS*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} processo(s) com nova(s) publicação(ões)\n\n`;
            mensagem += `📋 *Processos Monitorados:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              if (descLimpa) {
                mensagem += `  ${descLimpa.substring(0, 100)}${descLimpa.length > 100 ? '...' : ''}\n`;
              }
            }
            break;

          case 'termos':
            // Alertas 360: Número do processo, termo e resumo
            mensagem = `🔍 *RESUMO MONITORAÇÃO 360°*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} alerta(s) encontrado(s)\n\n`;
            mensagem += `📋 *Alertas Detectados:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  ${descLimpa.substring(0, 150)}${descLimpa.length > 150 ? '...' : ''}\n`;
            }
            break;

          case 'redistribuicoes':
            // Redistribuições: Processo e detalhes da redistribuição
            mensagem = `🔄 *RESUMO DE REDISTRIBUIÇÕES*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} redistribuição(ões) detectada(s)\n\n`;
            mensagem += `📋 *Processos Redistribuídos:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  ${descLimpa}\n`;
            }
            break;

          case 'andamentos':
            // Andamentos: Número do processo e detalhe do andamento
            mensagem = `📋 *RESUMO DE ANDAMENTOS*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} andamento(s) encontrado(s)\n\n`;
            mensagem += `📋 *Movimentações:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  ${descLimpa.substring(0, 150)}${descLimpa.length > 150 ? '...' : ''}\n`;
            }
            break;

          case 'distribuicoes':
            // Distribuições: Número do processo e detalhes
            mensagem = `⚖️ *RESUMO DE NOVAS DISTRIBUIÇÕES*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} nova(s) distribuição(ões)\n\n`;
            mensagem += `📋 *Processos Distribuídos:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  ${descLimpa.substring(0, 150)}${descLimpa.length > 150 ? '...' : ''}\n`;
            }
            break;

          case 'prazos':
            // Prazos: Número do processo e prazo encontrado
            mensagem = `⏰ *RESUMO DE PRAZOS*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} prazo(s) detectado(s)\n\n`;
            mensagem += `📋 *Prazos:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              if (ex.data) mensagem += `  📆 Vencimento: ${ex.data}\n`;
              mensagem += `  ${descLimpa.substring(0, 120)}${descLimpa.length > 120 ? '...' : ''}\n`;
            }
            break;

          case 'audiencias':
            // Audiências: Número do processo, título e data
            mensagem = `📅 *RESUMO DE AUDIÊNCIAS*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} audiência(s) detectada(s)\n\n`;
            mensagem += `📋 *Audiências Agendadas:*\n`;
            for (const ex of exemplos) {
              mensagem += `\n• *${ex.processo_numero}*\n`;
              if (ex.titulo) mensagem += `  📌 ${ex.titulo}\n`;
              if (ex.data) mensagem += `  📆 Data: ${ex.data}\n`;
              if (ex.descricao) {
                const descLimpa = limparHtml(ex.descricao);
                if (descLimpa && descLimpa !== ex.titulo) {
                  mensagem += `  ${descLimpa.substring(0, 80)}${descLimpa.length > 80 ? '...' : ''}\n`;
                }
              }
            }
            break;

          case 'intimacoes':
            // Intimações: Número do processo e resumo
            mensagem = `📬 *RESUMO DE INTIMAÇÕES*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} intimação(ões) detectada(s)\n\n`;
            mensagem += `📋 *Intimações:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  ${descLimpa.substring(0, 150)}${descLimpa.length > 150 ? '...' : ''}\n`;
            }
            break;

          default:
            // Formato genérico
            mensagem = `📊 *RESUMO DE MONITORAMENTO*\n`;
            mensagem += `📅 ${dataHoje} | ${coordenacao_nome || 'Coordenação'}\n\n`;
            mensagem += `📊 ${total_encontrados} item(ns) encontrado(s)\n\n`;
            mensagem += `📋 *Detalhes:*\n`;
            for (const ex of exemplos) {
              const descLimpa = limparHtml(ex.descricao);
              mensagem += `\n• *${ex.processo_numero}*\n`;
              mensagem += `  ${descLimpa.substring(0, 150)}${descLimpa.length > 150 ? '...' : ''}\n`;
            }
        }

        mensagem += `\n_Juris Control Pro_`;
        return mensagem;
      };

      const mensagemTexto = formatarMensagemWhatsApp();
      const dataHoje = brasiliaTime.toLocaleDateString('pt-BR');
      const horaFormatada = brasiliaTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Gerar resumo de IA baseado nos dados
      const gerarResumoIA = (): string => {
        const qtd = total_encontrados;
        const coord = coordenacao_nome || 'sua coordenação';
        
        switch (tipo_monitoramento) {
          case 'djen':
            return `Foram identificadas <strong>${qtd} publicação(ões)</strong> no Diário de Justiça Eletrônico Nacional contendo os termos monitorados para ${coord}. Recomenda-se a análise prioritária para identificar possíveis intimações ou prazos processuais.`;
          case 'djen_processos':
            return `O sistema detectou <strong>${qtd} processo(s)</strong> com novas publicações no DJEN. Essas movimentações podem indicar decisões, despachos ou intimações que requerem atenção da equipe jurídica de ${coord}.`;
          case 'termos':
            return `A Monitoração 360° identificou <strong>${qtd} alerta(s)</strong> relevantes para ${coord}. Esses alertas foram gerados com base nos termos críticos configurados e podem indicar situações que exigem ação imediata.`;
          case 'redistribuicoes':
            return `Foram detectadas <strong>${qtd} redistribuição(ões)</strong> de processos sob responsabilidade de ${coord}. Alterações na distribuição processual podem impactar prazos e estratégias em andamento.`;
          case 'andamentos':
            return `O monitoramento identificou <strong>${qtd} nova(s) movimentação(ões)</strong> nos processos de ${coord}. A análise dessas movimentações permite acompanhamento proativo do andamento processual.`;
          case 'distribuicoes':
            return `O sistema detectou <strong>${qtd} nova(s) distribuição(ões)</strong> para ${coord}. Novos processos distribuídos requerem análise inicial e definição de estratégia de atuação.`;
          case 'prazos':
            return `Foram identificados <strong>${qtd} prazo(s)</strong> processual(is) para ${coord}. A gestão eficiente de prazos é essencial para evitar preclusões e garantir o cumprimento das obrigações processuais.`;
          case 'audiencias':
            return `O sistema detectou <strong>${qtd} audiência(s)</strong> agendada(s) para processos de ${coord}. A preparação antecipada para audiências é fundamental para o sucesso da atuação judicial.`;
          case 'intimacoes':
            return `Foram capturadas <strong>${qtd} intimação(ões)</strong> para processos de ${coord}. As intimações devem ser analisadas para identificação de prazos e providências necessárias.`;
          default:
            return `O monitoramento automático identificou <strong>${qtd} item(ns)</strong> relevantes para ${coord}. Recomenda-se a análise detalhada de cada item listado abaixo.`;
        }
      };

      // Gerar lista HTML específica por tipo de monitoramento
      const gerarListaHtmlEspecifica = (): string => {
        const items = exemplos.map(ex => {
          const descLimpa = limparHtml(ex.descricao);
          
          switch (tipo_monitoramento) {
            case 'djen':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                  <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; font-size: 15px;">📰 ${ex.processo_numero}</div>
                  <div style="color: #78350f; font-size: 13px; line-height: 1.5;">
                    <strong>Termo encontrado:</strong><br/>
                    ${descLimpa}
                  </div>
                </div>`;
            
            case 'djen_processos':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #dbeafe; border-radius: 8px; border-left: 4px solid #3b82f6;">
                  <div style="font-weight: 600; color: #1e40af; margin-bottom: 8px; font-size: 15px;">📄 ${ex.processo_numero}</div>
                  ${descLimpa ? `<div style="color: #1e3a8a; font-size: 13px; line-height: 1.5;">${descLimpa}</div>` : ''}
                </div>`;
            
            case 'termos':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #fce7f3; border-radius: 8px; border-left: 4px solid #ec4899;">
                  <div style="font-weight: 600; color: #9d174d; margin-bottom: 8px; font-size: 15px;">🔍 ${ex.processo_numero}</div>
                  ${ex.titulo ? `<div style="color: #831843; font-size: 14px; font-weight: 500; margin-bottom: 4px;">📌 ${ex.titulo}</div>` : ''}
                  <div style="color: #831843; font-size: 13px; line-height: 1.5;">${descLimpa}</div>
                </div>`;
            
            case 'redistribuicoes':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #fef9c3; border-radius: 8px; border-left: 4px solid #eab308;">
                  <div style="font-weight: 600; color: #713f12; margin-bottom: 8px; font-size: 15px;">🔄 ${ex.processo_numero}</div>
                  <div style="color: #854d0e; font-size: 13px; line-height: 1.5;">
                    <strong>Detalhes da redistribuição:</strong><br/>
                    ${descLimpa}
                  </div>
                </div>`;
            
            case 'andamentos':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
                  <div style="font-weight: 600; color: #166534; margin-bottom: 8px; font-size: 15px;">📋 ${ex.processo_numero}</div>
                  <div style="color: #15803d; font-size: 13px; line-height: 1.5;">
                    <strong>Movimentação:</strong><br/>
                    ${descLimpa}
                  </div>
                </div>`;
            
            case 'distribuicoes':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #ede9fe; border-radius: 8px; border-left: 4px solid #8b5cf6;">
                  <div style="font-weight: 600; color: #5b21b6; margin-bottom: 8px; font-size: 15px;">⚖️ ${ex.processo_numero}</div>
                  <div style="color: #6b21a8; font-size: 13px; line-height: 1.5;">
                    <strong>Detalhes da distribuição:</strong><br/>
                    ${descLimpa}
                  </div>
                </div>`;
            
            case 'prazos':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                  <div style="font-weight: 600; color: #991b1b; margin-bottom: 8px; font-size: 15px;">⏰ ${ex.processo_numero}</div>
                  ${ex.data ? `<div style="color: #b91c1c; font-size: 14px; font-weight: 500; margin-bottom: 4px;">📆 Vencimento: ${ex.data}</div>` : ''}
                  <div style="color: #b91c1c; font-size: 13px; line-height: 1.5;">${descLimpa}</div>
                </div>`;
            
            case 'audiencias':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #e0f2fe; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                  <div style="font-weight: 600; color: #0c4a6e; margin-bottom: 8px; font-size: 15px;">📅 ${ex.processo_numero}</div>
                  ${ex.titulo ? `<div style="color: #075985; font-size: 14px; font-weight: 500; margin-bottom: 4px;">📌 ${ex.titulo}</div>` : ''}
                  ${ex.data ? `<div style="color: #075985; font-size: 14px; font-weight: 500; margin-bottom: 4px;">📆 Data: ${ex.data}</div>` : ''}
                  ${descLimpa && descLimpa !== ex.titulo ? `<div style="color: #0369a1; font-size: 13px; line-height: 1.5;">${descLimpa}</div>` : ''}
                </div>`;
            
            case 'intimacoes':
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #f5f3ff; border-radius: 8px; border-left: 4px solid #7c3aed;">
                  <div style="font-weight: 600; color: #5b21b6; margin-bottom: 8px; font-size: 15px;">📬 ${ex.processo_numero}</div>
                  <div style="color: #6b21a8; font-size: 13px; line-height: 1.5;">
                    <strong>Resumo da intimação:</strong><br/>
                    ${descLimpa}
                  </div>
                </div>`;
            
            default:
              return `
                <div style="margin-bottom: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                  <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px; font-size: 15px;">📄 ${ex.processo_numero}</div>
                  <div style="color: #4b5563; font-size: 13px; line-height: 1.5;">${descLimpa}</div>
                </div>`;
          }
        });
        
        return items.join('');
      };

      // Obter label dinâmico para o contador
      const getLabelEncontrados = (): string => {
        switch (tipo_monitoramento) {
          case 'djen': return 'Publicações Encontradas';
          case 'djen_processos': return 'Processos com Publicações';
          case 'termos': return 'Alertas Detectados';
          case 'redistribuicoes': return 'Redistribuições';
          case 'andamentos': return 'Movimentações';
          case 'distribuicoes': return 'Novas Distribuições';
          case 'prazos': return 'Prazos Detectados';
          case 'audiencias': return 'Audiências Agendadas';
          case 'intimacoes': return 'Intimações Capturadas';
          default: return 'Itens Encontrados';
        }
      };

      const resumoIA = gerarResumoIA();
      const listaHtml = gerarListaHtmlEspecifica();
      const labelEncontrados = getLabelEncontrados();

      const mensagemHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8fafc;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${icon} ${tituloMap[tipo_monitoramento] || 'Resumo de Monitoramento'}</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 15px;">${coordenacao_nome || 'Coordenação'}</p>
            <p style="margin: 4px 0 0 0; opacity: 0.7; font-size: 13px;">📅 ${dataHoje} às ${horaFormatada}</p>
          </div>
          
          <!-- Stats Cards -->
          <div style="padding: 24px; background: white; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              <tr>
                <td width="48%" style="padding: 20px; background: #f3f4f6; border-radius: 12px; text-align: center;">
                  <div style="font-size: 36px; font-weight: bold; color: #6b7280;">${total_verificados}</div>
                  <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; margin-top: 4px;">Processos Verificados</div>
                </td>
                <td width="4%"></td>
                <td width="48%" style="padding: 20px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; text-align: center;">
                  <div style="font-size: 36px; font-weight: bold; color: #059669;">${total_encontrados}</div>
                  <div style="font-size: 12px; color: #047857; text-transform: uppercase; margin-top: 4px;">${labelEncontrados}</div>
                </td>
              </tr>
            </table>
            
            <!-- AI Summary -->
            <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #6366f1;">
              <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 18px; margin-right: 8px;">🤖</span>
                <span style="font-weight: 600; color: #4338ca; font-size: 14px; text-transform: uppercase;">Análise Inteligente</span>
              </div>
              <p style="margin: 0; color: #3730a3; font-size: 14px; line-height: 1.6;">${resumoIA}</p>
            </div>
            
            <!-- List Header -->
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
              📋 Detalhamento Completo
            </h2>
            
            <!-- Items List -->
            ${listaHtml}
          </div>
          
          <!-- Footer -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 24px; border-radius: 0 0 12px 12px; text-align: center;">
            <div style="margin-bottom: 12px;">
              <span style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #d4a015 0%, #eab308 100%); border-radius: 8px; line-height: 40px; font-size: 20px;">⚖️</span>
            </div>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #e2e8f0; font-weight: 500;">
              Juris Control | Paixão Cortes Advogados
            </p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #94a3b8;">
              Este é um resumo automático gerado pelo sistema
            </p>
            <p style="margin: 0; font-size: 11px; color: #64748b;">
              Para mais detalhes, acesse <a href="https://juriscontrol.adv.br" style="color: #eab308; text-decoration: none; font-weight: 500;">juriscontrol.adv.br</a>
            </p>
          </div>
        </div>
      `;

      // Enviar E-mails
      if (config.email_habilitado && emailsDestino.length > 0) {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        
        if (resendApiKey) {
          console.log(`${TAG} Enviando emails para ${emailsDestino.length} destinatários: ${emailsDestino.join(', ')}`);
          
          for (const email of emailsDestino) {
            try {
              console.log(`${TAG} Enviando email para ${email}...`);
              
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: "Juris Control <alerta@juriscontrol.adv.br>",
                  to: [email],
                  subject: titulo,
                  html: mensagemHtml,
                }),
              });

              if (response.ok) {
                const responseData = await response.json();
                console.log(`${TAG} ✅ Email enviado para ${email}: ${JSON.stringify(responseData)}`);
                resultados.emails++;
                await supabase.from('historico_alertas_enviados').insert({
                  coordenacao_id,
                  tipo_alerta: tipoAlerta,
                  canal: 'email',
                  destinatario: email,
                  conteudo: `Resumo: ${total_encontrados} itens encontrados`,
                  status: 'enviado',
                });
              } else {
                const errorText = await response.text();
                console.error(`${TAG} ❌ Erro ao enviar email para ${email}: ${response.status} - ${errorText}`);
                resultados.erros.push(`Email para ${email}: ${errorText}`);
                
                // Registrar erro no histórico
                await supabase.from('historico_alertas_enviados').insert({
                  coordenacao_id,
                  tipo_alerta: tipoAlerta,
                  canal: 'email',
                  destinatario: email,
                  conteudo: `Resumo: ${total_encontrados} itens encontrados`,
                  status: 'erro',
                  erro: errorText.substring(0, 500),
                });
              }
              
              // Pequeno delay entre envios para evitar rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (error: any) {
              console.error(`${TAG} ❌ Exceção ao enviar email para ${email}:`, error);
              resultados.erros.push(`Email para ${email}: ${error?.message || 'Erro'}`);
            }
          }
        } else {
          console.warn(`${TAG} RESEND_API_KEY não configurada`);
        }
      }

      // Enviar WhatsApp
      if (config.whatsapp_habilitado && telefonesDestino.length > 0) {
        const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
        const zapiToken = Deno.env.get("ZAPI_TOKEN");
        const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

        if (zapiInstanceId && zapiToken) {
          for (const telefone of telefonesDestino) {
            try {
              let phoneFormatted = telefone.replace(/\D/g, '');
              if (!phoneFormatted.startsWith('55')) {
                phoneFormatted = '55' + phoneFormatted;
              }
              if (phoneFormatted.length === 12 && phoneFormatted.startsWith('55')) {
                const ddd = phoneFormatted.slice(2, 4);
                const numero = phoneFormatted.slice(4);
                phoneFormatted = `55${ddd}9${numero}`;
              }

              const response = await fetch(
                `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Client-Token": zapiClientToken || "",
                  },
                  body: JSON.stringify({
                    phone: phoneFormatted,
                    message: mensagemTexto,
                  }),
                }
              );

              if (response.ok) {
                resultados.whatsapp++;
                await supabase.from('historico_alertas_enviados').insert({
                  coordenacao_id,
                  tipo_alerta: tipoAlerta,
                  canal: 'whatsapp',
                  destinatario: telefone,
                  conteudo: `Resumo: ${total_encontrados} itens encontrados`,
                  status: 'enviado',
                });
              } else {
                const errorText = await response.text();
                resultados.erros.push(`WhatsApp para ${telefone}: ${errorText}`);
              }
            } catch (error: any) {
              console.error(`${TAG} Erro ao enviar WhatsApp para ${telefone}:`, error);
              resultados.erros.push(`WhatsApp para ${telefone}: ${error?.message || 'Erro'}`);
            }
          }
        }
      }
    }

    console.log(`${TAG} Resumos enviados: ${resultados.emails} emails, ${resultados.whatsapp} whatsapp`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados: resultados.emails + resultados.whatsapp,
        detalhes: resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`${TAG} Erro:`, error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
