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
    <div className={`inline-flex flex-wrap gap-1 items-center ${className || ""}`}>
      {etiquetas.map((e) => (
        <Badge
          key={e.id}
          className="text-[10px] px-1 py-0 h-4 text-primary-foreground hover:opacity-90"
          style={{ backgroundColor: e.cor }}
          title={e.nome}
        >
          {e.nome}
        </Badge>
      ))}
    </div>
  );
}