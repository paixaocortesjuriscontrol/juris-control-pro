/**
 * Pré-indexação determinística de publicações DJEN/DJET para envio à IA.
 *
 * Converte HTML/texto bruto em Markdown estruturado preservando quebras de
 * linha e parágrafos, e segmenta pautas de julgamento por processo. O objetivo
 * é evitar que a IA receba um "muro de texto" colapsado por `\s+`, o que
 * causava resumos truncados (especialmente em pautas TST).
 *
 * Mesmo código replicado em `supabase/functions/resumir-publicacoes/markdown.ts`
 * (Deno) — manter os dois lados em sincronia.
 */

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&ordm;": "º",
  "&ordf;": "ª",
};

function decodeEntidades(s: string): string {
  let out = s;
  for (const [k, v] of Object.entries(ENTIDADES)) {
    out = out.split(k).join(v);
  }
  // Numéricas &#NNN; e &#xHH;
  out = out.replace(/&#(\d+);/g, (_m, d) => {
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? String.fromCharCode(n) : _m;
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => {
    const n = parseInt(h, 16);
    return Number.isFinite(n) ? String.fromCharCode(n) : _m;
  });
  return out;
}

/**
 * Converte HTML/texto bruto em Markdown legível pela IA.
 * Preserva quebras de linha (não colapsa `\n`), emite negrito/itálico/listas
 * para tags comuns e remove tags restantes.
 */
export function htmlParaMarkdown(textoBruto: string | null | undefined): string {
  if (!textoBruto) return "";
  let s = String(textoBruto);

  // Normaliza CRLF
  s = s.replace(/\r\n?/g, "\n");

  // Quebras de linha estruturais
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n");
  s = s.replace(/<(p|div|li|tr|h[1-6])(\s[^>]*)?>/gi, "\n");

  // Listas
  s = s.replace(/<\/(ul|ol)>/gi, "\n");
  s = s.replace(/<(ul|ol)(\s[^>]*)?>/gi, "\n");
  // li abre com "- " (já quebramos linha acima)
  s = s.replace(/(?<=\n)\s*(?=\S)/g, (m) => m); // no-op visual; mantém indent

  // Negrito / itálico
  s = s.replace(/<\/(strong|b)>/gi, "**");
  s = s.replace(/<(strong|b)(\s[^>]*)?>/gi, "**");
  s = s.replace(/<\/(em|i)>/gi, "*");
  s = s.replace(/<(em|i)(\s[^>]*)?>/gi, "*");

  // Remove demais tags
  s = s.replace(/<[^>]+>/g, "");

  // Decodifica entidades
  s = decodeEntidades(s);

  // Normalização de espaços PRESERVANDO \n
  s = s
    .split("\n")
    .map((linha) => linha.replace(/[ \t\u00A0]+/g, " ").trim())
    .join("\n");

  // Remove quebras múltiplas (no máx. 2 \n consecutivos)
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\b\d{20}\b/;
const PROC_HEADER_RE = /^(?:Processo\s+N[ºo°]|AIRR-|RR-|AgInt-|ED-|RRAg-|AIRRAg-|Ag-|RO-|ROT-|ROAg-|AP-)/i;

export function isPautaDeJulgamentoMd(md: string): boolean {
  if (!md) return false;
  return /Pauta\s+de\s+Julgamento/i.test(md) ||
    /Aditamento\s+[àa]\s+Pauta/i.test(md) ||
    /Sess[aã]o\s+(Ordin[áa]ria|Extraordin[áa]ria|Virtual|Presencial)/i.test(md);
}

export interface BlocoPauta {
  titulo: string;
  conteudoMd: string;
}

/**
 * Segmenta uma pauta em blocos por processo. Cada bloco contém o cabeçalho
 * do processo (linha "Processo Nº ..." ou similar) e seu conteúdo até o
 * próximo cabeçalho.
 *
 * Quando não há segmentação clara, devolve um único bloco com o documento todo.
 */
export function segmentarPauta(md: string): BlocoPauta[] {
  if (!md) return [];
  const linhas = md.split("\n");
  const indices: number[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (PROC_HEADER_RE.test(l) || (CNJ_RE.test(l) && l.length < 80)) {
      indices.push(i);
    }
  }
  if (indices.length === 0) {
    return [{ titulo: "Documento", conteudoMd: md }];
  }

  const blocos: BlocoPauta[] = [];
  // Cabeçalho geral (antes do primeiro processo) vira o "preâmbulo" do primeiro bloco
  const preambulo = linhas.slice(0, indices[0]).join("\n").trim();
  for (let k = 0; k < indices.length; k++) {
    const ini = indices[k];
    const fim = k + 1 < indices.length ? indices[k + 1] : linhas.length;
    const slice = linhas.slice(ini, fim).join("\n").trim();
    const titulo = linhas[ini].trim().slice(0, 120);
    const conteudoMd = k === 0 && preambulo
      ? `${preambulo}\n\n${slice}`
      : slice;
    blocos.push({ titulo, conteudoMd });
  }
  return blocos;
}

/**
 * Para casos em que se conhece o processo de interesse, devolve apenas o
 * bloco correspondente (Markdown). Quando o processo não é encontrado,
 * devolve o Markdown completo.
 */
export function selecionarBlocoPorProcesso(md: string, processo?: string | null): string {
  const digits = String(processo || "").replace(/\D/g, "");
  if (!digits || digits.length < 15) return md;
  const blocos = segmentarPauta(md);
  if (blocos.length <= 1) return md;
  const alvo = blocos.find(b => b.conteudoMd.replace(/\D/g, "").includes(digits));
  return alvo ? alvo.conteudoMd : md;
}

/**
 * Pipeline completo: HTML → Markdown e, se for pauta com processo conhecido,
 * recorta apenas o bloco do processo.
 */
export function prepararConteudoParaIA(
  conteudoBruto: string | null | undefined,
  processo?: string | null
): { conteudoMd: string; ehPauta: boolean; totalBlocos: number; recortado: boolean } {
  const md = htmlParaMarkdown(conteudoBruto);
  const ehPauta = isPautaDeJulgamentoMd(md);
  if (!ehPauta) {
    return { conteudoMd: md, ehPauta: false, totalBlocos: 1, recortado: false };
  }
  const blocos = segmentarPauta(md);
  const digits = String(processo || "").replace(/\D/g, "");
  if (digits.length >= 15 && blocos.length > 1) {
    const alvo = blocos.find(b => b.conteudoMd.replace(/\D/g, "").includes(digits));
    if (alvo) {
      return { conteudoMd: alvo.conteudoMd, ehPauta: true, totalBlocos: blocos.length, recortado: true };
    }
  }
  return { conteudoMd: md, ehPauta: true, totalBlocos: blocos.length, recortado: false };
}