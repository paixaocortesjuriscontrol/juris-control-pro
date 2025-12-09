import { supabase } from "@/integrations/supabase/client";

interface Movimento {
  data: string;
  nome: string;
  complemento?: string;
}

interface BuscarAndamentosResult {
  success: boolean;
  movimentosInseridos: number;
  error?: string;
}

export async function buscarAndamentosExternos(
  processoId: string,
  numeroProcesso: string
): Promise<BuscarAndamentosResult> {
  try {
    console.log(`Buscando andamentos externos para processo ${numeroProcesso}`);

    // Call the edge function to get movements
    const { data, error } = await supabase.functions.invoke("consultar-processo", {
      body: { numeroProcesso },
    });

    if (error) {
      console.error("Erro ao consultar API externa:", error);
      return { success: false, movimentosInseridos: 0, error: error.message };
    }

    if (!data?.found || !data?.movimentos || data.movimentos.length === 0) {
      console.log("Nenhum andamento encontrado na API externa");
      return { success: true, movimentosInseridos: 0 };
    }

    const movimentos: Movimento[] = data.movimentos;

    // Insert movements into the database
    const movimentosToInsert = movimentos.map((mov) => ({
      processo_id: processoId,
      descricao: mov.nome || "Sem descrição",
      data_movimentacao: mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      tipo: "API Externa",
      fonte: "DataJud/CNJ",
    }));

    const { error: insertError } = await supabase
      .from("movimentacoes")
      .insert(movimentosToInsert);

    if (insertError) {
      console.error("Erro ao inserir movimentações:", insertError);
      return { success: false, movimentosInseridos: 0, error: insertError.message };
    }

    console.log(`${movimentosToInsert.length} andamentos inseridos com sucesso`);
    return { success: true, movimentosInseridos: movimentosToInsert.length };
  } catch (err: any) {
    console.error("Erro ao buscar andamentos:", err);
    return { success: false, movimentosInseridos: 0, error: err.message };
  }
}
