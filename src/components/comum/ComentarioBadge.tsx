import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComentarioBadgeProps {
  className?: string;
  title?: string;
  /** Exibe a bolinha vermelha de "comentário não visto". */
  naoVisto?: boolean;
}

/**
 * Balãozinho de comentários. Sinaliza que um item (tarefa, prazo, audiência,
 * evento etc.) possui comentários vinculados. Quando `naoVisto` é verdadeiro,
 * mostra uma bolinha vermelha no canto indicando comentário ainda não lido.
 */
export function ComentarioBadge({
  className,
  title = "Possui comentários",
  naoVisto = false,
}: ComentarioBadgeProps) {
  return (
    <span
      title={naoVisto ? "Comentário não visto" : title}
      className="relative inline-flex shrink-0 items-center justify-center"
    >
      <MessageCircle
        className={cn("w-4 h-4 text-amber-500", className)}
        strokeWidth={2.5}
        aria-hidden
      />
      {naoVisto && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-background" />
      )}
    </span>
  );
}
