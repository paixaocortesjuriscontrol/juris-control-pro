import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfigDeteccaoCoordenacao {
  id: string;
  coordenacao_id: string;
  detectar_audiencias: boolean;
  detectar_intimacoes: boolean;
  monitorar_andamentos: boolean;
  horarios_andamentos: string[];
  monitorar_djen_termos: boolean;
  horarios_djen_termos: string[];
  monitorar_djen_processos: boolean;
  horarios_djen_processos: string[];
  monitorar_distribuicoes: boolean;
  horarios_distribuicoes: string[];
  monitorar_redistribuicoes: boolean;
  horarios_redistribuicoes: string[];
  monitorar_djet_pautas: boolean;
  horarios_djet_pautas: string[];
}

export type ConfigDeteccaoPayload = Partial<Omit<ConfigDeteccaoCoordenacao, "id">> & {
  coordenacao_id: string;
};

const DEFAULTS: Omit<ConfigDeteccaoCoordenacao, "id" | "coordenacao_id"> = {
  detectar_audiencias: false,
  detectar_intimacoes: false,
  monitorar_andamentos: false,
  horarios_andamentos: [],
  monitorar_djen_termos: false,
  horarios_djen_termos: [],
  monitorar_djen_processos: false,
  horarios_djen_processos: [],
  monitorar_distribuicoes: false,
  horarios_distribuicoes: [],
  monitorar_redistribuicoes: false,
  horarios_redistribuicoes: [],
  monitorar_djet_pautas: false,
  horarios_djet_pautas: [],
};

export function useConfigDeteccaoCoordenacao(coordenacaoId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["config-deteccao-coordenacao", coordenacaoId],
    enabled: !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_deteccao_coordenacao" as any)
        .select("*")
        .eq("coordenacao_id", coordenacaoId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return { ...DEFAULTS, coordenacao_id: coordenacaoId!, id: "" } as ConfigDeteccaoCoordenacao;
      }
      return data as unknown as ConfigDeteccaoCoordenacao;
    },
  });

  const salvar = useMutation({
    mutationFn: async (payload: ConfigDeteccaoPayload) => {
      const { error } = await supabase
        .from("config_deteccao_coordenacao" as any)
        .upsert({ ...DEFAULTS, ...payload }, { onConflict: "coordenacao_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["config-deteccao-coordenacao", coordenacaoId] });
      toast.success("Configuração de detecção salva");
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  return { config: query.data, isLoading: query.isLoading, salvar };
}