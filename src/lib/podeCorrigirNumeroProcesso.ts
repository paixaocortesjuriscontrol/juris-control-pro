const PERMITIDOS = ["admin", "coordenador", "assistente_coordenador", "advogado", "advogado_senior", "advogado_temporario"];

const norm = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "_")
    .replace(/^advogada/, "advogado").replace(/^coordenadora/, "coordenador");

/** Administrador, coordenador, assistente de coordenador e advogado (perfil geral ou cargo na coordenação). */
export function podeCorrigirNumeroProcesso(role: string | null | undefined, cargos: unknown[] = []): boolean {
  return [role, ...cargos.map((c: any) => (typeof c === "string" ? c : c?.cargo))].some((r) => PERMITIDOS.includes(norm(r)));
}

/** Dígito verificador CNJ (módulo 97). */
export function cnjValido(numero: string): boolean {
  const d = numero.replace(/\D/g, "");
  if (d.length !== 20) return false;
  const n = d.slice(0, 7), dv = d.slice(7, 9), resto = d.slice(9);
  const calc = 98 - Number(BigInt(n + resto + "00") % 97n);
  return calc === Number(dv);
}
