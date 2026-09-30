import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnexoBadgeProps {
  className?: string;
  title?: string;
}

/**
 * Clipe de papel. Sinaliza que um item (tarefa, prazo, audiência, evento etc.)
 * possui anexos (documentos) vinculados.
 */
export function AnexoBadge({ className, title = "Possui anexos" }: AnexoBadgeProps) {
  return (
    <Paperclip
      title={title}
      aria-hidden
      className={cn("w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400", className)}
      strokeWidth={2.5}
    />
  );
}
