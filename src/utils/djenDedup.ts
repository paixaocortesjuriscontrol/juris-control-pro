import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";

const normalizeText = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const makeDedupKey = (pub: PublicacaoUnificada) => {
  const processo = pub.processo_numero ?? "";
  const data = pub.data_publicacao ?? "";
  const head = normalizeText(pub.conteudo ?? "").slice(0, 220);

  // Se tiver processo, dedup independente da origem (termo/processo)
  if (processo) return `${processo}|${data}|${head}`;

  // Fallback para publicações sem número de processo
  return `${pub.tipo_origem}|${pub.monitoramento_id ?? ""}|${data}|${head}`;
};

export const dedupePublicacoesDjen = (publicacoes: PublicacaoUnificada[]) => {
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
    } else if (curLen === prevLen && prev.tipo_origem === "termo" && pub.tipo_origem === "processo") {
      map.set(key, pub);
    }
  }

  return Array.from(map.values());
};
