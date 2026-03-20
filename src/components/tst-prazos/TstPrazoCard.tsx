import { ProcessoTst } from "@/hooks/usePrazosTst";
import { differenceInCalendarDays } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Props {
  processo: ProcessoTst;
  onClick: () => void;
}

export function TstPrazoCard({ processo, onClick }: Props) {
  const navigate = useNavigate();
  const dias = processo.data_fatal
    ? differenceInCalendarDays(new Date(processo.data_fatal + "T12:00:00"), new Date())
    : null;

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-mono font-semibold text-foreground truncate flex-1">
          {processo.numero || "Sem nº"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <span>{processo.data_fatal || "Sem prazo"}</span>
        <Badge variant={dias !== null && dias <= 1 ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 leading-tight">
          {dias === null ? "S/P" : dias <= 0 ? "VENCIDO" : `${dias}d`}
        </Badge>
      </div>
      {processo.polo_ativo && <p className="text-xs text-muted-foreground truncate">{processo.polo_ativo}</p>}
      {processo.responsavel_tst && (
        <p className="text-xs text-muted-foreground truncate">Resp: {processo.responsavel_tst}</p>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/processos/${processo.id}`);
        }}
        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
      >
        <ExternalLink className="w-3 h-3" /> Ver Processo
      </button>
    </div>
  );
}
