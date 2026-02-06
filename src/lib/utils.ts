import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitiza nomes para usar em chaves do Supabase Storage (evita erro "InvalidKey").
 * Mantém apenas [a-zA-Z0-9._-], remove acentos e substitui outros caracteres por "_".
 */
export function sanitizeFileName(original: string) {
  const lastDot = original.lastIndexOf(".");
  const base = lastDot > 0 ? original.slice(0, lastDot) : original;
  const ext = lastDot > 0 ? original.slice(lastDot + 1) : "";

  const sanitize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

  const safeBase = sanitize(base) || "arquivo";
  const safeExt = sanitize(ext);

  const result = safeExt ? `${safeBase}.${safeExt}` : safeBase;
  // Evita nomes gigantes (limite prático para key + path)
  return result.length > 160 ? result.slice(0, 160) : result;
}

/**
 * Formata número de processo judicial no padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
 * Ex: "0737746-12.2025.8.07.0001"
 */
export function formatProcessoNumero(numero: string | null | undefined): string {
  if (!numero) return "-";
  
  // Remove tudo que não é dígito
  const digits = numero.replace(/\D/g, "");
  
  // Se já tem formatação ou não tem 20 dígitos, retorna como está
  if (digits.length !== 20) return numero;
  
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

