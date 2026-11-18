import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, GitBranch, Loader2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataDetalhe } from "@/lib/detalheItemResponsabilidade";
import { cn } from "@/lib/utils";

const STATUS_ETAPA: Record<string, string> = {
  pendente: "Aguardando",
  materializada: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function statusLabel(status?: string | null) {
  if (!status) return "Não iniciada";
  return STATUS_ETAPA[status] ?? status.replace(/_/g, " ");
}

interface Props {
  itemId: string;
  active: boolean;
}

export function WorkflowItemResponsabilidade({ itemId, active }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["minhas-responsabilidades", "workflow-item-completo", itemId],
    enabled: active && !!itemId,
    staleTime: 30_000,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: vinculo, error: erroVinculo } = await sb
        .from("workflow_execucao_etapas")
        .select("execucao_id")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (erroVinculo) throw erroVinculo;
      if (!vinculo?.execucao_id) return null;

      const { data: execucao, error: erroExecucao } = await sb
        .from("workflow_execucoes")
        .select("*, workflows(nome, descricao, ativo), coordenacoes(nome)")
        .eq("id", vinculo.execucao_id)
        .maybeSingle();
      if (erroExecucao) throw erroExecucao;
      if (!execucao) return null;

      const [modeloRes, execEtapasRes, iniciadoPorRes] = await Promise.all([
        sb.from("workflow_etapas").select("id, titulo, descricao, ordem, tipo_item, dias_previsto, dias_fatal, prioridade").eq("workflow_id", execucao.workflow_id).order("ordem"),
        sb.from("workflow_execucao_etapas").select("*").eq("execucao_id", execucao.id).order("ordem"),
        execucao.iniciado_por
          ? sb.from("profiles_basic").select("id, nome").eq("id", execucao.iniciado_por).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (modeloRes.error) throw modeloRes.error;
      if (execEtapasRes.error) throw execEtapasRes.error;
      if (iniciadoPorRes.error) throw iniciadoPorRes.error;

      const etapaIds = (modeloRes.data ?? []).map((etapa: any) => etapa.id);
      let responsaveis: any[] = [];
      let envolvidos: any[] = [];
      if (etapaIds.length > 0) {
        const [respRes, envRes] = await Promise.all([
          sb.from("workflow_etapa_responsaveis").select("etapa_id, usuario_id").in("etapa_id", etapaIds),
          sb.from("workflow_etapa_envolvidos").select("etapa_id, usuario_id").in("etapa_id", etapaIds),
        ]);
        if (respRes.error) throw respRes.error;
        if (envRes.error) throw envRes.error;
        responsaveis = respRes.data ?? [];
        envolvidos = envRes.data ?? [];
      }

      const usuarioIds = [...new Set([...responsaveis, ...envolvidos].map((row) => row.usuario_id).filter(Boolean))];
      let nomes = new Map<string, string>();
      if (usuarioIds.length > 0) {
        const { data: perfis, error: erroPerfis } = await sb.from("profiles_basic").select("id, nome").in("id", usuarioIds);
        if (erroPerfis) throw erroPerfis;
        nomes = new Map((perfis ?? []).map((perfil: any) => [perfil.id, perfil.nome]));
      }

      const execPorEtapa = new Map<string, any>((execEtapasRes.data ?? []).map((etapa: any) => [etapa.etapa_id, etapa]));
      const etapas = (modeloRes.data ?? []).map((etapa: any) => ({
        ...etapa,
        execucao: execPorEtapa.get(etapa.id) ?? null,
        responsaveis: responsaveis.filter((row) => row.etapa_id === etapa.id).map((row) => nomes.get(row.usuario_id)).filter(Boolean),
        envolvidos: envolvidos.filter((row) => row.etapa_id === etapa.id).map((row) => nomes.get(row.usuario_id)).filter(Boolean),
      }));
      return { execucao, etapas, iniciadoPor: iniciadoPorRes.data?.nome ?? null };
    },
  });

  if (!active) return null;
  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Carregando workflow...</div>;
  }
  if (error) {
    return <div className="m-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar o workflow: {(error as Error).message}</div>;
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <GitBranch className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-medium">Atividade fora de um workflow</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">Esta atividade não pertence a uma execução de workflow.</p>
      </div>
    );
  }

  const { execucao, etapas, iniciadoPor } = data;
  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">{execucao.workflows?.nome ?? "Workflow"}</h3>
              <Badge variant="outline">{statusLabel(execucao.status)}</Badge>
              {execucao.workflows?.ativo === false && <Badge variant="secondary">Modelo desabilitado</Badge>}
            </div>
            {execucao.workflows?.descricao && <p className="mt-2 text-sm text-muted-foreground">{execucao.workflows.descricao}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open(`/workflow?id=${execucao.workflow_id}`, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir workflow
          </Button>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Coordenação</dt><dd className="mt-0.5 font-medium">{execucao.coordenacoes?.nome ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Iniciado em</dt><dd className="mt-0.5 font-medium">{formatarDataDetalhe(execucao.data_inicio, true)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Iniciado por</dt><dd className="mt-0.5 font-medium">{iniciadoPor ?? "—"}</dd></div>
        </dl>
        {execucao.observacoes && <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm"><span className="font-medium">Observações: </span>{execucao.observacoes}</div>}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Etapas do fluxo</h3>
          <Badge variant="secondary">{etapas.length} etapas</Badge>
        </div>
        <ol className="space-y-3">
          {etapas.map((etapa: any, indice: number) => {
            const atual = etapa.execucao?.item_id === itemId;
            const concluida = etapa.execucao?.status === "concluida";
            return (
              <li key={etapa.id} className={cn("rounded-lg border bg-card p-4", atual && "border-primary ring-1 ring-primary/30")}>
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold", atual && "bg-primary text-primary-foreground", concluida && "bg-primary/15 text-primary")}>
                    {concluida ? <CheckCircle2 className="h-4 w-4" /> : indice + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium">{etapa.titulo}</h4>
                      {atual && <Badge>Esta atividade</Badge>}
                      <Badge variant="outline">{statusLabel(etapa.execucao?.status)}</Badge>
                      <Badge variant="secondary">{etapa.tipo_item}</Badge>
                    </div>
                    {etapa.descricao && <p className="text-sm text-muted-foreground">{etapa.descricao}</p>}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>Previsto: +{etapa.dias_previsto ?? 0} dia(s)</span>
                      {etapa.dias_fatal != null && <span>Fatal: +{etapa.dias_fatal} dia(s)</span>}
                      {etapa.execucao?.data_prevista_calculada && <span>Data prevista: {formatarDataDetalhe(etapa.execucao.data_prevista_calculada)}</span>}
                      {etapa.execucao?.data_fatal_calculada && <span>Data fatal: {formatarDataDetalhe(etapa.execucao.data_fatal_calculada)}</span>}
                    </div>
                    {(etapa.responsaveis.length > 0 || etapa.envolvidos.length > 0) && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div className="space-y-0.5">
                          {etapa.responsaveis.length > 0 && <p><span className="font-medium">Responsáveis:</span> {etapa.responsaveis.join(", ")}</p>}
                          {etapa.envolvidos.length > 0 && <p><span className="font-medium">Envolvidos:</span> {etapa.envolvidos.join(", ")}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
