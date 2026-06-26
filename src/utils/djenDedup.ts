import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";

// Mantido apenas para os fluxos explícitos de exportação "Resumo sem repetição".
// A deduplicação oficial do DJEN abaixo NÃO usa conteúdo, processo, data nem
// destinatário: usa somente coordenacao_id + id_djen.
export const stripDestinatarios = (text: string): string => {
  const re = /(Destinat[aá]rio|Intimad[ao]|Advogad[ao]|Parte|Reclamante|Reclamad[ao]|Autor|R[eé]u|Requerente|Requerid[ao])\s*\(s\)?\s*:/i;
  const idx = text.search(re);
  return idx > 0 ? text.slice(0, idx) : text;
};

/**
 * Gera uma chave de deduplicação para uma publicação.
 * REGRA DJEN: deduplicação visual usa SOMENTE coordenacao_id + id_djen.
 * Publicações com conteúdo/processo/data iguais, mas id_djen diferentes, são
 * comunicações reais distintas e devem aparecer/contar separadamente.
 */
const makeDedupKey = (pub: PublicacaoUnificada): string => {
  const coordenacao = pub.coordenacao_id ?? "sem_coord";
  const idDjen = String(pub.id_djen ?? "").trim();
  if (idDjen) return `${coordenacao}|id_djen|${idDjen}`;

  // Sem id_djen não há base segura para afirmar duplicidade no DJEN/PJE.
  // Mantemos cada linha como registro próprio.
  return `${coordenacao}|sem-id-djen|${pub.id}`;
};

/**
 * Remove duplicatas de publicações DJEN, mantendo a mais completa.
 */
export const dedupePublicacoesDjen = (
  publicacoes: PublicacaoUnificada[]
): PublicacaoUnificada[] => {
  const map = new Map<string, PublicacaoUnificada>();

  for (const pub of publicacoes) {
    const key = makeDedupKey(pub);
    const prev = map.get(key);

    if (!prev) {
      map.set(key, pub);
      continue;
    }

    const prevLen = (prev.conteudo ?? "").length;
    const curLen = (pub.conteudo ?? "").length;

    // Preferir o registro com mais conteúdo; em empate, preferir origem 'processo'
    if (curLen > prevLen) {
      map.set(key, pub);
    } else if (
      curLen === prevLen &&
      prev.tipo_origem === "termo" &&
      pub.tipo_origem === "processo"
    ) {
      map.set(key, pub);
    }
  }

  return Array.from(map.values());
};
