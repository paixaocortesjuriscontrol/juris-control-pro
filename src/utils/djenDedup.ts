import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";

/**
 * Normaliza o texto removendo tags HTML, caracteres especiais, espaços extras
 * e convertendo para minúsculo para facilitar comparação.
 */
/**
 * Remove a seção "Destinatário(s):" e tudo após ela.
 * A API do PJE Comunica retorna uma comunicação separada por destinatário,
 * gerando conteúdos quase idênticos que diferem apenas no nome do destinatário.
 * Sem essa remoção, a dedup falha e o mesmo processo aparece N vezes.
 */
const stripDestinatarios = (text: string): string => {
  const idx = text.search(/Destinat[aá]rio\(s\)\s*:/i);
  return idx > 0 ? text.slice(0, idx) : text;
};

const normalizeText = (text: string): string =>
  stripDestinatarios(text)
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
  
  // Cascata de datas: disponibilização > publicação > created_at
  // Prioriza data_disponibilizacao para alinhar com backend e tratar
  // republicações como registros distintos
  let dataPrimaria = extractDateKey(pub.data_disponibilizacao);
  if (dataPrimaria === "null") {
    dataPrimaria = extractDateKey(pub.data_publicacao);
  }
  if (dataPrimaria === "null") {
    dataPrimaria = extractDateKey(pub.created_at);
  }
  
  // 300 chars para maior precisão (alinhado com backend)
  const head = normalizeText(pub.conteudo ?? "").slice(0, 300);

  // CHAVE UNIFICADA: coordenação + processo_digits + data + conteúdo
  // NÃO usa monitoramento_id — isso garante que publicações idênticas vindas de
  // múltiplos monitoramentos (termos duplicados) sejam corretamente deduplicadas.
  // Exemplo: 14 monitoramentos "OSMAR MENDES PAIXAO" retornando o mesmo conteúdo
  // agora contam como 1, não 14.
  return `${coordenacao}|${processo}|${dataPrimaria}|${head}`;
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
