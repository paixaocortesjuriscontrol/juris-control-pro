import { cn } from "@/lib/utils";

interface AtividadeBadgeProps {
  className?: string;
  title?: string;
}

/**
 * Indicador circular azul com a letra "A".
 * Sinaliza que um item (tarefa, prazo, audiência, evento etc.) possui
 * atividades (subatividades) vinculadas.
 */
export function AtividadeBadge({ className, title = "Possui atividades vinculadas" }: AtividadeBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-blue-500 text-white",
        "w-4 h-4 text-[9px] font-bold leading-none shrink-0",
        className
      )}
    >
      A
    </span>
  );
}
