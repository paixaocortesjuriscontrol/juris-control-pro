import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  processo: any;
  onNavigate: (id: string) => void;
}

/** Cartão compacto da lista de Processos e Casos no celular. */
export function ProcessoCardMobile({ processo, onNavigate }: Props) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(processo.id)}
      className="w-full text-left p-3 flex items-start gap-2 active:bg-muted/60"
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-mono text-sm font-semibold text-foreground break-all">{processo.numero || "Sem número"}</div>
        <div className="text-sm text-foreground line-clamp-2">
          {processo.polo_ativo || processo.cliente?.nome || "—"}
          {processo.polo_passivo ? <span className="text-muted-foreground"> × {processo.polo_passivo}</span> : null}
        </div>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {processo.status && <Badge variant="secondary" className="text-[10px]">{processo.status}</Badge>}
          {processo.area && <Badge variant="outline" className="text-[10px]">{processo.area}</Badge>}
          {processo.tribunal && <Badge variant="outline" className="text-[10px]">{processo.tribunal}</Badge>}
        </div>
        {processo.advogado_responsavel?.nome && (
          <div className="text-xs text-muted-foreground">Resp.: {processo.advogado_responsavel.nome}</div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
    </button>
  );
}
