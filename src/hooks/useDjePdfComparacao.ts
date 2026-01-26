import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

export interface DjePdfDiario {
  id: string;
  tribunal: string;
  data_publicacao: string;
  caderno: string;
  url_origem: string | null;
  tamanho_bytes: number | null;
  total_paginas: number | null;
  status: string;
  erro_mensagem: string | null;
  storage_path: string | null;
  created_at: string;
  processado_em: string | null;
}

export interface DjeResultadoBusca {
  id: string;
  conteudo_id: string;
  monitoramento_id: string | null;
  termo_encontrado: string;
  contexto: string | null;
  processo_numero: string | null;
  pagina: number | null;
  origem: string;
  created_at: string;
}

export interface ComparacaoStats {
  dje_pdf: {
    total_pdfs: number;
    pdfs_processados: number;
    total_paginas: number;
    total_matches: number;
    tribunais: { tribunal: string; matches: number }[];
  };
  djen_api: {
    total_publicacoes: number;
    tribunais: { tribunal: string; count: number }[];
  };
  sobreposicao: {
    matches_comuns: number;
    exclusivos_dje_pdf: number;
    exclusivos_djen_api: number;
  };
}

// Lista PDFs baixados
export function useDjePdfs(dataInicio?: string, dataFim?: string) {
  const inicio = dataInicio || format(subDays(new Date(), 7), "yyyy-MM-dd");
  const fim = dataFim || format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["dje-pdfs", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dje_pdfs_diarios")
        .select("*")
        .gte("data_publicacao", inicio)
        .lte("data_publicacao", fim)
        .order("data_publicacao", { ascending: false });

      if (error) throw error;
      return (data || []) as DjePdfDiario[];
    },
  });
}

// Lista resultados de busca DJE-PDF
export function useDjeResultados(dataPublicacao?: string, tribunal?: string) {
  return useQuery({
    queryKey: ["dje-resultados", dataPublicacao, tribunal],
    queryFn: async () => {
      let query = supabase
        .from("dje_resultados_busca")
        .select(`
          *,
          conteudo:dje_conteudo_indexado(
            pagina,
            pdf:dje_pdfs_diarios(
              tribunal,
              data_publicacao
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (dataPublicacao) {
        query = query.eq("conteudo.pdf.data_publicacao", dataPublicacao);
      }

      if (tribunal) {
        query = query.eq("conteudo.pdf.tribunal", tribunal);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });
}

// Estatísticas de comparação
export function useComparacaoStats(dataPublicacao: string) {
  return useQuery({
    queryKey: ["comparacao-stats", dataPublicacao],
    queryFn: async (): Promise<ComparacaoStats> => {
      // Stats DJE-PDF
      const { data: pdfs } = await supabase
        .from("dje_pdfs_diarios")
        .select("id, tribunal, status, total_paginas")
        .eq("data_publicacao", dataPublicacao);

      const { data: resultados } = await supabase
        .from("dje_resultados_busca")
        .select(`
          id,
          termo_encontrado,
          conteudo:dje_conteudo_indexado(
            pdf:dje_pdfs_diarios(tribunal, data_publicacao)
          )
        `)
        .eq("origem", "dje_pdf");

      // Stats DJEN API (sistema atual)
      const { data: publicacoes } = await supabase
        .from("publicacoes_djen")
        .select("id, tribunal")
        .eq("data_publicacao", dataPublicacao);

      // Processa dados
      const pdfsArr = pdfs || [];
      const resultadosArr = resultados || [];
      const publicacoesArr = publicacoes || [];

      // Tribunais DJE-PDF com matches
      const tribunaisDjePdf = new Map<string, number>();
      for (const r of resultadosArr) {
        const trib = (r as any).conteudo?.pdf?.tribunal || "desconhecido";
        tribunaisDjePdf.set(trib, (tribunaisDjePdf.get(trib) || 0) + 1);
      }

      // Tribunais DJEN API
      const tribunaisDjenApi = new Map<string, number>();
      for (const p of publicacoesArr) {
        const trib = (p as any).tribunal || "desconhecido";
        tribunaisDjenApi.set(trib, (tribunaisDjenApi.get(trib) || 0) + 1);
      }

      return {
        dje_pdf: {
          total_pdfs: pdfsArr.length,
          pdfs_processados: pdfsArr.filter(p => p.status === "processado").length,
          total_paginas: pdfsArr.reduce((acc, p) => acc + (p.total_paginas || 0), 0),
          total_matches: resultadosArr.length,
          tribunais: Array.from(tribunaisDjePdf.entries()).map(([tribunal, matches]) => ({ tribunal, matches })),
        },
        djen_api: {
          total_publicacoes: publicacoesArr.length,
          tribunais: Array.from(tribunaisDjenApi.entries()).map(([tribunal, count]) => ({ tribunal, count })),
        },
        sobreposicao: {
          // Por enquanto, estimativas simples
          matches_comuns: 0,
          exclusivos_dje_pdf: resultadosArr.length,
          exclusivos_djen_api: publicacoesArr.length,
        },
      };
    },
  });
}

// Mutation para baixar PDFs
export function useBaixarDjePdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { tribunal: string; data_publicacao?: string; caderno?: string }) => {
      const { data, error } = await supabase.functions.invoke("baixar-dje-pdf", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dje-pdfs"] });
      toast.success("Download iniciado");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Mutation para processar PDFs
export function useProcessarDjePdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { pdf_id?: string; limit?: number }) => {
      const { data, error } = await supabase.functions.invoke("processar-dje-pdf", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dje-pdfs"] });
      toast.success(`Processamento concluído: ${data?.processed || 0} PDFs`);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Mutation para buscar termos
export function useBuscarDjeInterno() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { data_publicacao?: string; tribunal?: string }) => {
      const { data, error } = await supabase.functions.invoke("buscar-dje-interno", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dje-resultados"] });
      queryClient.invalidateQueries({ queryKey: ["comparacao-stats"] });
      toast.success(`Busca concluída: ${data?.total_matches || 0} matches`);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Tribunais disponíveis para download
export const TRIBUNAIS_DJE_PDF = [
  { id: "TRT1", nome: "TRT1 - Rio de Janeiro" },
  { id: "TRT2", nome: "TRT2 - São Paulo" },
  { id: "TRT10", nome: "TRT10 - Brasília/Tocantins" },
  { id: "TRT23", nome: "TRT23 - Mato Grosso" },
  { id: "TRT24", nome: "TRT24 - Mato Grosso do Sul" },
  { id: "TST", nome: "TST - Tribunal Superior do Trabalho" },
];
