import { PrazoTst } from "@/hooks/usePrazosTst";
import { differenceInCalendarDays } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Props {
  prazo: PrazoTst;
  onClick: () => void;
}

export function TstPrazoCard({ prazo, onClick }: Props) {
  const navigate = useNavigate();
  const dias = prazo.data_fatal ? differenceInCalendarDays(new Date(prazo.data_fatal + "T12:00:00"), new Date()) : null;

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-mono font-semibold text-foreground truncate flex-1">
          {prazo.numero_processo || "Sem nº"}
        </p>
        <Badge variant={dias <= 1 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
          {dias <= 0 ? "VENCIDO" : `${dias}d`}
        </Badge>
      </div>
      {prazo.autor && <p className="text-xs text-muted-foreground truncate">{prazo.autor}</p>}
      {prazo.responsavel && (
        <p className="text-xs text-muted-foreground truncate">Resp: {prazo.responsavel}</p>
      )}
      {prazo.processo_id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/processos/${prazo.processo_id}`);
          }}
          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Ver Processo
        </button>
      )}
    </div>
  );
}
