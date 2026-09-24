import { cn } from "@/lib/utils";

interface PublicacaoBadgeProps {
  className?: string;
  title?: string;
}

/**
 * Indicador circular azul com a letra "P".
 * Sinaliza que o item (tarefa, prazo, audiência etc.) foi criado a partir
 * de uma publicação DJEN.
 */
export function PublicacaoBadge({
  className,
  title = "Item criado a partir de publicação",
}: PublicacaoBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-blue-600 text-white",
        "w-4 h-4 text-[9px] font-bold leading-none shrink-0",
        className
      )}
    >
      P
    </span>
  );
}
