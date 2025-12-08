import { FileText, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Activity {
  id: string;
  type: "movimentacao" | "prazo" | "audiencia" | "documento";
  title: string;
  processo: string;
  time: string;
  status?: "success" | "warning" | "urgent";
}

const mockActivities: Activity[] = [
  {
    id: "1",
    type: "movimentacao",
    title: "Nova movimentação processual",
    processo: "0001234-12.2024.8.19.0001",
    time: "Há 10 minutos",
    status: "success",
  },
  {
    id: "2",
    type: "prazo",
    title: "Prazo para contestação vence amanhã",
    processo: "0005678-45.2024.8.19.0042",
    time: "Há 1 hora",
    status: "urgent",
  },
  {
    id: "3",
    type: "audiencia",
    title: "Audiência de instrução agendada",
    processo: "0009012-78.2024.5.01.0034",
    time: "Há 2 horas",
    status: "warning",
  },
  {
    id: "4",
    type: "documento",
    title: "Petição protocolada com sucesso",
    processo: "0003456-89.2024.8.19.0015",
    time: "Há 3 horas",
    status: "success",
  },
];

const typeIcons = {
  movimentacao: FileText,
  prazo: Clock,
  audiencia: AlertCircle,
  documento: CheckCircle,
};

export function RecentActivity() {
  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-foreground">Atividades Recentes</h2>
        <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground">
          Ver todas
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="divide-y divide-border/50">
        {mockActivities.map((activity) => {
          const Icon = typeIcons[activity.type];
          return (
            <div key={activity.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  activity.status === "success" && "bg-status-active/10 text-status-active",
                  activity.status === "warning" && "bg-status-pending/10 text-status-pending",
                  activity.status === "urgent" && "bg-status-urgent/10 text-status-urgent"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{activity.processo}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
