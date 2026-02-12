import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ParteMni {
  nome: string;
  documento: string;
  tipoPessoa: string;
  polo: "ativo" | "passivo";
  advogados: Array<{ nome: string; inscricao: string }>;
}

export interface DocumentoMni {
  idDocumento: string;
  tipo: string;
  descricao: string;
  dataJuntada: string;
  mimetype: string;
}

export interface MovimentacaoMni {
  data: string;
  descricao: string;
  codigo: string;
  complementos: string[];
}

export interface ResultadoMni {
  sucesso: boolean;
  origem: string;
  dadosBasicos: {
    numero: string;
    classe: string;
    assuntos: string[];
    valorCausa: number;
    orgaoJulgador: string;
    dataAjuizamento: string;
  };
  partes: ParteMni[];
  documentos: DocumentoMni[];
  movimentacoes: MovimentacaoMni[];
  mensagem?: string;
  erro?: string;
  bloqueada?: boolean;
  minutos_restantes?: number;
  tentativas_restantes?: number;
}

export function useMniConsultaProcesso() {
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoMni | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const consultarMni = async (params: {
    cofre_senha_id: string;
    processo_numero: string;
    incluir_documentos?: boolean;
    incluir_movimentos?: boolean;
  }) => {
    setConsultando(true);
    setErro(null);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke("consultar-processo-mni", {
        body: {
          cofre_senha_id: params.cofre_senha_id,
          processo_numero: params.processo_numero,
          incluir_documentos: params.incluir_documentos ?? true,
          incluir_movimentos: params.incluir_movimentos ?? true,
        },
      });

      if (error) throw error;

      if (data.erro && !data.sucesso) {
        setErro(data.erro);
        toast.error(data.erro);
      } else {
        setResultado(data);
        toast.success(data.mensagem || "Dados obtidos via API MNI");
      }

      return data as ResultadoMni;
    } catch (err: any) {
      const msg = err.message || "Erro ao consultar API MNI";
      setErro(msg);
      toast.error(msg);
      return null;
    } finally {
      setConsultando(false);
    }
  };

  const limpar = () => {
    setResultado(null);
    setErro(null);
  };

  return {
    consultarMni,
    consultando,
    resultado,
    erro,
    limpar,
  };
}
