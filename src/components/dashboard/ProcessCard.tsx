import { Calendar, User, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AreaType = "civil" | "trabalhista" | "empresarial";
export type StatusType = "pending" | "active" | "closed" | "urgent";

interface ProcessCardProps {
  numero: string;
  cliente: string;
  area: AreaType;
  status: StatusType;
  advogado: string;
  dataProximoEvento?: string;
  descricao?: string;
  delay?: number;
}

const areaLabels: Record<AreaType, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const statusLabels: Record<StatusType, string> = {
  pending: "Pendente",
  active: "Ativo",
  closed: "Encerrado",
  urgent: "Urgente",
};

export function ProcessCard({
  numero,
  cliente,
  area,
  status,
  advogado,
  dataProximoEvento,
  descricao,
  delay = 0,
}: ProcessCardProps) {
  return (
    <div 
      className="bg-card rounded-xl p-5 border border-border/50 shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge className={cn("badge-area-" + area, "text-xs font-medium px-2 py-0.5")}>
            {areaLabels[area]}
          </Badge>
          <Badge className={cn("badge-status-" + status, "text-xs font-medium px-2 py-0.5")}>
            {statusLabels[status]}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <h3 className="font-mono text-sm font-semibold text-foreground mb-1">{numero}</h3>
      <p className="text-foreground font-medium mb-2">{cliente}</p>
      {descricao && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{descricao}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <User className="w-4 h-4" />
          <span>{advogado}</span>
        </div>
        {dataProximoEvento && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{dataProximoEvento}</span>
          </div>
        )}
      </div>
    </div>
  );
}
