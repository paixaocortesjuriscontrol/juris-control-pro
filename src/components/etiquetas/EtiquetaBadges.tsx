import { Badge } from "@/components/ui/badge";
import { agruparEtiquetasPorNome, type Etiqueta } from "@/hooks/useEtiquetas";

interface Props {
  etiquetas: Etiqueta[];
  className?: string;
}

/** Exibição somente leitura das etiquetas aplicadas (sem repetir nomes iguais). */
export function EtiquetaBadges({ etiquetas, className }: Props) {
  if (etiquetas.length === 0) return null;
  const grupos = agruparEtiquetasPorNome(etiquetas);
  return (
    <div className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 ${className || ""}`}>
      {grupos.map(({ principal: e }) => (
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