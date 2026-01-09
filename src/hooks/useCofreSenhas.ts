import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CofreSenha {
  id: string;
  usuario_id: string;
  nome: string;
  sistema: string;
  tribunal: string;
  login: string;
  senha_hash: string;
  certificado_a1_path: string | null;
  certificado_a1_senha: string | null;
  qrcode_2fa_path: string | null;
  aceite_termos_em: string | null;
  ativo: boolean;
  ultima_validacao: string | null;
  status_validacao: string;
  mensagem_erro: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapturaIntimacao {
  id: string;
  cofre_senha_id: string;
  oab_numero: string;
  oab_uf: string;
  justica: string;
  orgao: string;
  instancia: string;
  ativo: boolean;
  ultima_captura: string | null;
  proxima_captura: string | null;
  total_intimacoes_capturadas: number;
  status: string;
  mensagem_status: string | null;
  created_at: string;
  updated_at: string;
  cofre_senha?: CofreSenha;
}

export interface HistoricoCaptura {
  id: string;
  captura_id: string;
  executado_em: string;
  sucesso: boolean;
  intimacoes_encontradas: number;
  intimacoes_novas: number;
  tempo_execucao_ms: number | null;
  erro: string | null;
  detalhes: any;
}

export function useCofreSenhas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Listar credenciais do cofre
  const { data: credenciais = [], isLoading: loadingCredenciais } = useQuery({
    queryKey: ["cofre-senhas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofre_senhas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CofreSenha[];
    },
    enabled: !!user,
  });

  // Listar capturas com credencial
  const { data: capturas = [], isLoading: loadingCapturas } = useQuery({
    queryKey: ["capturas-intimacoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capturas_intimacoes")
        .select(`
          *,
          cofre_senha:cofre_senhas(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CapturaIntimacao[];
    },
    enabled: !!user,
  });

  // Criar credencial
  const criarCredencial = useMutation({
    mutationFn: async (dados: Omit<CofreSenha, "id" | "created_at" | "updated_at" | "usuario_id" | "ultima_validacao" | "status_validacao" | "mensagem_erro">) => {
      const { data, error } = await supabase
        .from("cofre_senhas")
        .insert({
          ...dados,
          usuario_id: user!.id,
          aceite_termos_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-senhas"] });
      toast.success("Credencial salva no cofre!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar credencial: " + err.message);
    },
  });

  // Atualizar credencial
  const atualizarCredencial = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<CofreSenha> & { id: string }) => {
      const { data, error } = await supabase
        .from("cofre_senhas")
        .update(dados)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-senhas"] });
      toast.success("Credencial atualizada!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  // Excluir credencial
  const excluirCredencial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cofre_senhas")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-senhas"] });
      queryClient.invalidateQueries({ queryKey: ["capturas-intimacoes"] });
      toast.success("Credencial removida do cofre!");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });

  // Criar captura
  const criarCaptura = useMutation({
    mutationFn: async (dados: Omit<CapturaIntimacao, "id" | "created_at" | "updated_at" | "ultima_captura" | "proxima_captura" | "total_intimacoes_capturadas" | "cofre_senha">) => {
      const { data, error } = await supabase
        .from("capturas_intimacoes")
        .insert(dados)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capturas-intimacoes"] });
      toast.success("Captura configurada!");
    },
    onError: (err: any) => {
      toast.error("Erro ao configurar captura: " + err.message);
    },
  });

  // Atualizar captura
  const atualizarCaptura = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<CapturaIntimacao> & { id: string }) => {
      const { data, error } = await supabase
        .from("capturas_intimacoes")
        .update(dados)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capturas-intimacoes"] });
      toast.success("Captura atualizada!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  // Excluir captura
  const excluirCaptura = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("capturas_intimacoes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capturas-intimacoes"] });
      toast.success("Captura removida!");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });

  // Buscar histórico de uma captura
  const buscarHistorico = async (capturaId: string): Promise<HistoricoCaptura[]> => {
    const { data, error } = await supabase
      .from("historico_capturas")
      .select("*")
      .eq("captura_id", capturaId)
      .order("executado_em", { ascending: false })
      .limit(50);

    if (error) throw error;
    return data as HistoricoCaptura[];
  };

  return {
    credenciais,
    capturas,
    loadingCredenciais,
    loadingCapturas,
    criarCredencial,
    atualizarCredencial,
    excluirCredencial,
    criarCaptura,
    atualizarCaptura,
    excluirCaptura,
    buscarHistorico,
  };
}
