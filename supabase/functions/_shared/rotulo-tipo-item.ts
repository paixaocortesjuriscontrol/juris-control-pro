export function rotuloTipo(t: { tipo_registro?: string | null; tipo_tarefa?: string | null }) {
  if (String(t?.tipo_tarefa ?? "").toUpperCase() === "ATA") return { nome: "Ata", novo: "Nova Ata", atribuido: "Atribuída" };
  if (String(t?.tipo_registro ?? "").toLowerCase() === "prazo") return { nome: "Prazo", novo: "Novo Prazo", atribuido: "Atribuído" };
  return { nome: "Tarefa", novo: "Nova Tarefa", atribuido: "Atribuída" };
}
