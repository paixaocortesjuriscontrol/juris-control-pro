import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Resolve nomes/e-mails dos usuários citados em registros de auditoria. */
export function useUsuariosAuditoria(ids: (string | null)[]) {
  const userIds = useMemo(
    () => Array.from(new Set(ids.filter(Boolean) as string[])).sort(),
    [JSON.stringify(ids)]
  );

  const { data } = useQuery({
    queryKey: ["auditoria-usuarios", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const [{ data: basic }, { data }] = await Promise.all([
        supabase.from("profiles_basic").select("id, nome").in("id", userIds),
        supabase.from("profiles").select("id, nome, email").in("id", userIds),
      ]);
      const map: Record<string, { nome: string; email: string }> = {};
      (basic || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome || p.id, email: "" };
      });
      (data || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome || p.email || p.id, email: p.email || "" };
      });
      return map;
    },
  });

  return {
    map: data || {},
    nome: (id: string | null) => (id ? data?.[id]?.nome || id.slice(0, 8) : "Sistema"),
    email: (id: string | null) => (id ? data?.[id]?.email || "" : ""),
  };
}