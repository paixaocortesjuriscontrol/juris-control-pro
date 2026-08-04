import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AudienciaDetectada {
  id: string;
  publicacao_id: string | null;
  monitoramento_id: string | null;
  processo_id: string | null;
  processo_numero: string | null;
  data_audiencia: string | null;
  hora: string | null;
  hora_local: string | null;
  hora_brasilia: string | null;
  tipo_audiencia: string | null;
  local_audiencia: string | null;
  vara_camara: string | null;
  comarca: string | null;
  polo_ativo: string | null;
  cliente: string | null;
  terceirizado: string | null;
  resumo_objeto: string | null;
  funcao: string | null;
  preposto: string | null;
  testemunhas: string | null;
  advogado: string | null;
  contexto: string | null;
  conteudo_publicacao: string | null;
  status: string;
  tratado_por: string | null;
  tratado_em: string | null;
  observacoes: string | null;
  providencias_tomadas: string | null;
  alerta_enviado: boolean;
  origem: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  modalidade: string | null;
  equipe: string | null;
  nucleo_origem: string | null;
  dossie: string | null;
  coordenacao_id: string | null;
  monitoramento?: {
    termo_busca: string;
    descricao: string | null;
  };
}

export type StatusAudiencia = 'pendente' | 'confirmado' | 'reagendado' | 'tratado' | 'cancelado' | 'ignorado';

export const STATUS_AUDIENCIA_LABELS: Record<StatusAudiencia, string> = {
  pendente: '⏳ Pendente',
  confirmado: '✅ Confirmado',
  reagendado: '🔄 Reagendado',
  tratado: '✔️ Tratado',
  cancelado: '❌ Cancelado',
  ignorado: '🚫 Ignorado',
};

export interface NovaAudiencia {
  processo_id?: string;
  processo_numero?: string;
  publicacao_id?: string;
  titulo?: string;
  data_audiencia: string;
  hora?: string;
  hora_fim?: string;
  hora_local?: string;
  hora_brasilia?: string;
  tipo_audiencia?: string;
  vara_camara?: string;
  comarca?: string;
  forum?: string;
  sala_forum?: string;
  local_audiencia?: string;
  alerta_valor?: number;
  alerta_unidade?: string;
  polo_ativo?: string;
  cliente?: string;
  terceirizado?: string;
  resumo_objeto?: string;
  funcao?: string;
  preposto?: string;
  testemunhas?: string;
  advogado?: string;
  observacoes?: string;
  status?: string;
  modalidade?: string;
  equipe?: string;
  nucleo_origem?: string;
  dossie?: string;
  advogados_ids?: string[];
  envolvidos_ids?: string[];
  coordenacao_id?: string;
  /** Origem do registro ('manual' | 'publicacao'). Default: 'manual'. */
  origem?: string;
  /** Conteúdo da publicação DJEN que originou a audiência. */
  conteudo_publicacao?: string;
}

interface AudienciasFiltros {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
  coordenacaoId?: string;
}

export function useAudienciasDetectadas(filtros: AudienciasFiltros = {}) {
  const queryClient = useQueryClient();

  // Stats via COUNT no banco (sem limite) - single query with filters pushed to DB
  const { data: statsData } = useQuery({
    queryKey: ['audiencias-stats', filtros.coordenacaoId],
    queryFn: async () => {
      const coordAtiva = filtros.coordenacaoId && filtros.coordenacaoId !== 'todas';

      const hoje = new Date().toISOString().split('T')[0];
      const em7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const buildQuery = (status?: string) => {
        let q = supabase.from('audiencias_detectadas').select('*', { count: 'exact', head: true });
        if (status) q = q.eq('status', status);
        if (coordAtiva) {
          q = q.eq('coordenacao_id', filtros.coordenacaoId as string);
        }
        return q;
      };

      const [pendentesRes, tratadasRes, ignoradasRes, proximasRes] = await Promise.all([
        buildQuery('pendente'),
        buildQuery('tratado'),
        buildQuery('ignorado'),
        buildQuery('pendente').gte('data_audiencia', hoje).lte('data_audiencia', em7Dias),
      ]);

      return {
        pendentes: pendentesRes.count || 0,
        tratadas: tratadasRes.count || 0,
        ignoradas: ignoradasRes.count || 0,
        proximas: proximasRes.count || 0,
      };
    },
    staleTime: 30000,
  });

  // Buscar audiências com filtros no banco (sem paginação multi-loop)
  const { data: audiencias = [], isLoading } = useQuery({
    queryKey: ['audiencias-detectadas', filtros],
    queryFn: async () => {
      let query = supabase
        .from('audiencias_detectadas')
        .select(`
          *,
          monitoramento:monitoramentos_djen(termo_busca, descricao)
        `)
        .order('data_audiencia', { ascending: true, nullsFirst: false })
        .limit(2000);

      // Filtro de status no banco
      if (filtros.status && filtros.status !== 'todos') {
        query = query.eq('status', filtros.status);
      }

      // Filtro de coordenação no banco
      if (filtros.coordenacaoId && filtros.coordenacaoId !== 'todas') {
        query = query.eq('coordenacao_id', filtros.coordenacaoId);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_audiencia', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_audiencia', filtros.dataFim);
      }

      // Filtro de busca textual no banco
      if (filtros.search) {
        const s = filtros.search.trim();
        query = query.or(
          `processo_numero.ilike.%${s}%,cliente.ilike.%${s}%,advogado.ilike.%${s}%,comarca.ilike.%${s}%,tipo_audiencia.ilike.%${s}%,dossie.ilike.%${s}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []) as AudienciaDetectada[];
    },
  });

  // Atualizar status
  const atualizarAudiencia = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: string; observacoes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: Record<string, unknown> = { status };
      if (status === 'tratado' || status === 'ignorado') {
        updates.tratado_por = user?.id;
        updates.tratado_em = new Date().toISOString();
      }
      if (observacoes !== undefined) {
        updates.observacoes = observacoes;
      }

      const { error } = await supabase
        .from('audiencias_detectadas')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      toast.success('Audiência atualizada!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Criar audiência manual
  const criarAudiencia = useMutation({
    mutationFn: async (novaAudiencia: NovaAudiencia) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Extrair advogados_ids antes de inserir.
      // publicacao_id só é gravado quando aponta para publicacoes_djen (FK);
      // para publicações de processos/descartadas o vínculo é feito nas
      // tabelas de junção (audiencias_publicacoes_processos / _descartadas).
      const { advogados_ids, envolvidos_ids, ...dadosAudiencia } = novaAudiencia;

      // Converter data para formato ISO completo (timestamp with time zone)
      let dataAudienciaISO: string | null = null;
      if (dadosAudiencia.data_audiencia) {
        // Se tiver hora, usar ela; senão usar 12:00
        const hora = dadosAudiencia.hora_brasilia || dadosAudiencia.hora || '12:00';
        dataAudienciaISO = `${dadosAudiencia.data_audiencia}T${hora}:00-03:00`;
      }

      // ID gerado no cliente: não dependemos do retorno da linha (que pode ser
      // bloqueado pelas políticas de leitura e gerar "Cannot coerce the result
      // to a single JSON object").
      const novaAudienciaId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : undefined;

      const { error } = await supabase
        .from('audiencias_detectadas')
        .insert({
          ...(novaAudienciaId ? { id: novaAudienciaId } : {}),
          ...dadosAudiencia,
          processo_id: dadosAudiencia.processo_id || null,
          data_audiencia: dataAudienciaISO,
          publicacao_id: dadosAudiencia.publicacao_id || null,
          conteudo_publicacao: dadosAudiencia.conteudo_publicacao || null,
          origem: dadosAudiencia.origem || 'manual',
          criado_por: user.id,
          status: dadosAudiencia.status || 'pendente',
          modalidade: dadosAudiencia.modalidade || null,
          equipe: dadosAudiencia.equipe || null,
          nucleo_origem: dadosAudiencia.nucleo_origem || null,
          dossie: dadosAudiencia.dossie || null,
        });

      if (error) throw error;

      const audienciaCriada = { id: novaAudienciaId } as { id?: string };

      // Inserir advogados responsáveis na tabela de junção
      if (advogados_ids && advogados_ids.length > 0 && audienciaCriada) {
        const advogadosInsert = advogados_ids.map(advogadoId => ({
          audiencia_id: audienciaCriada.id,
          advogado_id: advogadoId,
        }));

        await supabase.from('audiencias_advogados').insert(advogadosInsert);

        // Notificar os advogados selecionados
        const { data: advogadosInfo } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', advogados_ids);

        for (const advogado of advogadosInfo || []) {
          await supabase.from('notificacoes').insert({
            usuario_id: advogado.id,
            titulo: '📋 Nova audiência atribuída',
            mensagem: `Você foi designado para a audiência do processo ${novaAudiencia.processo_numero} em ${novaAudiencia.data_audiencia}`,
            tipo: 'info',
            link: '/painel-audiencias',
            dados: {
              audiencia_id: audienciaCriada.id,
              processo_numero: novaAudiencia.processo_numero,
            },
          });
        }
      }

      // Inserir envolvidos (apenas acompanham)
      if (envolvidos_ids && envolvidos_ids.length > 0 && audienciaCriada) {
        await supabase.from('audiencia_envolvidos').insert(
          envolvidos_ids.map((uid) => ({
            audiencia_id: audienciaCriada.id,
            usuario_id: uid,
          }))
        );
      }

      if (error) throw error;

      // Buscar configurações de alertas
      const { data: config } = await supabase
        .from('config_alertas_audiencias')
        .select('*')
        .limit(1)
        .single();

      if (config && audienciaCriada) {
        // Criar lembretes automáticos baseados na configuração global
        const minutosSet = new Set<number>((config.lembretes_minutos || []).filter((n: any) => Number.isFinite(n) && n > 0));

        // Somar o alerta digitado no form ("Alertas internos de antecedência")
        const alertaValor = Number(novaAudiencia.alerta_valor || 0);
        if (alertaValor > 0) {
          const unidade = novaAudiencia.alerta_unidade || 'horas_antes';
          const mult = unidade === 'minutos_antes' ? 1 : unidade === 'dias_antes' ? 1440 : 60;
          minutosSet.add(alertaValor * mult);
        }

        const lembretes = Array.from(minutosSet).map((minutos) => ({
          audiencia_id: audienciaCriada.id,
          minutos_antes: minutos,
          enviado: false,
        }));

        if (lembretes.length > 0) {
          await supabase.from('lembretes_audiencia').insert(lembretes);
        }

        // Enviar alerta de criação via WhatsApp se configurado
        if (config.enviar_whatsapp_criacao && novaAudiencia.advogado) {
          try {
            // Buscar telefone do criador
            const { data: perfil } = await supabase
              .from('profiles')
              .select('telefone, nome')
              .eq('id', user.id)
              .single();

            const telefones: string[] = [];
            if (perfil?.telefone) {
              telefones.push(perfil.telefone);
            }

            if (telefones.length > 0) {
              const horaExibicao = novaAudiencia.hora_brasilia || novaAudiencia.hora || 'Não definido';
              const mensagem = `📋 *NOVA AUDIÊNCIA CADASTRADA*\n\n` +
                `📅 Data: ${novaAudiencia.data_audiencia}\n` +
                `🕐 Horário: ${horaExibicao}\n` +
                `📄 Processo: ${novaAudiencia.processo_numero}\n` +
                (novaAudiencia.tipo_audiencia ? `📌 Tipo: ${novaAudiencia.tipo_audiencia}\n` : '') +
                (novaAudiencia.cliente ? `🏢 Cliente: ${novaAudiencia.cliente}\n` : '') +
                (novaAudiencia.comarca ? `📍 Comarca: ${novaAudiencia.comarca}\n` : '') +
                `\n_JurisControl - Sistema de Gestão Jurídica_`;

              await supabase.functions.invoke('enviar-whatsapp-zapi', {
                body: {
                  telefones,
                  mensagem,
                  tipo: 'audiencia',
                },
              });
            }
          } catch (whatsappError) {
            console.error('Erro ao enviar WhatsApp de criação:', whatsappError);
            // Não bloqueia o fluxo principal
          }
        }
      }

      return audienciaCriada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-processo'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-stats'] });
      toast.success('Audiência cadastrada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  // Estatísticas via COUNT no banco
  const pendentes = statsData?.pendentes ?? 0;
  const tratadas = statsData?.tratadas ?? 0;
  const ignoradas = statsData?.ignoradas ?? 0;
  const proximas = statsData?.proximas ?? 0;

  return {
    audiencias,
    isLoading,
    atualizarAudiencia,
    criarAudiencia,
    pendentes,
    tratadas,
    ignoradas,
    proximas,
  };
}
