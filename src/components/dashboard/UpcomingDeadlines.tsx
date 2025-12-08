import { Calendar, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Deadline {
  id: string;
  title: string;
  processo: string;
  date: string;
  daysRemaining: number;
  priority: "low" | "medium" | "high";
}

const mockDeadlines: Deadline[] = [
  {
    id: "1",
    title: "Contestação",
    processo: "0005678-45.2024.8.19.0042",
    date: "09 Dez 2025",
    daysRemaining: 1,
    priority: "high",
  },
  {
    id: "2",
    title: "Recurso de Apelação",
    processo: "0001234-12.2024.8.19.0001",
    date: "12 Dez 2025",
    daysRemaining: 4,
    priority: "high",
  },
  {
    id: "3",
    title: "Réplica",
    processo: "0009012-78.2024.5.01.0034",
    date: "15 Dez 2025",
    daysRemaining: 7,
    priority: "medium",
  },
  {
    id: "4",
    title: "Alegações Finais",
    processo: "0003456-89.2024.8.19.0015",
    date: "22 Dez 2025",
    daysRemaining: 14,
    priority: "low",
  },
];

export function UpcomingDeadlines() {
  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "300ms" }}>
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gold" />
          <h2 className="font-serif text-lg font-semibold text-foreground">Prazos Próximos</h2>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {mockDeadlines.map((deadline) => (
          <div 
            key={deadline.id}
            className={cn(
              "p-3 rounded-lg border transition-all hover:shadow-soft cursor-pointer",
              deadline.priority === "high" && "border-status-urgent/30 bg-status-urgent/5",
              deadline.priority === "medium" && "border-status-pending/30 bg-status-pending/5",
              deadline.priority === "low" && "border-border/50 bg-muted/30"
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{deadline.title}</h4>
                <p className="text-xs text-muted-foreground font-mono">{deadline.processo}</p>
              </div>
              {deadline.priority === "high" && (
                <AlertTriangle className="w-4 h-4 text-status-urgent animate-pulse" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{deadline.date}</span>
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                deadline.daysRemaining <= 2 && "bg-status-urgent/15 text-status-urgent",
                deadline.daysRemaining > 2 && deadline.daysRemaining <= 7 && "bg-status-pending/15 text-status-pending",
                deadline.daysRemaining > 7 && "bg-status-active/15 text-status-active"
              )}>
                <Clock className="w-3 h-3" />
                {deadline.daysRemaining === 1 ? "Amanhã" : `${deadline.daysRemaining} dias`}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 pt-0">
        <Button variant="outline" className="w-full text-sm">
          Ver todos os prazos
        </Button>
      </div>
    </div>
  );
}
