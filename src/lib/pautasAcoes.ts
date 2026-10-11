import { supabase } from "@/integrations/supabase/client";
import type { PautaTst } from "@/hooks/usePautasTst";

export const COORD_RENATA = "b0f690ad-68da-43d7-af5f-9adafeab3fd5";

const fmtCnj = (d: string) => `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;

/**
 * Liga a pauta a uma ficha em Processos e Casos. Se o processo não existir,
 * cadastra na Coordenação Dra. Renata Oficial e consulta a Judit. Retorna o resultado.
 */
export async function importarProcessoDaPauta(p: PautaTst): Promise<{ processoId: string; novo: boolean; judit: boolean }> {
  const dig = String(p.processo_numero || "").replace(/\D/g, "");
  if (dig.length !== 20) throw new Error("Número de processo inválido");
  const numero = fmtCnj(dig);
  let processoId = p.processo_id || null;
  let novo = false;
  if (!processoId) {
    const { data: ex } = await supabase.from("processos").select("id").in("numero", [numero, dig]).limit(1);
    processoId = (ex as any[])?.[0]?.id || null;
  }
  if (!processoId) {
    const { data, error } = await supabase
      .from("processos")
      .insert({
        numero, area: "trabalhista", status: "ativo", coordenacao_id: COORD_RENATA,
        tribunal: "TST", polo_ativo: p.reclamante || null, polo_passivo: p.reclamada || null,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    processoId = (data as any).id;
    novo = true;
  }
  await supabase.from("pautas_tst" as any).update({ processo_id: processoId }).eq("id", p.id);
  let judit = false;
  if (novo) {
    const { error } = await supabase.functions.invoke("consultar-processo-judit", { body: { processo_id: processoId } });
    judit = !error;
  }
  return { processoId: processoId!, novo, judit };
}

export async function carregarMembrosRenata(): Promise<{ id: string; nome: string }[]> {
  const { data: m } = await supabase.from("membros_coordenacao").select("user_id").eq("coordenacao_id", COORD_RENATA);
  const ids = [...new Set(((m as any[]) || []).map((x) => x.user_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles_basic" as any).select("id, nome").in("id", ids);
  return ((data as any[]) || []).filter((x) => x.nome).sort((a, b) => a.nome.localeCompare(b.nome));
}
