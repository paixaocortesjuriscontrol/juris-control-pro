import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface MonitoramentoDjen {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo';
  termo_busca: string;
  oab?: string;
  uf?: string;
  coordenacao_id?: string;
  ativo: boolean;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
}

interface PublicacaoResultado {
  id: string;
  processo_numero: string | null;
  conteudo: string | null;
  data_publicacao: string | null;
  fonte: string | null;
  hash_conteudo: string;
}

interface ProgressoExecucao {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro';
  mensagem: string;
}

/**
 * Hook simplificado para busca DJEN que funciona 100% no frontend
 * - Usa a Edge Function `buscar-djen` apenas como proxy leve (sem estado)
 * - Grava resultados diretamente via Supabase Client
 * - Evita timeouts/travamentos de Edge Functions longas
 */
export function useBuscaDjenDireta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [progresso, setProgresso] = useState<ProgressoExecucao>({
    monitoramentoAtual: 0,
    totalMonitoramentos: 0,
    publicacoesNovas: 0,
    publicacoesDuplicadas: 0,
    status: 'idle',
    mensagem: '',
  });
  const [executando, setExecutando] = useState(false);
  const [cancelar, setCancelar] = useState(false);

  // Gera hash simples para deduplicação
  const gerarHash = (conteudo: string, data: string): string => {
    const normalized = (conteudo + data).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 300);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Verifica se a publicação já existe
  const verificarDuplicata = async (hash: string, monitoramentoId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('publicacoes_djen')
      .select('id')
      .eq('hash_conteudo', hash)
      .eq('monitoramento_id', monitoramentoId)
      .limit(1)
      .maybeSingle();
    
    return !!data;
  };

  // Verifica se deve excluir com base nas exclusões configuradas
  const deveExcluir = (conteudo: string, exclusoes?: string[]): string | null => {
    if (!exclusoes || exclusoes.length === 0) return null;
    const conteudoUpper = conteudo.toUpperCase();
    for (const termo of exclusoes) {
      if (conteudoUpper.includes(termo.toUpperCase())) {
        return termo;
      }
    }
    return null;
  };

  // Buscar um monitoramento via Edge Function leve
  const buscarMonitoramento = async (monitoramento: MonitoramentoDjen): Promise<PublicacaoResultado[]> => {
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(dataInicio.getDate() - 1); // Últimas 24h

    const params: Record<string, any> = {
      tipo: monitoramento.tipo,
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: hoje.toISOString().split('T')[0],
      pageSize: 50,
      fetchAll: false, // Busca simples, sem paginação complexa
    };

    if (monitoramento.tipo === 'advogado' && monitoramento.oab && monitoramento.uf) {
      params.oab = monitoramento.oab;
      params.uf = monitoramento.uf;
    } else if (monitoramento.tipo === 'palavra-chave') {
      params.palavraChave = monitoramento.termo_busca;
    } else if (monitoramento.tipo === 'processo') {
      params.numeroProcesso = monitoramento.termo_busca.replace(/\D/g, '');
    }

    try {
      const { data, error } = await supabase.functions.invoke('buscar-djen', {
        body: params,
      });

      if (error) {
        console.error(`Erro ao buscar DJEN para ${monitoramento.termo_busca}:`, error);
        return [];
      }

      const comunicacoes = data?.comunicacoes || data?.items || [];
      
      return comunicacoes.map((pub: any) => ({
        id: pub.id || crypto.randomUUID(),
        processo_numero: pub.numeroProcesso || pub.processo || null,
        conteudo: pub.conteudo || pub.teor || pub.texto || null,
        data_publicacao: pub.dataPublicacao || pub.dataDisponibilizacao || null,
        fonte: pub.tribunal || pub.orgao || 'DJEN',
        hash_conteudo: '',
      }));
    } catch (err) {
      console.error(`Erro na busca DJEN:`, err);
      return [];
    }
  };

  // Executar monitoramento completo
  const executarMonitoramento = useCallback(async (monitoramentosIds?: string[]) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setExecutando(true);
    setCancelar(false);
    setProgresso({
      monitoramentoAtual: 0,
      totalMonitoramentos: 0,
      publicacoesNovas: 0,
      publicacoesDuplicadas: 0,
      status: 'executando',
      mensagem: 'Carregando monitoramentos...',
    });

    try {
      // Buscar monitoramentos ativos
      let query = supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('ativo', true);

      if (monitoramentosIds?.length) {
        query = query.in('id', monitoramentosIds);
      }

      const { data: monitoramentos, error: monError } = await query;

      if (monError || !monitoramentos?.length) {
        setProgresso(prev => ({
          ...prev,
          status: 'erro',
          mensagem: 'Nenhum monitoramento ativo encontrado',
        }));
        setExecutando(false);
        return;
      }

      setProgresso(prev => ({
        ...prev,
        totalMonitoramentos: monitoramentos.length,
        mensagem: `Processando ${monitoramentos.length} monitoramentos...`,
      }));

      let totalNovas = 0;
      let totalDuplicadas = 0;
      const resumosPorCoordenacao: Record<string, {
        total_verificados: number;
        total_encontrados: number;
        exemplos: Array<{ processo_numero: string; descricao: string }>;
      }> = {};

      for (let i = 0; i < monitoramentos.length; i++) {
        if (cancelar) {
          setProgresso(prev => ({
            ...prev,
            status: 'concluido',
            mensagem: 'Execução cancelada pelo usuário',
          }));
          break;
        }

        const mon = monitoramentos[i] as MonitoramentoDjen;
        
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: i + 1,
          mensagem: `Buscando: ${mon.termo_busca}...`,
        }));

        // Delay entre monitoramentos para evitar rate limit
        if (i > 0) {
          await new Promise(r => setTimeout(r, 1500));
        }

        const publicacoes = await buscarMonitoramento(mon);

        for (const pub of publicacoes) {
          // Verificar exclusões
          if (pub.conteudo && deveExcluir(pub.conteudo, mon.exclusoes)) {
            continue;
          }

          // Gerar hash e verificar duplicata
          const hash = gerarHash(
            pub.conteudo || '',
            pub.data_publicacao || new Date().toISOString()
          );

          const isDuplicata = await verificarDuplicata(hash, mon.id);

          if (isDuplicata) {
            totalDuplicadas++;
            continue;
          }

          // Inserir nova publicação
          const { error: insertError } = await supabase
            .from('publicacoes_djen')
            .insert({
              monitoramento_id: mon.id,
              hash_conteudo: hash,
              processo_numero: pub.processo_numero,
              conteudo: pub.conteudo,
              data_publicacao: pub.data_publicacao,
              fonte: pub.fonte,
              lida: false,
            });

          if (!insertError) {
            totalNovas++;

            // Acumular para resumo por coordenação
            if (mon.coordenacao_id) {
              if (!resumosPorCoordenacao[mon.coordenacao_id]) {
                resumosPorCoordenacao[mon.coordenacao_id] = {
                  total_verificados: 0,
                  total_encontrados: 0,
                  exemplos: [],
                };
              }
              resumosPorCoordenacao[mon.coordenacao_id].total_encontrados++;
              if (resumosPorCoordenacao[mon.coordenacao_id].exemplos.length < 5) {
                resumosPorCoordenacao[mon.coordenacao_id].exemplos.push({
                  processo_numero: pub.processo_numero || 'S/N',
                  descricao: (pub.conteudo || '').slice(0, 100) + '...',
                });
              }
            }
          }
        }

        // Contabilizar verificados por coordenação
        if (mon.coordenacao_id && resumosPorCoordenacao[mon.coordenacao_id]) {
          resumosPorCoordenacao[mon.coordenacao_id].total_verificados += publicacoes.length;
        }

        setProgresso(prev => ({
          ...prev,
          publicacoesNovas: totalNovas,
          publicacoesDuplicadas: totalDuplicadas,
        }));
      }

      // Enviar resumos por coordenação ao finalizar
      if (Object.keys(resumosPorCoordenacao).length > 0) {
        try {
          // Buscar nomes das coordenações
          const coordIds = Object.keys(resumosPorCoordenacao);
          const { data: coordenacoes } = await supabase
            .from('coordenacoes')
            .select('id, nome')
            .in('id', coordIds);

          const resumosFormatados = coordIds.map(id => ({
            coordenacao_id: id,
            coordenacao_nome: coordenacoes?.find(c => c.id === id)?.nome || 'Coordenação',
            ...resumosPorCoordenacao[id],
          }));

          await supabase.functions.invoke('enviar-resumo-monitoramento', {
            body: {
              tipo_monitoramento: 'djen',
              resumos_por_coordenacao: resumosFormatados,
            },
          });
        } catch (resumoError) {
          console.error('Erro ao enviar resumos:', resumoError);
        }
      }

      setProgresso({
        monitoramentoAtual: monitoramentos.length,
        totalMonitoramentos: monitoramentos.length,
        publicacoesNovas: totalNovas,
        publicacoesDuplicadas: totalDuplicadas,
        status: 'concluido',
        mensagem: `Concluído! ${totalNovas} novas publicações, ${totalDuplicadas} duplicadas.`,
      });

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
      queryClient.invalidateQueries({ queryKey: ['monitoramentos-djen'] });

      if (totalNovas > 0) {
        toast.success(`${totalNovas} novas publicações encontradas!`);
      } else {
        toast.info('Nenhuma nova publicação encontrada');
      }

    } catch (error: any) {
      console.error('Erro no monitoramento DJEN:', error);
      setProgresso(prev => ({
        ...prev,
        status: 'erro',
        mensagem: `Erro: ${error?.message || 'Erro desconhecido'}`,
      }));
      toast.error(`Erro: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setExecutando(false);
    }
  }, [user?.id, cancelar, queryClient]);

  const cancelarExecucao = useCallback(() => {
    setCancelar(true);
  }, []);

  return {
    progresso,
    executando,
    executarMonitoramento,
    cancelarExecucao,
  };
}
