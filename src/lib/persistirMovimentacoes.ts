import { supabase } from "@/integrations/supabase/client";

export interface MovimentacaoParaGravar {
  data?: string | null;
  descricao?: string | null;
  codigo?: string | number | null;
  complementos?: string[] | null;
  raw?: any;
}

const soData = (v?: string | null) => {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
};

/**
 * Grava andamentos na tabela `movimentacoes` sem duplicar (compara data + descrição).
 * Retorna a quantidade efetivamente inserida.
 */
export async function persistirMovimentacoes(
  processoId: string,
  movs: MovimentacaoParaGravar[],
  fonte: string,
): Promise<number> {
  if (!processoId || !Array.isArray(movs) || movs.length === 0) return 0;

  const { data: existentes } = await supabase
    .from("movimentacoes")
    .select("data_movimentacao, descricao")
    .eq("processo_id", processoId)
    .limit(5000);

  const jaTem = new Set(
    ((existentes as any[]) || []).map(
      (m) => `${String(m.data_movimentacao || "").substring(0, 10)}|${String(m.descricao || "").trim()}`,
    ),
  );

  const rows: any[] = [];
  for (const m of movs) {
    const data = soData(m.data);
    const complementos = Array.isArray(m.complementos) ? m.complementos.filter(Boolean) : [];
    const descricao = String(m.descricao || complementos.join("; ") || "").trim();
    if (!data || !descricao) continue;
    const key = `${data}|${descricao}`;
    if (jaTem.has(key)) continue;
    jaTem.add(key);
    rows.push({
      processo_id: processoId,
      data_movimentacao: `${data}T12:00:00.000Z`,
      descricao,
      tipo: null,
      fonte,
      codigo: m.codigo != null && m.codigo !== "" ? String(m.codigo) : null,
      raw: m.raw ?? { complementos },
    });
  }

  if (rows.length === 0) return 0;

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("movimentacoes").insert(rows.slice(i, i + 200) as any);
    if (error) throw error;
  }
  return rows.length;
}
