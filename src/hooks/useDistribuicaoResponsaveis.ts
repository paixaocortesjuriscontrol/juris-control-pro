import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileBasic {
  id: string;
  nome: string;
}

/**
 * Lista perfis para escolher responsáveis.
 * Se `coordenacaoId` for passado, restringe aos membros daquela coordenação.
 */
export function useProfilesBasic(coordenacaoId?: string | null) {
  const [profiles, setProfiles] = useState<ProfileBasic[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      if (coordenacaoId) {
        // Busca membros da coordenação e faz join manual com profiles_basic
        const { data: membros } = await supabase
          .from("membros_coordenacao" as any)
          .select("usuario_id")
          .eq("coordenacao_id", coordenacaoId);
        const ids = ((membros as any[]) || []).map(m => m.usuario_id);
        if (ids.length === 0) {
          setProfiles([]);
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .in("id", ids)
          .order("nome");
        setProfiles((data as any[]) || []);
      } else {
        const { data } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .order("nome");
        setProfiles((data as any[]) || []);
      }
      setLoading(false);
    })();
  }, [coordenacaoId]);
  return { profiles, loading };
}

/** Carrega responsáveis vinculados a um dados_benner_id */
export function useResponsaveis(dadosBennerId: string | null | undefined) {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!dadosBennerId) { setIds([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("dados_benner_responsaveis" as any)
      .select("usuario_id")
      .eq("dados_benner_id", dadosBennerId);
    setIds(((data as any[]) || []).map(r => r.usuario_id));
    setLoading(false);
  }, [dadosBennerId]);

  useEffect(() => { reload(); }, [reload]);

  return { ids, setIds, loading, reload };
}

/** Salva (substitui) os responsáveis de um dados_benner */
export async function saveResponsaveis(dadosBennerId: string, usuarioIds: string[]) {
  // Remove todos os existentes
  await supabase
    .from("dados_benner_responsaveis" as any)
    .delete()
    .eq("dados_benner_id", dadosBennerId);

  if (usuarioIds.length === 0) return true;

  const rows = usuarioIds.map(uid => ({
    dados_benner_id: dadosBennerId,
    usuario_id: uid,
  }));
  const { error } = await supabase
    .from("dados_benner_responsaveis" as any)
    .insert(rows as any);
  return !error;
}

/** Carrega responsáveis para vários dados_benner_ids. Retorna Map<id, ProfileBasic[]> */
export async function loadResponsaveisMap(dadosBennerIds: string[]): Promise<Map<string, ProfileBasic[]>> {
  const map = new Map<string, ProfileBasic[]>();
  if (dadosBennerIds.length === 0) return map;
  const { data } = await supabase
    .from("dados_benner_responsaveis" as any)
    .select("dados_benner_id, usuario_id")
    .in("dados_benner_id", dadosBennerIds);

  const respRows = (data as any[]) || [];
  const userIds = [...new Set(respRows.map(r => r.usuario_id).filter(Boolean))];
  const profileMap = new Map<string, ProfileBasic>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles_basic" as any)
      .select("id, nome")
      .in("id", userIds);
    ((profs as any[]) || []).forEach((p: any) => profileMap.set(p.id, { id: p.id, nome: p.nome }));
  }

  respRows.forEach((row: any) => {
    const arr = map.get(row.dados_benner_id) || [];
    const prof = profileMap.get(row.usuario_id);
    if (prof) arr.push(prof);
    map.set(row.dados_benner_id, arr);
  });
  return map;
}
