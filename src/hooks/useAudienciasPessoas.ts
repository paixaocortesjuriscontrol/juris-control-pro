import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AudienciaPessoas {
  responsaveis: string[];
  envolvidos: string[];
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Busca em lote os responsáveis (advogados) e envolvidos de várias audiências,
 * retornando os nomes já resolvidos por audiência.
 */
export function useAudienciasPessoas(audienciaIds: string[]) {
  const ids = Array.from(new Set(audienciaIds.filter(Boolean))).sort();

  return useQuery({
    queryKey: ["audiencias-pessoas", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, AudienciaPessoas>> => {
      const mapa: Record<string, AudienciaPessoas> = {};
      const userIds = new Set<string>();
      const resp: Record<string, string[]> = {};
      const env: Record<string, string[]> = {};

      await Promise.all(
        chunk(ids, 150).flatMap((parte) => [
          (async () => {
            const { data } = await supabase
              .from("audiencias_advogados")
              .select("audiencia_id, advogado_id")
              .in("audiencia_id", parte);
            (data || []).forEach((r: any) => {
              if (!r.advogado_id) return;
              (resp[r.audiencia_id] ||= []).push(r.advogado_id);
              userIds.add(r.advogado_id);
            });
          })(),
          (async () => {
            const { data } = await supabase
              .from("audiencia_envolvidos")
              .select("audiencia_id, usuario_id")
              .in("audiencia_id", parte);
            (data || []).forEach((r: any) => {
              if (!r.usuario_id) return;
              (env[r.audiencia_id] ||= []).push(r.usuario_id);
              userIds.add(r.usuario_id);
            });
          })(),
        ]),
      );

      const nomes: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: perfis } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .in("id", Array.from(userIds));
        (perfis || []).forEach((p: any) => {
          nomes[p.id] = p.nome || "Usuário";
        });
      }

      ids.forEach((id) => {
        mapa[id] = {
          responsaveis: (resp[id] || []).map((u) => nomes[u]).filter(Boolean),
          envolvidos: (env[id] || []).map((u) => nomes[u]).filter(Boolean),
        };
      });
      return mapa;
    },
  });
}
