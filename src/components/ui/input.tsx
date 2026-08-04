import * as React from "react";

import { cn } from "@/lib/utils";

/** Faixa válida para campos de data em todo o sistema. */
/**
 * Converte um texto colado em `yyyy-MM-dd` (valor aceito por input[type=date]).
 * Aceita dd/MM/yyyy, dd-MM-yyyy, ddMMyyyy, yyyy-MM-dd e yyyy/MM/dd.
 */
function parseDataColada(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3].padStart(4, "0");
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  }
  return null;
}

/** Converte texto colado em `HH:mm` para input[type=time]. */
function parseHoraColada(texto: string): string | null {
  const t = texto.trim();
  const m = t.match(/^(\d{1,2})[:h.]?(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Define o valor do input disparando os eventos que o React/react-hook-form escutam. */
function setValorNativo(el: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onPaste, onCopy, onChange, onBlur, min, max, ...props }, ref) => {
    // Não aplicamos min/max nativo em datas: o navegador interfere na digitação
    // do ano (auto-corrige/embaralha). A faixa é validada apenas no blur.
    const ehData = type === "date" || type === "datetime-local";

    // Enquanto o usuário digita (ex.: 01/01/2000 → anos parciais "0002"),
    // não bloqueamos o valor: a validação da faixa acontece no blur.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e);
    };

    // Campos de data/hora nativos não aceitam colar nem copiar texto.
    // Habilitamos ambos, convertendo formatos comuns (dd/mm/aaaa, ddmmaaaa etc).
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      onPaste?.(e);
      if (e.defaultPrevented) return;
      if (type !== "date" && type !== "time" && type !== "datetime-local") return;
      const texto = e.clipboardData.getData("text");
      if (!texto) return;
      let valor: string | null = null;
      if (type === "date") valor = parseDataColada(texto);
      else if (type === "time") valor = parseHoraColada(texto);
      else {
        const data = parseDataColada(texto);
        const hora = parseHoraColada(texto.replace(/^\S+\s*/, "")) || "00:00";
        valor = data ? `${data}T${hora}` : null;
      }
      if (!valor) return;
      e.preventDefault();
      setValorNativo(e.currentTarget, valor);
    };

    const handleCopy = (e: React.ClipboardEvent<HTMLInputElement>) => {
      onCopy?.(e);
      if (e.defaultPrevented) return;
      if (type !== "date" && type !== "time" && type !== "datetime-local") return;
      const valor = e.currentTarget.value;
      if (!valor) return;
      let texto = valor;
      if (type === "date") {
        const [a, m, d] = valor.split("-");
        if (a && m && d) texto = `${d}/${m}/${a}`;
      }
      e.preventDefault();
      e.clipboardData.setData("text/plain", texto);
    };

    return (
      <input
        type={type}
        min={min}
        max={max}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onCopy={handleCopy}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
