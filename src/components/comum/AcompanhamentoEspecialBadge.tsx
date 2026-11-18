import { cn } from "@/lib/utils";

interface AcompanhamentoEspecialBadgeProps {
  className?: string;
  title?: string;
}

/**
 * Indicador circular vermelho com a letra "A".
 * Sinaliza que a atividade (tarefa, prazo, audiência, evento etc.) pertence a
 * um processo com Acompanhamento Especial ativo.
 */
export function AcompanhamentoEspecialBadge({
  className,
  title = "Processo em Acompanhamento Especial",
}: AcompanhamentoEspecialBadgeProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-red-600 text-white",
        "w-4 h-4 text-[9px] font-bold leading-none shrink-0",
        className
      )}
    >
      A
    </span>
  );
}
