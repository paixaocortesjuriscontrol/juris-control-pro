import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration } from "@/hooks/useMonitoringDashboard";
import { cn } from "@/lib/utils";

type ExecucaoRow = {
  id: string;
  status: string;
  iniciado_em: string;
  finalizado_em: string | null;
  ultimo_erro: string | null;
  detalhes: Record<string, any> | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function statusBadgeVariant(status: string): { label: string; className: string } {
  switch (status) {
    case "concluido":
      return { label: "Concluído", className: "bg-primary/10 text-primary border-primary/20" };
    case "executando":
      return { label: "Executando", className: "bg-primary/10 text-primary border-primary/20" };
    case "cancelado":
      return { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" };
    case "timeout":
      return { label: "Timeout", className: "bg-destructive/10 text-destructive border-destructive/20" };
    case "erro":
      return { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20" };
    default:
      return { label: status || "-", className: "bg-muted text-muted-foreground border-border" };
  }
}

export function DjenExecucoesHistoricoDialog({ open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["execucoes_agendadas", "djen", "historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes_agendadas")
        .select("id,status,iniciado_em,finalizado_em,ultimo_erro,detalhes")
        .eq("tipo", "djen")
        .order("iniciado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ExecucaoRow[];
    },
    enabled: open,
  });

  const rows = data ?? [];

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }

    if (rows.length === 0) {
      return <div className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</div>;
    }

    return (
      <div className="max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const badge = statusBadgeVariant(r.status);
              const detalhes = r.detalhes || {};
              const total = Number(detalhes.total ?? 0);
              const processados = Number(detalhes.processados ?? detalhes.current ?? 0);
              const duracao = Number(detalhes.duracao_s ?? 0);
              const progressoTxt = total > 0 ? `${processados}/${total}` : (processados > 0 ? String(processados) : "-");
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-medium", badge.className)}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.iniciado_em)}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.finalizado_em ? formatDateTime(r.finalizado_em) : "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{duracao > 0 ? formatDuration(duracao) : "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{progressoTxt}</TableCell>
                  <TableCell className="max-w-[320px] truncate" title={r.ultimo_erro || undefined}>
                    {r.ultimo_erro || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }, [isLoading, rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Histórico de Execuções (DJEN Termos)</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
