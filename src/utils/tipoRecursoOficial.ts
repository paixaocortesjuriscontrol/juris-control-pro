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
const CAMPOS_RECURSO: { key: string; label: string }[] = [
  { key: "tipo_recurso_reclamante", label: "Recurso do Reclamante" },
  { key: "tipo_recurso_banco", label: "Recurso do Banco" },
  { key: "tipo_recurso_terceiro", label: "Recurso de Terceiro" },
];

/**
 * Valores gravados nos campos de recurso que não constam na lista de seleção
 * oficial (ex.: classes inventadas por preenchimento automático da Judit,
 * como "AÇÃO TRABALHISTA - RITO ORDINÁRIO").
 */
export function getRecursosForaDaLista(d: any): { campo: string; valor: string }[] {
  const out: { campo: string; valor: string }[] = [];
  for (const { key, label } of CAMPOS_RECURSO) {
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
