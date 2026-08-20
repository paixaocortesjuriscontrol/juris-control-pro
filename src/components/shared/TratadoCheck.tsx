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
  status_tst?: string | null;
  situacao?: string | null;
  origem?: string | null;
  data_cumprimento?: string | null;
  concluido_em?: string | null;
  tratado_em?: string | null;
  prazo_fatal_conferido?: boolean | null;
}): boolean {
  if (item.prazo_fatal_conferido || item.data_cumprimento || item.concluido_em || item.tratado_em) return true;

  const normalize = (value?: string | null) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const tratados = new Set([
    "concluido",
    "concluida",
    "cumprido",
    "cumprida",
    "tratado",
    "tratada",
    "pago",
    "paga",
    "finalizado",
    "finalizada",
    "conferido",
    "conferida",
  ]);

  return [item.status, item.status_tst, item.situacao].some((value) => tratados.has(normalize(value)));
}

/**
 * Situações que recebem apenas o RISCO no texto (line-through), sem alterar
 * cor, ícone verde ou métricas: PROTOCOLADO e BAIXADO.
 */
export function isItemRiscado(item: Parameters<typeof isItemTratado>[0]): boolean {
  if (isItemTratado(item)) return true;

  const normalize = (value?: string | null) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const riscados = new Set(["protocolado", "protocolada", "baixado", "baixada"]);
  return [item.status, item.status_tst, item.situacao].some((value) => riscados.has(normalize(value)));
}
