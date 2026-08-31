import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna todas as coordenações vinculadas a um processo:
 * a coordenação "dona" (processos.coordenacao_id) + as coordenações
 * responsáveis (processos_coordenacoes_responsaveis).
 *
 * Usado na pasta do processo: quem participa do processo deve ver todos os
 * prazos/tarefas/eventos agendados por qualquer coordenação responsável,
 * evitando que um item agendado por outra equipe "desapareça".
 */
export function useCoordenacoesDoProcesso(processoId?: string | null) {
  return useQuery({
    queryKey: ["coordenacoes-do-processo", processoId],
    enabled: !!processoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const ids = new Set<string>();

      const { data: proc } = await supabase
        .from("processos")
        .select("coordenacao_id")
        .eq("id", processoId!)
        .maybeSingle();
      if ((proc as any)?.coordenacao_id) ids.add((proc as any).coordenacao_id);

      const { data: resp } = await supabase
        .from("processos_coordenacoes_responsaveis")
        .select("coordenacao_id")
        .eq("processo_id", processoId!);
      (resp || []).forEach((r: any) => {
        if (r?.coordenacao_id) ids.add(r.coordenacao_id);
      });

      return Array.from(ids);
    },
  });
}

/**
 * Amplia o escopo de coordenações do usuário com as coordenações do processo,
 * mas somente quando o usuário realmente participa do processo (interseção).
 */
export function ampliarEscopoComProcesso(
  coordenacoesUsuario: string[],
  coordenacoesProcesso: string[] | undefined
): string[] {
  if (!coordenacoesProcesso || coordenacoesProcesso.length === 0) return coordenacoesUsuario;
  const participa = coordenacoesProcesso.some((c) => coordenacoesUsuario.includes(c));
  if (!participa) return coordenacoesUsuario;
  return Array.from(new Set([...coordenacoesUsuario, ...coordenacoesProcesso]));
}
