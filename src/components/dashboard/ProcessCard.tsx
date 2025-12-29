import { Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export type AreaType = string; // Agora aceita qualquer área
export type StatusType = "pending" | "active" | "closed" | "urgent";

interface ProcessCardProps {
  id?: string;
  numero: string;
  cliente: string;
  area: AreaType;
  status: StatusType;
  advogado: string;
  dataProximoEvento?: string;
  descricao?: string;
  delay?: number;
}

// Cores para áreas conhecidas
const areaColors: Record<string, string> = {
  civil: "bg-area-civil",
  trabalhista: "bg-area-trabalhista",
  empresarial: "bg-area-empresarial",
  direito_privado: "bg-amber-500",
};

// Labels para áreas conhecidas
const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
  direito_privado: "Direito Privado",
};

// Função para obter label da área (suporta áreas dinâmicas)
const getAreaLabel = (area: string): string => {
  if (areaLabels[area]) return areaLabels[area];
  // Para áreas dinâmicas, formatar o slug como label
  return area
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Função para obter cor da área (suporta áreas dinâmicas)
const getAreaColor = (area: string): string => {
  if (areaColors[area]) return areaColors[area];
  // Para áreas dinâmicas, usar cor padrão
  return "bg-primary";
};

const statusLabels: Record<StatusType, string> = {
  pending: "Pendente",
  active: "Ativo",
  closed: "Encerrado",
  urgent: "Urgente",
};

export function ProcessCard({
  id,
  numero,
  cliente,
  area,
  status,
  advogado,
  dataProximoEvento,
  descricao,
  delay = 0,
}: ProcessCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (id) {
      navigate(`/processos/${id}`);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "bg-card rounded-xl p-5 border border-border/50 shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up",
        id && "cursor-pointer hover:border-primary/30"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge className={cn(getAreaColor(area), "text-white text-xs font-medium px-2 py-0.5")}>
            {getAreaLabel(area)}
          </Badge>
          <Badge className={cn("badge-status-" + status, "text-xs font-medium px-2 py-0.5")}>
            {statusLabels[status]}
          </Badge>
        </div>
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
