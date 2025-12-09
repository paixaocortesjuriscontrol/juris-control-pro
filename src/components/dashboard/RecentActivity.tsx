import { FileText, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentMovimentacoes } from "@/hooks/useDashboardData";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeIcons = {
  movimentacao: FileText,
  prazo: Clock,
  audiencia: AlertCircle,
  documento: CheckCircle,
};

export function RecentActivity() {
  const { data: movimentacoes, isLoading } = useRecentMovimentacoes(4);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="p-5 border-b border-border/50">
          <h2 className="font-serif text-lg font-semibold text-foreground">Atividades Recentes</h2>
        </div>
        <div className="divide-y divide-border/50">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!movimentacoes || movimentacoes.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="p-5 border-b border-border/50">
          <h2 className="font-serif text-lg font-semibold text-foreground">Atividades Recentes</h2>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Nenhuma movimentação recente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-foreground">Atividades Recentes</h2>
        <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground hidden sm:flex">
          Ver todas
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="divide-y divide-border/50">
        {movimentacoes.map((mov) => {
          const Icon = typeIcons.movimentacao;
          const timeAgo = formatDistanceToNow(new Date(mov.data_movimentacao), { 
            addSuffix: true, 
            locale: ptBR 
          });
          
          return (
            <div key={mov.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-status-active/10 text-status-active">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{mov.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {mov.processo?.numero || "Processo não encontrado"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">{timeAgo}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
