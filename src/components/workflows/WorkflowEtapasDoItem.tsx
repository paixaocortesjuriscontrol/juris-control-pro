import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendente: { label: "Próxima (aguardando)", variant: "outline" },
  materializada: { label: "Em andamento", variant: "default" },
  concluida: { label: "Concluída", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

/** Mostra as etapas do fluxo (workflow) ao qual a tarefa pertence, incluindo as próximas. */
export function WorkflowEtapasDoItem({ itemId }: { itemId: string }) {
  const { data } = useQuery({
    queryKey: ["workflow-etapas-do-item", itemId],
    staleTime: 30_000,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: minha } = await sb.from("workflow_execucao_etapas").select("execucao_id").eq("item_id", itemId).limit(1).maybeSingle();
      if (!minha?.execucao_id) return null;
      const { data: exec } = await sb.from("workflow_execucoes").select("id, status, workflow_id, workflows(nome)").eq("id", minha.execucao_id).maybeSingle();
      const { data: etapasExec } = await sb.from("workflow_execucao_etapas").select("id, etapa_id, item_id, status, sucesso, ordem").eq("execucao_id", minha.execucao_id);
      const { data: etapasModelo } = await sb.from("workflow_etapas").select("id, titulo, ordem, dias_previsto, dias_fatal").eq("workflow_id", exec?.workflow_id);
      const porEtapa = new Map<string, any>((etapasExec || []).map((e: any) => [e.etapa_id, e]));
      const linhas = (etapasModelo || []).sort((a: any, b: any) => a.ordem - b.ordem).map((m: any) => ({ ...m, exec: porEtapa.get(m.id) }));
      return { nome: exec?.workflows?.nome || "Fluxo", status: exec?.status, linhas };
    },
  });
  if (!data) return null;
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <GitBranch className="h-4 w-4 text-primary" /> Fluxo: {data.nome}
        {data.status && <Badge variant="outline" className="ml-auto text-xs">{data.status === "em_andamento" ? "Em andamento" : data.status === "concluida" ? "Encerrado" : data.status}</Badge>}
      </div>
      <ol className="space-y-1">
        {data.linhas.map((l: any, i: number) => {
          const atual = l.exec?.item_id === itemId;
          const st = l.exec ? STATUS[l.exec.status] : { label: "Ainda não iniciada", variant: "outline" as const };
          return (
            <li key={l.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${atual ? "bg-primary/10 font-semibold" : ""}`}>
              <span className="text-muted-foreground w-5">{i + 1}.</span>
              <span className="flex-1">{l.titulo}{atual && " (esta tarefa)"}</span>
              <span className="text-muted-foreground">+{l.dias_previsto ?? 0}d</span>
              <Badge variant={st?.variant || "outline"} className="text-[10px]">{st?.label || l.exec?.status}</Badge>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
