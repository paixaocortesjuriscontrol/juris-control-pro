import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function formatBRL(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte string (formatada ou "1234.56") em número (ou "") */
export function parseBRL(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  // Se já é número puro tipo "1234.56"
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toFixed(2);
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string | number | null | undefined;
  onChange: (numericString: string) => void;
}

/**
 * Input de moeda BRL com máscara "1.234.567,89".
 * value: aceita número, string numérica ("1234.56") ou vazio.
 * onChange: retorna string numérica com ponto decimal (ex: "1234.56") ou "".
 */
export const CurrencyInputBRL = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, ...rest }, ref) => {
    const display = (() => {
      if (value === null || value === undefined || value === "") return "";
      const s = String(value);
      // Se veio numérico "1234.56", converte para digits (centavos)
      if (/^-?\d+(\.\d+)?$/.test(s)) {
        const n = Math.round(Number(s) * 100);
        return formatBRL(String(n));
      }
      return formatBRL(s);
    })();

    return (
      <Input
        {...rest}
        ref={ref}
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (!digits) return onChange("");
          onChange((Number(digits) / 100).toFixed(2));
        }}
        className={cn(className)}
      />
    );
  }
);
CurrencyInputBRL.displayName = "CurrencyInputBRL";