// Classificação interna de Turmas e Ministros do TST (Positivo / Negativo / Impedida)
// Usada para preenchimento automático após retorno da Judit e na tela "Classificação TST".

export type ClassificacaoTst = "POSITIVO" | "NEGATIVO" | "IMPEDIDA";

export interface ClassificacaoTurma {
  turma: string;
  classificacao: ClassificacaoTst;
}

export interface ClassificacaoMinistro {
  nome: string;
  cargo?: string;
  classificacao: ClassificacaoTst;
  observacao?: string;
}

export const TURMAS_TST: ClassificacaoTurma[] = [
  { turma: "1ª Turma", classificacao: "POSITIVO" },
  { turma: "2ª Turma", classificacao: "NEGATIVO" },
  { turma: "3ª Turma", classificacao: "NEGATIVO" },
  { turma: "4ª Turma", classificacao: "POSITIVO" },
  { turma: "5ª Turma", classificacao: "POSITIVO" },
  { turma: "6ª Turma", classificacao: "NEGATIVO" },
  { turma: "7ª Turma", classificacao: "NEGATIVO" },
  { turma: "8ª Turma", classificacao: "POSITIVO" },
  { turma: "SBDI-1", classificacao: "NEGATIVO" },
  { turma: "SBDI-2", classificacao: "POSITIVO" },
  { turma: "Pleno", classificacao: "NEGATIVO" },
];

export const MINISTROS_TST: ClassificacaoMinistro[] = [
  { nome: "Luiz Philippe Vieira de Mello Filho", cargo: "Presidente do Tribunal", classificacao: "NEGATIVO" },
  { nome: "Guilherme Augusto Caputo Bastos", cargo: "Vice-Presidente do Tribunal", classificacao: "POSITIVO" },
  { nome: "José Roberto Freire Pimenta", cargo: "Corregedor-Geral da Justiça do Trabalho", classificacao: "NEGATIVO" },
  { nome: "Ives Gandra da Silva Martins Filho", classificacao: "POSITIVO" },
  { nome: "Maria Cristina Irigoyen Peduzzi", classificacao: "IMPEDIDA", observacao: "Impedida nos nossos casos. Se necessário marcar polaridade, considerar POSITIVO." },
  { nome: "Lelio Bentes Corrêa", classificacao: "NEGATIVO" },
  { nome: "Mauricio José Godinho Delgado", classificacao: "NEGATIVO" },
  { nome: "Kátia Magalhães Arruda", classificacao: "NEGATIVO" },
  { nome: "Augusto César Leite de Carvalho", classificacao: "NEGATIVO" },
  { nome: "Delaíde Alves Miranda Arantes", classificacao: "NEGATIVO" },
  { nome: "Hugo Carlos Scheuermann", classificacao: "NEGATIVO" },
  { nome: "Alexandre de Souza Agra Belmonte", classificacao: "POSITIVO" },
  { nome: "Cláudio Mascarenhas Brandão", classificacao: "NEGATIVO" },
  { nome: "Douglas Alencar Rodrigues", classificacao: "POSITIVO" },
  { nome: "Maria Helena Mallmann", classificacao: "NEGATIVO" },
  { nome: "Breno Medeiros", classificacao: "POSITIVO" },
  { nome: "Alexandre Luiz Ramos", classificacao: "POSITIVO" },
  { nome: "Luiz José Dezena da Silva", classificacao: "POSITIVO" },
  { nome: "Evandro Pereira Valadão Lopes", classificacao: "POSITIVO" },
  { nome: "Amaury Rodrigues Pinto Junior", classificacao: "POSITIVO" },
  { nome: "Alberto Bastos Balazeiro", classificacao: "NEGATIVO" },
  { nome: "Morgana de Almeida Richa", classificacao: "POSITIVO" },
  { nome: "Sergio Pinto Martins", classificacao: "POSITIVO" },
  { nome: "Liana Chaib", classificacao: "NEGATIVO" },
  { nome: "Antônio Fabrício de Matos Gonçalves", classificacao: "NEGATIVO" },
  { nome: "José Pedro de Camargo Rodrigues de Souza", cargo: "Desembargador", classificacao: "POSITIVO" },
  { nome: "João Pedro Silvestrin", cargo: "Desembargador", classificacao: "POSITIVO" },
];

function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classificarTurma(turma?: string | null): ClassificacaoTst | null {
  if (!turma) return null;
  const n = normalizar(turma);
  for (const t of TURMAS_TST) {
    const alvo = normalizar(t.turma);
    if (n === alvo || n.includes(alvo) || alvo.includes(n)) {
      return t.classificacao;
    }
  }
  // Heurísticas para SBDI sem hífen
  if (n.includes("sbdi 1") || n.includes("sbdi1") || n.includes("sdi 1") || n.includes("sdi1")) return "NEGATIVO";
  if (n.includes("sbdi 2") || n.includes("sbdi2") || n.includes("sdi 2") || n.includes("sdi2")) return "POSITIVO";
  if (n.includes("pleno") || n.includes("orgao especial")) return "NEGATIVO";
  return null;
}

export function classificarRelator(relator?: string | null): { classificacao: ClassificacaoTst; ministro: ClassificacaoMinistro } | null {
  if (!relator) return null;
  const n = normalizar(relator)
    .replace(/\b(ministro|ministra|min|exmo|exma|sr|sra|desembargador|desembargadora|des)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return null;
  let melhor: { score: number; m: ClassificacaoMinistro } | null = null;
  for (const m of MINISTROS_TST) {
    const alvo = normalizar(m.nome);
    if (n === alvo) return { classificacao: m.classificacao, ministro: m };
    if (n.includes(alvo) || alvo.includes(n)) {
      const score = Math.min(n.length, alvo.length);
      if (!melhor || score > melhor.score) melhor = { score, m };
      continue;
    }
    // Comparação por sobrenome significativo (3+ partes em comum)
    const partesN = new Set(n.split(" ").filter(p => p.length > 2));
    const partesAlvo = alvo.split(" ").filter(p => p.length > 2);
    const intersec = partesAlvo.filter(p => partesN.has(p)).length;
    if (intersec >= 2) {
      const score = intersec * 10;
      if (!melhor || score > melhor.score) melhor = { score, m };
    }
  }
  return melhor ? { classificacao: melhor.m.classificacao, ministro: melhor.m } : null;
}