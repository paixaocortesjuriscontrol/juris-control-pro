import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComentarioBadgeProps {
  className?: string;
  title?: string;
  /** Exibe a bolinha vermelha de "comentário não visto". */
  naoVisto?: boolean;
  /**
   * Autoria dos comentários: "meu" (verde), "outros" (amarelo) e "ambos" (azul).
   * Sem valor, mantém o amarelo padrão.
   */
  autoria?: "meu" | "outros" | "ambos" | "cobranca" | null;
}

const COR_AUTORIA: Record<string, string> = {
  meu: "text-green-600",
  outros: "text-amber-500",
  ambos: "text-blue-600",
  cobranca: "text-red-600",
};

const TITULO_AUTORIA: Record<string, string> = {
  meu: "Você comentou",
  outros: "Comentário de outro usuário",
  ambos: "Comentários seus e de outros usuários",
  cobranca: "Comentário de cobrança",
};

/**
 * Balãozinho de comentários. Sinaliza que um item (tarefa, prazo, audiência,
 * evento etc.) possui comentários vinculados. Quando `naoVisto` é verdadeiro,
 * mostra uma bolinha vermelha no canto indicando comentário ainda não lido.
 */
export function ComentarioBadge({
  className,
  title = "Possui comentários",
  naoVisto = false,
  autoria = null,
}: ComentarioBadgeProps) {
  const cor = (autoria && COR_AUTORIA[autoria]) || "text-amber-500";
  const tituloBase = (autoria && TITULO_AUTORIA[autoria]) || title;
  return (
    <span
      title={naoVisto ? `Comentário não visto — ${tituloBase}` : tituloBase}
      className="relative inline-flex shrink-0 items-center justify-center"
    >
      <MessageCircle
        className={cn("w-4 h-4", cor, className)}
        strokeWidth={2.5}
        aria-hidden
      />
      {naoVisto && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-background" />
      )}
    </span>
  );
}
