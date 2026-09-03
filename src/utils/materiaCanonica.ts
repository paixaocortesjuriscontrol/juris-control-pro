/**
 * Grafia canônica das matérias exportadas na Carga Benner.
 *
 * O nome que vai para a planilha deve ser exatamente o cadastrado em
 * `pedidos_por_dossie` para aquele dossiê. Se a matéria não estiver na lista
 * do dossiê, usa a grafia da lista oficial (`materias_pedidos_oficiais`).
 * Se não estiver em nenhuma das duas, mantém o texto do formulário.
 */
import { nomeCanonicoDoDossieSync } from "./pedidosPorDossieCache";
import { nomeOficialCanonicoSync } from "./materiasOficiaisCache";

export function canonicalizarMateria(
  dossie: string | null | undefined,
  materia: string | null | undefined,
): string {
  const atual = String(materia ?? "").trim();
  if (!atual) return atual;
  return nomeCanonicoDoDossieSync(dossie, atual) || nomeOficialCanonicoSync(atual) || atual;
}
