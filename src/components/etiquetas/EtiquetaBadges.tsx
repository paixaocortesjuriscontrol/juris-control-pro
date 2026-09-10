import { Badge } from "@/components/ui/badge";
import type { Etiqueta } from "@/hooks/useEtiquetas";

interface Props {
  etiquetas: Etiqueta[];
  className?: string;
}

/** Exibição somente leitura das etiquetas aplicadas. */
export function EtiquetaBadges({ etiquetas, className }: Props) {
  if (etiquetas.length === 0) return null;
  return (
    <div className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 ${className || ""}`}>
      {etiquetas.map((e) => (
        <Badge
          key={e.id}
          className="h-auto min-h-5 max-w-full whitespace-normal break-words px-2 py-0.5 text-left text-[10px] leading-tight text-primary-foreground hover:opacity-90"
          style={{ backgroundColor: e.cor }}
          title={e.nome}
        >
          {e.nome}
        </Badge>
      ))}
    </div>
  );
}