import { useState, useCallback, useRef } from "react";
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

// Configuração de paralelismo
const CONCURRENT_LIMIT = 5; // Processar 5 monitoramentos em paralelo
const DELAY_BETWEEN_BATCHES = 500; // 500ms entre lotes

/**
 * Hook com busca DJEN paralela para máxima performance
 * - Processa múltiplos monitoramentos em paralelo
 * - Usa a Edge Function `buscar-djen` apenas como proxy leve
 * - Grava resultados diretamente via Supabase Client
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
  const cancelarRef = useRef(false);

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

  // Verifica se a publicação já existe (batch)
  const verificarDuplicatasBatch = async (
    hashes: string[], 
    monitoramentoId: string
  ): Promise<Set<string>> => {
    if (hashes.length === 0) return new Set();
    
    const { data } = await supabase
      .from('publicacoes_djen')
      .select('hash_conteudo')
      .eq('monitoramento_id', monitoramentoId)
      .in('hash_conteudo', hashes);
    
    return new Set((data || []).map(d => d.hash_conteudo));
  };

  // Verifica se deve excluir com base nas exclusões configuradas
  const deveExcluir = (conteudo: string, exclusoes?: string[]): boolean => {
    if (!exclusoes || exclusoes.length === 0) return false;
    const conteudoUpper = conteudo.toUpperCase();
    return exclusoes.some(termo => conteudoUpper.includes(termo.toUpperCase()));
  };

  // Buscar um monitoramento via Edge Function leve
  const buscarMonitoramento = async (monitoramento: MonitoramentoDjen): Promise<PublicacaoResultado[]> => {
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(dataInicio.getDate() - 1);

    const params: Record<string, any> = {
      tipo: monitoramento.tipo,
      dataInicio: dataInicio.toISOString().split('T')[0],
      dataFim: hoje.toISOString().split('T')[0],
      pageSize: 50,
      fetchAll: false,
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

  // Processar um único monitoramento e retornar estatísticas
  const processarMonitoramento = async (
    mon: MonitoramentoDjen
  ): Promise<{ novas: number; duplicadas: number; coordenacaoStats?: any }> => {
    const publicacoes = await buscarMonitoramento(mon);
    
    if (publicacoes.length === 0) {
      return { novas: 0, duplicadas: 0 };
    }

    // Filtrar exclusões primeiro
    const pubsFiltradas = publicacoes.filter(pub => 
      !pub.conteudo || !deveExcluir(pub.conteudo, mon.exclusoes)
    );

    // Gerar hashes para todas as publicações
    const pubsComHash = pubsFiltradas.map(pub => ({
      ...pub,
      hash_conteudo: gerarHash(
        pub.conteudo || '',
        pub.data_publicacao || new Date().toISOString()
      ),
    }));

    // Verificar duplicatas em batch (mais eficiente)
    const hashes = pubsComHash.map(p => p.hash_conteudo);
    const existentes = await verificarDuplicatasBatch(hashes, mon.id);

    const novas = pubsComHash.filter(p => !existentes.has(p.hash_conteudo));
    const duplicadas = pubsComHash.length - novas.length;

    // Inserir novas em batch
    if (novas.length > 0) {
      const { error: insertError } = await supabase
        .from('publicacoes_djen')
        .insert(novas.map(pub => ({
          monitoramento_id: mon.id,
          hash_conteudo: pub.hash_conteudo,
          processo_numero: pub.processo_numero,
          conteudo: pub.conteudo,
          data_publicacao: pub.data_publicacao,
          fonte: pub.fonte,
          lida: false,
        })));

      if (insertError) {
        console.error('Erro ao inserir publicações:', insertError);
        return { novas: 0, duplicadas };
      }
    }

    // Estatísticas para resumo por coordenação
    let coordenacaoStats;
    if (mon.coordenacao_id && novas.length > 0) {
      coordenacaoStats = {
        coordenacao_id: mon.coordenacao_id,
        total_verificados: publicacoes.length,
        total_encontrados: novas.length,
        exemplos: novas.slice(0, 3).map(p => ({
          processo_numero: p.processo_numero || 'S/N',
          descricao: (p.conteudo || '').slice(0, 100) + '...',
        })),
      };
    }

    return { novas: novas.length, duplicadas, coordenacaoStats };
  };

  // Executar monitoramento com paralelismo
  const executarMonitoramento = useCallback(async (monitoramentosIds?: string[]) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setExecutando(true);
    cancelarRef.current = false;
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

      const total = monitoramentos.length;
      setProgresso(prev => ({
        ...prev,
        totalMonitoramentos: total,
        mensagem: `Processando ${total} monitoramentos em paralelo (${CONCURRENT_LIMIT} simultâneos)...`,
      }));

      let totalNovas = 0;
      let totalDuplicadas = 0;
      let processados = 0;
      const resumosPorCoordenacao: Record<string, {
        total_verificados: number;
        total_encontrados: number;
        exemplos: Array<{ processo_numero: string; descricao: string }>;
      }> = {};

      // Processar em lotes paralelos
      for (let i = 0; i < monitoramentos.length; i += CONCURRENT_LIMIT) {
        if (cancelarRef.current) {
          setProgresso(prev => ({
            ...prev,
            status: 'concluido',
            mensagem: `Cancelado. ${totalNovas} novas, ${totalDuplicadas} duplicadas.`,
          }));
          break;
        }

        const lote = monitoramentos.slice(i, i + CONCURRENT_LIMIT) as MonitoramentoDjen[];
        
        // Mostrar quais termos estão sendo buscados
        const termos = lote.map(m => m.termo_busca).join(', ');
        setProgresso(prev => ({
          ...prev,
          mensagem: `Buscando: ${termos.slice(0, 50)}${termos.length > 50 ? '...' : ''}`,
        }));

        // Processar lote em paralelo
        const resultados = await Promise.allSettled(
          lote.map(mon => processarMonitoramento(mon))
        );

        // Contabilizar resultados
        for (const resultado of resultados) {
          if (resultado.status === 'fulfilled') {
            totalNovas += resultado.value.novas;
            totalDuplicadas += resultado.value.duplicadas;
            
            // Acumular stats de coordenação
            if (resultado.value.coordenacaoStats) {
              const stats = resultado.value.coordenacaoStats;
              if (!resumosPorCoordenacao[stats.coordenacao_id]) {
                resumosPorCoordenacao[stats.coordenacao_id] = {
                  total_verificados: 0,
                  total_encontrados: 0,
                  exemplos: [],
                };
              }
              resumosPorCoordenacao[stats.coordenacao_id].total_verificados += stats.total_verificados;
              resumosPorCoordenacao[stats.coordenacao_id].total_encontrados += stats.total_encontrados;
              if (resumosPorCoordenacao[stats.coordenacao_id].exemplos.length < 5) {
                resumosPorCoordenacao[stats.coordenacao_id].exemplos.push(...stats.exemplos);
              }
            }
          }
        }

        processados += lote.length;
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: processados,
          publicacoesNovas: totalNovas,
          publicacoesDuplicadas: totalDuplicadas,
        }));

        // Pequeno delay entre lotes para não sobrecarregar
        if (i + CONCURRENT_LIMIT < monitoramentos.length) {
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
      }

      // Enviar resumos por coordenação ao finalizar
      if (Object.keys(resumosPorCoordenacao).length > 0) {
        try {
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
        monitoramentoAtual: total,
        totalMonitoramentos: total,
        publicacoesNovas: totalNovas,
        publicacoesDuplicadas: totalDuplicadas,
        status: 'concluido',
        mensagem: `Concluído! ${totalNovas} novas, ${totalDuplicadas} duplicadas.`,
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
  }, [user?.id, queryClient]);

  const cancelarExecucao = useCallback(() => {
    cancelarRef.current = true;
  }, []);

  return {
    progresso,
    executando,
    executarMonitoramento,
    cancelarExecucao,
  };
}
