import { supabase } from "@/integrations/supabase/client";
import { ETIQUETA_COLOR_PALETTE } from "@/hooks/useEtiquetas";

/**
 * Garante que exista uma etiqueta com o nome do cliente na coordenação
 * informada, marcando o próprio cliente e todos os processos/casos dele
 * naquela coordenação. Silencioso: não lança em caso de falha de permissão.
 */
export async function garantirEtiquetaCliente(params: {
  clienteId: string;
  nome: string;
  coordenacaoId?: string | null;
}): Promise<string | null> {
  const nome = (params.nome || "").trim();
  const coordenacaoId = params.coordenacaoId || null;
  if (!nome || !coordenacaoId || !params.clienteId) return null;

  try {
    const { data: existente } = await supabase
      .from("etiquetas")
      .select("id, nome, cliente_id")
      .eq("coordenacao_id", coordenacaoId)
      .or(`cliente_id.eq.${params.clienteId},nome.ilike.${nome.replace(/[,()]/g, " ")}`)
      .limit(20);

    let etiquetaId =
      (existente || []).find(
        (e: any) =>
          e.cliente_id === params.clienteId ||
          String(e.nome || "").trim().toLowerCase() === nome.toLowerCase(),
      )?.id || null;

    if (!etiquetaId) {
      const { data: userData } = await supabase.auth.getUser();
      const cor =
        ETIQUETA_COLOR_PALETTE[Math.floor(Math.random() * ETIQUETA_COLOR_PALETTE.length)];
      const { data, error } = await supabase
        .from("etiquetas")
        .insert({
          coordenacao_id: coordenacaoId,
          nome,
          cor,
          modulos: ["clientes", "processos", "publicacoes"],
          cliente_id: params.clienteId,
          created_by: userData.user?.id,
        } as any)
        .select("id")
        .single();
      if (error || !data) return null;
      etiquetaId = (data as any).id as string;
    }

    await supabase
      .from("etiquetas_itens")
      .insert({ etiqueta_id: etiquetaId, entidade: "cliente", entidade_id: params.clienteId } as any);

    await supabase.rpc("aplicar_etiqueta_cliente_base" as any, {
      _etiqueta_id: etiquetaId,
      _dry_run: false,
    } as any);

    return etiquetaId;
  } catch {
    return null;
  }
}
