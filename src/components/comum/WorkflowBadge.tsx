import { cn } from "@/lib/utils";

interface WorkflowBadgeProps {
  className?: string;
  title?: string;
}

/**
 * Indicador circular verde com a letra "W".
 * Sinaliza que o item (tarefa, prazo, audiência, evento etc.) foi criado
 * automaticamente por um Workflow.
 */
export function WorkflowBadge({ className, title = "Item criado por Workflow" }: WorkflowBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-green-600 text-white",
        "w-4 h-4 text-[9px] font-bold leading-none shrink-0",
        className
      )}
    >
      W
    </span>
  );
}
