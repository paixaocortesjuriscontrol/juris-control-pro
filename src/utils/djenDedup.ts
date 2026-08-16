import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";

// Mantido apenas para os fluxos explícitos de exportação "Resumo sem repetição".
// A deduplicação oficial do DJEN abaixo NÃO usa conteúdo, processo, data nem
// destinatário: usa somente coordenacao_id + id_djen.

// Rótulos que iniciam o bloco final de destinatários. Aceita variações do DJEN
// como "Intimado(s) / Citado(s)" (sem dois-pontos), "Destinatarios", etc.
const DESTINATARIOS_RE = new RegExp(
  String.raw`(?:Destinat[aá]ri[oa]|Intimad[ao]|Citad[ao]|Advogad[ao]|Parte|Reclamante|Reclamad[ao]|Autor|R[eé]u|Requerente|Requerid[ao])` +
    String.raw`(?:\s*\(s\)|s)?` +
    String.raw`(?:\s*\/\s*(?:Citad[ao]|Intimad[ao]|Destinat[aá]ri[oa])(?:\s*\(s\)|s)?)*` +
    String.raw`\s*:?\s*(?:\n|<|$)`,
  "i"
);

export const stripDestinatarios = (text: string): string => {
  if (!text) return "";
  const idx = text.search(DESTINATARIOS_RE);
  return idx > 0 ? text.slice(0, idx) : text;
};

/** Texto do bloco final de destinatários (nomes), quando existir. */
export const extrairDestinatarios = (text: string): string[] => {
  if (!text) return [];
  const idx = text.search(DESTINATARIOS_RE);
  if (idx < 0) return [];
  const bloco = text
    .slice(idx)
    .replace(/<[^>]*>/g, "\n")
    .replace(/&nbsp;/gi, " ");
  return bloco
    .split(/\n|;/)
    .map((l) => l.replace(/^[\s\-•*]+/, "").trim())
    .filter((l) => l.length > 3 && !DESTINATARIOS_RE.test(`${l}\n`))
    .slice(0, 30);
};

const normalizarTeor = (s: string): string =>
  stripDestinatarios(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Ignora a ordem de nomes/advogados: compara o conjunto ordenado de tokens. */
const assinaturaTeor = (norm: string): string => {
  const tokens = norm.split(" ").filter(Boolean);
  return tokens.slice().sort().join(" ");
};

/** Identificador do documento presente no texto (ex.: "INTIMAÇÃO ID 42d3c52"). */
const extrairDocId = (texto: string): string => {
  const m = String(texto || "").match(/\bID\s+([0-9a-z]{5,})\b/i);
  return m ? m[1].toLowerCase() : "";
};

export interface PubSemRepeticao {
  processo_numero?: string | null;
  conteudo?: string | null;
  data_publicacao?: string | null;
}

/**
 * Remove publicações duplicadas para as exportações "sem repetição":
 * mesma comunicação (processo + data + documento + teor), variando apenas o
 * bloco final de intimados/citados ou a ordem dos nomes.
 * Mantém a de maior conteúdo, preservando a ordem original, e agrega os
 * intimados das cópias removidas no registro mantido.
 */
export const dedupPubsSemDestinatarios = <T extends PubSemRepeticao>(pubs: T[]): T[] => {
  const bestIdxByKey = new Map<string, number>();
  const intimadosByKey = new Map<string, Set<string>>();
  const keyByIdx = new Array<string>(pubs.length).fill("");
  const keep = new Array<boolean>(pubs.length).fill(false);

  pubs.forEach((p, i) => {
    const conteudo = String(p.conteudo || "");
    const digits = String(p.processo_numero || "").replace(/\D/g, "");
    if (!digits) {
      keep[i] = true;
      return;
    }
    const norm = normalizarTeor(conteudo);
    const docId = extrairDocId(conteudo);
    const data = String(p.data_publicacao || "").slice(0, 10);
    const key = `${digits}|${data}|${docId}|${assinaturaTeor(norm)}`;
    keyByIdx[i] = key;

    const set = intimadosByKey.get(key) ?? new Set<string>();
    for (const nome of extrairDestinatarios(conteudo)) set.add(nome);
    intimadosByKey.set(key, set);

    const prev = bestIdxByKey.get(key);
    if (prev === undefined) {
      bestIdxByKey.set(key, i);
    } else if (conteudo.length > (pubs[prev].conteudo || "").length) {
      bestIdxByKey.set(key, i);
    }
  });

  bestIdxByKey.forEach((i) => {
    keep[i] = true;
  });

  return pubs
    .map((p, i) => {
      if (!keep[i]) return null;
      const key = keyByIdx[i];
      if (!key) return p;
      const todos = Array.from(intimadosByKey.get(key) ?? []);
      const atuais = new Set(extrairDestinatarios(String(p.conteudo || "")));
      const extras = todos.filter((n) => !atuais.has(n));
      if (extras.length === 0) return p;
      return {
        ...p,
        conteudo: `${String(p.conteudo || "")}\n${extras.map((n) => `- ${n}`).join("\n")}`,
      } as T;
    })
    .filter((p): p is T => p !== null);
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

  // Pautas DEJT/PDF não têm id_djen. Para elas, o banco já calcula uma chave
  // estável por coordenação + processo + data de referência. Sem isso, duas
  // execuções da mesma pauta aparecem como linhas diferentes porque o fallback
  // antigo usava o id UUID do registro.
  const dedupKey = String(pub.dedup_key ?? "").trim();
  if (dedupKey) return `${coordenacao}|dedup_key|${dedupKey}`;

  const dedupConteudoKey = String(pub.dedup_conteudo_key ?? "").trim();
  if (dedupConteudoKey) return `${coordenacao}|dedup_conteudo_key|${dedupConteudoKey}`;

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
