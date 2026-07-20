import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfigEnvioAlerta {
  id: string;
  coordenacao_id: string;
  tipo_tarefa: string;
  canal_email: boolean;
  canal_whatsapp: boolean;
  dias_antes: number[];
  destinatarios_ids: string[];
  ativo: boolean;
  dias_semana: number[];
  pos_vencimento_habilitado?: boolean;
  pos_vencimento_horario?: string;
  created_at: string;
  updated_at: string;
}

export function useConfigEnvioAlertas(coordenacaoId?: string) {
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["config-envio-alertas-tarefas", coordenacaoId],
    enabled: !!coordenacaoId,
    queryFn: async () => {
      if (!coordenacaoId) return [] as ConfigEnvioAlerta[];
      const { data, error } = await supabase
        .from("config_envio_alertas_tarefas" as any)
        .select("*")
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      return (data ?? []) as unknown as ConfigEnvioAlerta[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (payload: Partial<ConfigEnvioAlerta> & { coordenacao_id: string; tipo_tarefa: string }) => {
      const { data: existing } = await supabase
        .from("config_envio_alertas_tarefas" as any)
        .select("id")
        .eq("coordenacao_id", payload.coordenacao_id)
        .eq("tipo_tarefa", payload.tipo_tarefa)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("config_envio_alertas_tarefas" as any)
          .update({
            canal_email: payload.canal_email ?? false,
            canal_whatsapp: payload.canal_whatsapp ?? false,
            dias_antes: payload.dias_antes ?? [0],
            destinatarios_ids: payload.destinatarios_ids ?? [],
            ativo: payload.ativo ?? true,
            dias_semana: payload.dias_semana ?? [1, 2, 3, 4, 5],
            pos_vencimento_habilitado: payload.pos_vencimento_habilitado ?? false,
            pos_vencimento_horario: payload.pos_vencimento_horario ?? "09:00",
          })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("config_envio_alertas_tarefas" as any)
          .insert({
            coordenacao_id: payload.coordenacao_id,
            tipo_tarefa: payload.tipo_tarefa,
            canal_email: payload.canal_email ?? false,
            canal_whatsapp: payload.canal_whatsapp ?? false,
            dias_antes: payload.dias_antes ?? [0],
            destinatarios_ids: payload.destinatarios_ids ?? [],
            ativo: payload.ativo ?? true,
            dias_semana: payload.dias_semana ?? [1, 2, 3, 4, 5],
            pos_vencimento_habilitado: payload.pos_vencimento_habilitado ?? false,
            pos_vencimento_horario: payload.pos_vencimento_horario ?? "09:00",
            created_by: userRes.user?.id ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["config-envio-alertas-tarefas"] });
      toast.success("Configuração salva");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("config_envio_alertas_tarefas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["config-envio-alertas-tarefas"] });
      toast.success("Configuração removida");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  return { configs, isLoading, salvar, remover };
}
