import { cn } from "@/lib/utils";

interface ComentarioBadgeProps {
  className?: string;
  title?: string;
}

/**
 * Indicador circular âmbar com a letra "C".
 * Sinaliza que um item (tarefa, prazo, audiência, evento etc.) possui
 * comentários vinculados.
 */
export function ComentarioBadge({ className, title = "Possui comentários" }: ComentarioBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-amber-500 text-white",
        "w-4 h-4 text-[9px] font-bold leading-none shrink-0",
        className
      )}
    >
      C
    </span>
  );
}
