import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";

/**
 * Normaliza o texto removendo tags HTML, caracteres especiais, espaços extras
 * e convertendo para minúsculo para facilitar comparação.
 */
const normalizeText = (text: string): string =>
  text
    .replace(/<[^>]*>/g, " ")        // remove tags HTML
    .replace(/[^\w\s]/g, " ")        // remove pontuação
    .replace(/\s+/g, " ")            // colapsa espaços
    .trim()
    .toLowerCase();

/**
 * Extrai a data (YYYY-MM-DD) de uma string ISO ou retorna "null".
 */
const extractDateKey = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "null";
  // Pega apenas YYYY-MM-DD
  return dateStr.slice(0, 10);
};

/**
 * Gera uma chave de deduplicação para uma publicação.
 * Critério: coordenacao_id + processo_numero + data_primaria + head normalizado
 * 
 * IMPORTANTE: A chave INCLUI coordenacao_id, permitindo que a mesma publicação
 * apareça para coordenações diferentes (cada coordenação analisa suas publicações).
 * A deduplicação só remove duplicatas DENTRO da mesma coordenação.
 */
const makeDedupKey = (pub: PublicacaoUnificada): string => {
  // Coordenação é parte fundamental da chave - mesma pub pode aparecer em coordenações diferentes
  const coordenacao = pub.coordenacao_id ?? "sem_coord";
  const processo = (pub.processo_numero ?? "").replace(/\D/g, ""); // só dígitos
  
  // Cascata de datas: publicação > disponibilização > created_at
  let dataPrimaria = extractDateKey(pub.data_publicacao);
  if (dataPrimaria === "null") {
    dataPrimaria = extractDateKey(pub.data_disponibilizacao);
  }
  if (dataPrimaria === "null") {
    dataPrimaria = extractDateKey(pub.created_at);
  }
  
  // 300 chars para maior precisão (alinhado com backend que usa 2000)
  const head = normalizeText(pub.conteudo ?? "").slice(0, 300);

  // Se tiver processo, dedup por coordenação + processo + data + conteúdo
  if (processo) return `${coordenacao}|${processo}|${dataPrimaria}|${head}`;

  // Fallback para publicações sem número de processo
  // Inclui coordenação + monitoramento_id + tipo para evitar colisões
  return `${coordenacao}|${pub.tipo_origem}|${pub.monitoramento_id ?? "sem_mon"}|${dataPrimaria}|${head}`;
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
