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
  // Campos de agendamento
  modo_captura?: "agendado" | "intervalo" | "manual";
  horarios_execucao?: string[];
  dias_semana?: number[];
  intervalo_minutos?: number;
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

  // Criar credencial (via edge function para criptografar a senha)
  const criarCredencial = useMutation({
    mutationFn: async (dados: Omit<CofreSenha, "id" | "created_at" | "updated_at" | "usuario_id" | "ultima_validacao" | "status_validacao" | "mensagem_erro"> & { senha_hash?: string }) => {
      const { data, error } = await supabase.functions.invoke("cofre-senhas", {
        body: {
          action: "salvar",
          nome: dados.nome,
          sistema: dados.sistema,
          tribunal: dados.tribunal,
          login: dados.login,
          senha: dados.senha_hash, // plaintext — encrypted server-side
          certificado_a1_path: dados.certificado_a1_path,
          certificado_a1_senha: dados.certificado_a1_senha, // encrypted server-side
          qrcode_2fa_path: dados.qrcode_2fa_path,
          ativo: dados.ativo,
          aceite_termos_em: dados.aceite_termos_em,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao salvar");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-senhas"] });
      toast.success("Credencial salva no cofre!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar credencial: " + err.message);
    },
  });

  // Atualizar credencial (via edge function para criptografar a senha)
  const atualizarCredencial = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<CofreSenha> & { id: string; senha_hash?: string }) => {
      const { data, error } = await supabase.functions.invoke("cofre-senhas", {
        body: {
          action: "salvar",
          id,
          nome: dados.nome,
          sistema: dados.sistema,
          tribunal: dados.tribunal,
          login: dados.login,
          senha: dados.senha_hash, // plaintext — encrypted server-side
          certificado_a1_path: dados.certificado_a1_path,
          certificado_a1_senha: dados.certificado_a1_senha, // encrypted server-side
          qrcode_2fa_path: dados.qrcode_2fa_path,
          ativo: dados.ativo,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar");
      return data.data;
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
