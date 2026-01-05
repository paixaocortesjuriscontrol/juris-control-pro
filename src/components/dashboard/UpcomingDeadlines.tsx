import { Calendar, AlertTriangle, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingPrazos } from "@/hooks/useDashboardData";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export function UpcomingDeadlines() {
  const navigate = useNavigate();
  const { data: prazos, isLoading } = useUpcomingPrazos(4);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "300ms" }}>
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Prazos Próximos</h2>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!prazos || prazos.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "300ms" }}>
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Prazos Próximos</h2>
          </div>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Nenhum prazo pendente</p>
        </div>
      </div>
    );
  }

  const getPriorityFromDays = (days: number): "high" | "medium" | "low" => {
    if (days <= 2) return "high";
    if (days <= 7) return "medium";
    return "low";
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "300ms" }}>
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gold" />
          <h2 className="font-serif text-lg font-semibold text-foreground">Prazos Próximos</h2>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {prazos.map((prazo: any) => {
          const dataVencimento = new Date(prazo.data_vencimento);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const daysRemaining = differenceInDays(dataVencimento, hoje);
          const priority = getPriorityFromDays(daysRemaining);
          const formattedDate = format(dataVencimento, "dd MMM yyyy", { locale: ptBR });
          const processoNumero = Array.isArray(prazo.processo) ? prazo.processo[0]?.numero : prazo.processo?.numero;

          return (
            <div 
              key={prazo.id}
              onClick={() => navigate(`/prazos?prazoId=${prazo.id}`)}
              className={cn(
                "p-3 rounded-lg border transition-all hover:shadow-soft cursor-pointer",
                priority === "high" && "border-status-urgent/30 bg-status-urgent/5",
                priority === "medium" && "border-status-pending/30 bg-status-pending/5",
                priority === "low" && "border-border/50 bg-muted/30"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground truncate">{prazo.titulo}</h4>
                  {prazo.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {prazo.descricao}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                    {processoNumero || "Sem processo"}
                  </p>
                </div>
                {priority === "high" && (
                  <AlertTriangle className="w-4 h-4 text-status-urgent animate-pulse flex-shrink-0 ml-2" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formattedDate}</span>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  daysRemaining <= 2 && "bg-status-urgent/15 text-status-urgent",
                  daysRemaining > 2 && daysRemaining <= 7 && "bg-status-pending/15 text-status-pending",
                  daysRemaining > 7 && "bg-status-active/15 text-status-active"
                )}>
                  <Clock className="w-3 h-3" />
                  {daysRemaining === 0 ? "Hoje" : daysRemaining === 1 ? "Amanhã" : `${daysRemaining} dias`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-4 pt-0">
        <Button variant="outline" className="w-full text-sm" onClick={() => navigate("/prazos")}>
          Ver todos os prazos
        </Button>
      </div>
    </div>
  );
}
