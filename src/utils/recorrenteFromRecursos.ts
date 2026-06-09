export function splitRecursoValues(value: unknown): string[] {
  return String(value ?? "")
    .split(/\s*[+,;]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function deriveRecorrenteFromRecursos(
  tipoRecursoReclamante: unknown,
  tipoRecursoBanco: unknown
): string {
  const temReclamante = splitRecursoValues(tipoRecursoReclamante).length > 0;
  const temBanco = splitRecursoValues(tipoRecursoBanco).length > 0;

  if (temReclamante && temBanco) return "Reclamante e Reclamada";
  if (temReclamante) return "Reclamante";
  if (temBanco) return "Reclamada";
  return "";
}