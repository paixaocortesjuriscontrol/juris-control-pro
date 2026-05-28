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
export const stripDestinatarios = (text: string): string => {
  // Corta no primeiro rótulo de "lista de pessoas" que costuma variar
  // entre publicações idênticas (Destinatário/Intimado/Advogado/Parte/
  // Reclamante/Reclamado/Autor/Réu/Requerente/Requerido).
  const re = /(Destinat[aá]rio|Intimad[ao]|Advogad[ao]|Parte|Reclamante|Reclamad[ao]|Autor|R[eé]u|Requerente|Requerid[ao])\s*\(s\)?\s*:/i;
  const idx = text.search(re);
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
 * Fontes que NÃO são da DJEN Paralela e podem inserir publicações sem `id_djen`.
 * Para essas continuamos aplicando o fallback de dedup por
 * processo + data + conteúdo. Para qualquer outra fonte (Paralela, que sempre
 * popula `id_djen`), uma publicação sem `id_djen` é tratada como registro único
 * em vez de ser colapsada com outras de conteúdo similar.
 */
const FONTES_COM_FALLBACK = new Set([
  "kurier",
  "dejt-pdf",
  // Scrapers DJE estaduais (gravam sigla do tribunal e nunca id_djen):
  "tjba", "tjmg", "tjrj", "tjsp", "tjsc", "tjpe", "tjpb", "tjes",
  "tjgo", "tjdft", "tjal", "tjse", "tjrn", "tjpr", "tjrs", "tjma",
  "tjam", "tjpi",
  "trt1", "trt2", "trt3", "trt4", "trt5", "trt6", "trt7", "trt8",
  "trt9", "trt10", "trt11", "trt12", "trt13", "trt14", "trt15",
  "trt16", "trt17", "trt18", "trt19", "trt20", "trt21", "trt22",
  "trt23", "trt24",
]);

const isFonteComFallback = (fonte: string | null | undefined): boolean => {
  const f = String(fonte ?? "").trim().toLowerCase();
  return f.length > 0 && FONTES_COM_FALLBACK.has(f);
};

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

  // REGRA PRINCIPAL: quando o DJEN/PJE Comunica fornece o identificador oficial
  // da comunicação, ele é a fonte da verdade. Duas comunicações diferentes do
  // mesmo processo/data podem ter cabeçalho e conteúdo quase idênticos, mas
  // id_djen distintos — nunca podem ser colapsadas pela deduplicação visual.
  const idDjen = String(pub.id_djen ?? "").trim();
  if (idDjen) return `${coordenacao}|id_djen|${idDjen}`;

  // DJEN Termos Paralela SEMPRE popula `id_djen`. Se chegou aqui sem id_djen e
  // a fonte não é uma das engines legadas (kurier, dejt-pdf, scrapers DJE),
  // tratamos como Paralela e damos chave única para nunca colapsar com outra
  // publicação por similaridade de conteúdo.
  if (!isFonteComFallback(pub.fonte)) {
    return `${coordenacao}|paralela-no-id|${pub.id}`;
  }

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
  
  // Usa o conteúdo inteiro normalizado como parte da chave.
  // Os primeiros chars das publicações DJEN são quase sempre idênticos
  // (cabeçalho: Órgão, Data, Partes, Advogados), então um head curto
  // colapsava atos diferentes do mesmo processo/data (ex.: ATO ORDINATÓRIO
  // e DESPACHO retornados no mesmo dia para o mesmo processo).
  const head = normalizeText(pub.conteudo ?? "");

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
