import { supabase } from "@/integrations/supabase/client";

interface Movimento {
  dataHora?: string;
  data?: string;
  nome: string;
  complemento?: string;
  codigo?: number;
  codigoNacional?: number;
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

    // When edge function returns 4xx/5xx, the error contains the response
    if (error) {
      // Extract error message from the response if available
      let errorMessage = error.message;
      try {
        // For FunctionsHttpError, the context contains the response body
        if (error.context) {
          const errorBody = await error.context.json();
          errorMessage = errorBody?.error || error.message;
        }
      } catch {
        // If we can't parse the error, use the default message
      }
      
      console.warn("API retornou erro (continuando importação):", errorMessage);
      // Return success: true but 0 movements - allows import to continue without blocking
      return { success: true, movimentosInseridos: 0, error: errorMessage };
    }

    // Check if the API returned an error in the response body (for 200 responses with error)
    if (data?.error) {
      console.warn("API retornou erro no body:", data.error);
      return { success: true, movimentosInseridos: 0, error: data.error };
    }

    // API returns 'movimentacoes', not 'movimentos'
    const movimentos: Movimento[] = data?.movimentacoes || data?.movimentos || [];
    
    if (!data?.found || movimentos.length === 0) {
      console.log("Nenhum andamento encontrado na API externa");
      return { success: true, movimentosInseridos: 0 };
    }

    // Get existing movements to avoid duplicates
    const { data: existingMovs } = await supabase
      .from("movimentacoes")
      .select("data_movimentacao, descricao")
      .eq("processo_id", processoId);

    const existingSet = new Set(
      (existingMovs || []).map((m) => `${m.data_movimentacao}|${m.descricao}`)
    );

    // Filter out duplicates and prepare new movements
    const movimentosToInsert = movimentos
      .map((mov) => {
        let descricaoCompleta = mov.nome || "Sem descrição";
        if (mov.complemento) {
          descricaoCompleta = `${descricaoCompleta} - ${mov.complemento}`;
        }
        // API returns dataHora (preferred) or data field
        const dataMovimentacao = mov.dataHora 
          ? new Date(mov.dataHora).toISOString().split("T")[0] 
          : (mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
        return {
          processo_id: processoId,
          descricao: descricaoCompleta,
          data_movimentacao: dataMovimentacao,
          tipo: mov.nome || "Movimentação",
          fonte: "DataJud/CNJ",
        };
      })
      .filter((mov) => !existingSet.has(`${mov.data_movimentacao}|${mov.descricao}`));

    if (movimentosToInsert.length === 0) {
      console.log("Nenhum andamento novo para inserir");
      return { success: true, movimentosInseridos: 0 };
    }

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
