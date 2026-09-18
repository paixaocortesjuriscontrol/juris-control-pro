import { cn } from "@/lib/utils";

export const SIMBOLOS_COBRANCA = ["C", "✅", "📣", "⚠️", "👍", "⏰", "🔴", "B"];

export const SIMBOLO_COBRANCA_PADRAO = "C";

const STORAGE_KEY = "painel-cobranca-simbolo";

export function getSimboloCobrancaPreferido(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || SIMBOLO_COBRANCA_PADRAO;
  } catch {
    return SIMBOLO_COBRANCA_PADRAO;
  }
}

export function setSimboloCobrancaPreferido(simbolo: string) {
  try {
    localStorage.setItem(STORAGE_KEY, simbolo);
  } catch {
    /* ignora */
  }
}

interface CobrancaBadgeProps {
  simbolo?: string | null;
  /** Cobrada hoje (destaque) ou em dia anterior (apagada). */
  hoje?: boolean;
  /** Texto da dica de tela (quem cobrou e quando). */
  title?: string;
  className?: string;
}

/**
 * Bolinha com o símbolo escolhido pelo usuário, sinalizando que o item já foi
 * cobrado. Cheia quando a cobrança é de hoje; apagada quando é mais antiga.
 */
export function CobrancaBadge({ simbolo, hoje = false, title, className }: CobrancaBadgeProps) {
  const texto = (simbolo || SIMBOLO_COBRANCA_PADRAO).slice(0, 2);
  return (
    <span
      title={title || "Já cobrado"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border shrink-0 leading-none",
        "w-3.5 h-3.5 text-[8px] font-bold",
        hoje
          ? "bg-rose-600 border-rose-700 text-white"
          : "bg-transparent border-rose-400/70 text-rose-500/80",
        className,
      )}
    >
      {texto}
    </span>
  );
}
