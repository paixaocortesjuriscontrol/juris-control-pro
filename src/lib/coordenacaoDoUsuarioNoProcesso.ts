import { supabase } from "@/integrations/supabase/client";

/** Regra pura: entre as coordenações do processo, prefere uma da qual o usuário é membro; senão, a principal. */
export function escolherCoordenacaoProcesso(principal: string | null, extras: string[], minhas: string[]): string | null {
  const todas = [principal, ...extras].filter(Boolean) as string[];
  const minhasSet = new Set(minhas);
  return todas.find((c) => minhasSet.has(c)) ?? principal ?? todas[0] ?? null;
}

/** Busca no banco e aplica a regra acima. */
export async function coordenacaoDoUsuarioNoProcesso(processoId: string, principal: string | null): Promise<string | null> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const [{ data: extras }, { data: membros }] = await Promise.all([
    supabase.from("processos_coordenacoes_responsaveis").select("coordenacao_id").eq("processo_id", processoId),
    uid ? supabase.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", uid) : Promise.resolve({ data: [] as any[] }),
  ]);
  return escolherCoordenacaoProcesso(
    principal,
    (extras || []).map((e: any) => e.coordenacao_id),
    (membros || []).map((m: any) => m.coordenacao_id),
  );
}
