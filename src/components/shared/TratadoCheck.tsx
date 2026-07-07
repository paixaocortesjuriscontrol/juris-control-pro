import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tratado: boolean;
  className?: string;
  size?: number;
  title?: string;
}

/**
 * Ícone V verde padronizado para indicar que um item (tarefa/prazo/audiência/evento)
 * foi tratado/concluído. Retorna null quando o item não está tratado.
 */
export function TratadoCheck({ tratado, className, size = 14, title = "Tratado" }: Props) {
  if (!tratado) return null;
  return (
    <CheckCircle2
      className={cn("text-emerald-600 dark:text-emerald-400 shrink-0", className)}
      style={{ width: size, height: size }}
      aria-label={title}
    />
  );
}

/** Retorna true se o item da agenda unificada estiver marcado como tratado/concluído. */
export function isItemTratado(item: {
  status?: string | null;
  situacao?: string | null;
  origem?: string | null;
}): boolean {
  const s = (item.status ?? "").toLowerCase();
  const situ = (item.situacao ?? "").toLowerCase();
  return (
    s === "concluido" ||
    s === "concluida" ||
    s === "cumprido" ||
    s === "tratado" ||
    situ === "tratado" ||
    situ === "concluido" ||
    situ === "concluida"
  );
}
