import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck } from "lucide-react";

interface Props {
  audienciaId: string;
  className?: string;
}

/**
 * Mostra os responsáveis (advogados) e envolvidos de uma audiência.
 */
export function AudienciaResponsaveisResumo({ audienciaId, className }: Props) {
  const { data } = useQuery({
    queryKey: ["audiencia-responsaveis-resumo", audienciaId],
    queryFn: async () => {
      const [advs, envs] = await Promise.all([
        supabase.from("audiencias_advogados").select("advogado_id").eq("audiencia_id", audienciaId),
        supabase.from("audiencia_envolvidos").select("usuario_id").eq("audiencia_id", audienciaId),
      ]);

      const respIds = (advs.data || []).map((r: any) => r.advogado_id).filter(Boolean);
      const envIds = (envs.data || []).map((r: any) => r.usuario_id).filter(Boolean);
      const todos = Array.from(new Set([...respIds, ...envIds]));

      let nomes: Record<string, string> = {};
      if (todos.length > 0) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", todos);
        nomes = Object.fromEntries((perfis || []).map((p: any) => [p.id, p.nome || p.email || "—"]));
      }

      return {
        responsaveis: respIds.map((id: string) => nomes[id]).filter(Boolean) as string[],
        envolvidos: envIds.map((id: string) => nomes[id]).filter(Boolean) as string[],
      };
    },
    enabled: !!audienciaId,
    staleTime: 60_000,
  });

  const responsaveis = data?.responsaveis ?? [];
  const envolvidos = data?.envolvidos ?? [];

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsáveis</span>
          {responsaveis.length > 0 ? (
            responsaveis.map((nome) => (
              <Badge key={nome} variant="secondary" className="text-[10px]">{nome}</Badge>
            ))
          ) : (
            <span className="text-muted-foreground">Sem responsável</span>
          )}
        </div>
        {envolvidos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Envolvidos</span>
            {envolvidos.map((nome) => (
              <Badge key={nome} variant="outline" className="text-[10px]">{nome}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}