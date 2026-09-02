import { OPCOES_RECURSO_NORM, ALTERACOES_LEGADAS, SIGLAS_RECURSO } from "@/lib/juditDistribuicaoTst";
import { splitRecursoValues } from "@/utils/recorrenteFromRecursos";

/** Prefixo fixo do motivo de rejeição (usado para agrupar/contar na tela). */
export const MOTIVO_RECURSO_FORA_LISTA = "Tipo de recurso fora da lista oficial";

function norm(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const OFICIAIS = new Set(OPCOES_RECURSO_NORM.map(norm));

export function isTipoRecursoOficial(valor: unknown): boolean {
  const n = norm(valor);
  if (!n) return true;
  if (OFICIAIS.has(n)) return true;
  // Valores legados com equivalência oficial conhecida (planilha "alterações")
  // e siglas de recurso são convertidos na geração, logo não rejeitam a linha.
  if (ALTERACOES_LEGADAS[n]) return true;
  if (SIGLAS_RECURSO[n.replace(/[^a-z]/g, "")]) return true;
  return false;
}

// Apenas os campos editáveis no formulário (por parte). O campo legado
// `tipo_recurso` não é exibido nem exportado, então não gera pendência.
const CAMPOS_RECURSO: { key: string; label: string; parte: "reclamante" | "banco" | "terceiro" }[] = [
  { key: "tipo_recurso_reclamante", label: "Recurso do Reclamante", parte: "reclamante" },
  { key: "tipo_recurso_banco", label: "Recurso do Banco", parte: "banco" },
  { key: "tipo_recurso_terceiro", label: "Recurso de Terceiro", parte: "terceiro" },
];

/**
 * Partes que a advogada marcou em "Parte Recorrente". Somente os quadros
 * dessas partes são validados/exportados — um valor legado gravado no quadro
 * de uma parte que NÃO é recorrente é ignorado (mesma regra da geração da
 * Carga Benner). Quando "Parte Recorrente" está vazio/ilegível, validamos
 * todos os quadros (não há como saber a parte).
 */
function partesRecorrentesDe(d: any): Set<"reclamante" | "banco" | "terceiro"> | null {
  const s = norm(d?.parte_recorrente);
  if (!s || /^[-–—\s.]+$/.test(s)) return null;
  if (/ativo\s*:|passivo\s*:/.test(s) || s.length > 60) return null;
  const set = new Set<"reclamante" | "banco" | "terceiro">();
  const ambos = /\bambos\b/.test(s);
  if (ambos || /\breclamante\b/.test(s)) set.add("reclamante");
  if (ambos || /reclamad[ao]?\b/.test(s) || /\bbanco\b/.test(s)) set.add("banco");
  if (/\bterceiros?\b/.test(s)) set.add("terceiro");
  return set.size > 0 ? set : null;
}

/**
 * Valores gravados nos campos de recurso que não constam na lista de seleção
 * oficial (ex.: classes inventadas por preenchimento automático da Judit,
 * como "AÇÃO TRABALHISTA - RITO ORDINÁRIO").
 */
export function getRecursosForaDaLista(d: any): { campo: string; valor: string }[] {
  const out: { campo: string; valor: string }[] = [];
  const partes = partesRecorrentesDe(d);
  for (const { key, label, parte } of CAMPOS_RECURSO) {
    if (partes && !partes.has(parte)) continue;
    for (const valor of splitRecursoValues(d?.[key])) {
      if (/^[-–—_\s]+$/.test(valor)) continue;
      if (!isTipoRecursoOficial(valor)) out.push({ campo: label, valor });
    }
  }
  return out;
}


/** Motivo de rejeição pronto (ou null quando todos os valores são válidos). */
export function getMotivoRecursoForaLista(d: any): string | null {
  const invalidos = getRecursosForaDaLista(d);
  if (invalidos.length === 0) return null;
  const amostra = invalidos.slice(0, 3).map((i) => `${i.campo}: "${i.valor}"`).join("; ");
  const resto = invalidos.length > 3 ? ` (+${invalidos.length - 3})` : "";
  return `${MOTIVO_RECURSO_FORA_LISTA} — ${amostra}${resto}`;
}
