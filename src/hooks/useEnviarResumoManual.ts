import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TipoMonitoramento = 'andamentos' | 'redistribuicoes' | 'distribuicoes' | 'djen' | 'djen_processos' | 'termos';

interface ResumoPayload {
  coordenacao_id: string;
  coordenacao_nome: string;
  total_verificados: number;
  total_encontrados: number;
  exemplos: Array<{
    processo_numero: string;
    descricao: string;
  }>;
}

export function useEnviarResumoManual() {
  const [enviando, setEnviando] = useState<Record<string, boolean>>({});

  const enviarResumo = async (tipo: TipoMonitoramento) => {
    setEnviando(prev => ({ ...prev, [tipo]: true }));
    
    try {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString();
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString();

      let resumosPorCoordenacao: ResumoPayload[] = [];

      switch (tipo) {
        case 'andamentos': {
          // Buscar movimentações de hoje (exceto redistribuições)
          const { data: movimentacoes } = await supabase
            .from('movimentacoes')
            .select(`
              id,
              descricao,
              processos!inner (
                id,
                numero,
                coordenacao_id,
                coordenacoes (id, nome)
              )
            `)
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia)
            .neq('tipo', 'Redistribuição');

          // Agrupar por coordenação
          const porCoordenacao = new Map<string, ResumoPayload>();
          for (const mov of movimentacoes || []) {
            const processo = (mov as any).processos;
            if (!processo?.coordenacao_id) continue;
            
            const coordId = processo.coordenacao_id;
            const coordNome = processo.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                total_verificados: 0,
                total_encontrados: 0,
                exemplos: []
              });
            }
            
            const coord = porCoordenacao.get(coordId)!;
            coord.total_encontrados++;
            coord.exemplos.push({
              processo_numero: processo.numero || 'N/A',
              descricao: mov.descricao || 'Movimentação detectada'
            });
          }
          resumosPorCoordenacao = Array.from(porCoordenacao.values());
          break;
        }
        
        case 'redistribuicoes': {
          const { data: movimentacoes } = await supabase
            .from('movimentacoes')
            .select(`
              id,
              descricao,
              processos!inner (
                id,
                numero,
                coordenacao_id,
                coordenacoes (id, nome)
              )
            `)
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia)
            .eq('tipo', 'Redistribuição');

          const porCoordenacao = new Map<string, ResumoPayload>();
          for (const mov of movimentacoes || []) {
            const processo = (mov as any).processos;
            if (!processo?.coordenacao_id) continue;
            
            const coordId = processo.coordenacao_id;
            const coordNome = processo.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                total_verificados: 0,
                total_encontrados: 0,
                exemplos: []
              });
            }
            
            const coord = porCoordenacao.get(coordId)!;
            coord.total_encontrados++;
            
            // Parse da descrição para extrair varas
            const match = mov.descricao?.match(/Redistribuição detectada: (.+) -> (.+)/);
            const descricaoFormatada = match 
              ? `${match[1]} → ${match[2]}`
              : mov.descricao || 'Redistribuição detectada';
            
            coord.exemplos.push({
              processo_numero: processo.numero || 'N/A',
              descricao: descricaoFormatada
            });
          }
          resumosPorCoordenacao = Array.from(porCoordenacao.values());
          break;
        }
        
        case 'distribuicoes': {
          const { data: distribuicoes } = await supabase
            .from('distribuicoes_encontradas')
            .select(`
              id,
              numero_processo,
              polo_ativo,
              polo_passivo,
              vara,
              monitoramentos_distribuicao!inner (
                id,
                coordenacao_id,
                coordenacoes (id, nome)
              )
            `)
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia);

          const porCoordenacao = new Map<string, ResumoPayload>();
          for (const dist of distribuicoes || []) {
            const mon = (dist as any).monitoramentos_distribuicao;
            if (!mon?.coordenacao_id) continue;
            
            const coordId = mon.coordenacao_id;
            const coordNome = mon.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                total_verificados: 0,
                total_encontrados: 0,
                exemplos: []
              });
            }
            
            const coord = porCoordenacao.get(coordId)!;
            coord.total_encontrados++;
            coord.exemplos.push({
              processo_numero: dist.numero_processo || 'N/A',
              descricao: `${dist.polo_ativo || ''} x ${dist.polo_passivo || ''} - ${dist.vara || ''}`
            });
          }
          resumosPorCoordenacao = Array.from(porCoordenacao.values());
          break;
        }
        
        case 'djen': {
          const { data: publicacoes } = await supabase
            .from('publicacoes_djen')
            .select(`
              id,
              conteudo,
              processo_numero,
              monitoramentos_djen!inner (
                id,
                coordenacao_id,
                coordenacoes (id, nome)
              )
            `)
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia);

          const porCoordenacao = new Map<string, ResumoPayload>();
          for (const pub of publicacoes || []) {
            const mon = (pub as any).monitoramentos_djen;
            if (!mon?.coordenacao_id) continue;
            
            const coordId = mon.coordenacao_id;
            const coordNome = mon.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                total_verificados: 0,
                total_encontrados: 0,
                exemplos: []
              });
            }
            
            // Extrair número do processo do conteúdo se não houver
            let numeroProcesso = pub.processo_numero;
            if (!numeroProcesso && pub.conteudo) {
              const match = pub.conteudo.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
              numeroProcesso = match ? match[0] : 'N/A';
            }
            
            const coord = porCoordenacao.get(coordId)!;
            coord.total_encontrados++;
            coord.exemplos.push({
              processo_numero: numeroProcesso || 'N/A',
              descricao: (pub.conteudo || 'Publicação DJEN').substring(0, 100) + '...'
            });
          }
          resumosPorCoordenacao = Array.from(porCoordenacao.values());
          break;
        }
        
        case 'djen_processos': {
          const { data: publicacoes } = await supabase
            .from('publicacoes_djen_processos')
            .select(`
              id,
              conteudo,
              processos!inner (
                id,
                numero,
                coordenacao_id,
                coordenacoes (id, nome)
              )
            `)
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia);

          const porCoordenacao = new Map<string, ResumoPayload>();
          for (const pub of publicacoes || []) {
            const processo = (pub as any).processos;
            if (!processo?.coordenacao_id) continue;
            
            const coordId = processo.coordenacao_id;
            const coordNome = processo.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                total_verificados: 0,
                total_encontrados: 0,
                exemplos: []
              });
            }
            
            const coord = porCoordenacao.get(coordId)!;
            coord.total_encontrados++;
            coord.exemplos.push({
              processo_numero: processo.numero || 'N/A',
              descricao: (pub.conteudo || 'Publicação DJEN').substring(0, 100) + '...'
            });
          }
          resumosPorCoordenacao = Array.from(porCoordenacao.values());
          break;
        }
        
        case 'termos': {
          const { data: alertas } = await supabase
            .from('alertas_monitoramento')
            .select(`
              id,
              termo_encontrado,
              contexto,
              processos!inner (
                id,
                numero,
                coordenacao_id,
                coordenacoes (id, nome)
              )
            `)
            .gte('created_at', inicioDia)
            .lte('created_at', fimDia);

          const porCoordenacao = new Map<string, ResumoPayload>();
          for (const alerta of alertas || []) {
            const processo = (alerta as any).processos;
            if (!processo?.coordenacao_id) continue;
            
            const coordId = processo.coordenacao_id;
            const coordNome = processo.coordenacoes?.nome || 'Sem nome';
            
            if (!porCoordenacao.has(coordId)) {
              porCoordenacao.set(coordId, {
                coordenacao_id: coordId,
                coordenacao_nome: coordNome,
                total_verificados: 0,
                total_encontrados: 0,
                exemplos: []
              });
            }
            
            const coord = porCoordenacao.get(coordId)!;
            coord.total_encontrados++;
            coord.exemplos.push({
              processo_numero: processo.numero || 'N/A',
              descricao: `Termo: ${alerta.termo_encontrado}`
            });
          }
          resumosPorCoordenacao = Array.from(porCoordenacao.values());
          break;
        }
      }

      if (resumosPorCoordenacao.length === 0) {
        toast.info('Nenhum dado encontrado hoje para enviar resumo.');
        return;
      }

      // Verificar se há itens encontrados
      const temItens = resumosPorCoordenacao.some(r => r.total_encontrados > 0);
      if (!temItens) {
        toast.info('Nenhum item novo encontrado hoje para enviar.');
        return;
      }

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('enviar-resumo-monitoramento', {
        body: {
          tipo_monitoramento: tipo,
          resumos_por_coordenacao: resumosPorCoordenacao
        }
      });

      if (error) throw error;

      const enviados = (data as any)?.enviados || 0;
      if (enviados > 0) {
        toast.success(`Resumo enviado! ${enviados} notificação(ões) disparada(s).`);
      } else {
        toast.info('Resumo processado, mas nenhuma coordenação tem alertas configurados.');
      }
      
    } catch (error: any) {
      console.error('Erro ao enviar resumo:', error);
      toast.error(`Erro ao enviar resumo: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setEnviando(prev => ({ ...prev, [tipo]: false }));
    }
  };

  return { enviando, enviarResumo };
}
