import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DocumentoEncontrado {
  id: string;
  nome: string;
  tipo: string;
  url?: string;
  status: string;
}

interface ResultadoBaixarAutos {
  sucesso: boolean;
  login_sucesso?: boolean;
  pagina_processo?: boolean;
  documentos_baixados: number;
  documentos_total: number;
  documentos: DocumentoEncontrado[];
  mensagem?: string;
  erro?: string;
}

export function useBaixarAutos(processoId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBaixarAutos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Buscar documentos já baixados para este processo
  const { data: documentosBaixados = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["processos-documentos-download", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_documentos_download")
        .select("*")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!processoId && !!user,
  });

  const baixarAutos = async (params: {
    cofre_senha_id: string;
    processo_numero: string;
    tribunal?: string;
  }) => {
    setBuscando(true);
    setErro(null);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke("baixar-autos-pje", {
        body: {
          cofre_senha_id: params.cofre_senha_id,
          processo_numero: params.processo_numero,
          processo_id: processoId,
          tribunal: params.tribunal,
        },
      });

      if (error) throw error;

      if (data.erro && !data.sucesso) {
        setErro(data.erro);
        toast.error(data.erro);
      } else {
        setResultado(data);
        queryClient.invalidateQueries({ queryKey: ["processos-documentos-download", processoId] });
        toast.success(data.mensagem || `${data.documentos_baixados} documento(s) encontrado(s)`);
      }

      return data;
    } catch (err: any) {
      const msg = err.message || "Erro ao buscar autos do tribunal";
      setErro(msg);
      toast.error(msg);
      return null;
    } finally {
      setBuscando(false);
    }
  };

  return {
    baixarAutos,
    buscando,
    resultado,
    erro,
    documentosBaixados,
    loadingDocs,
  };
}
