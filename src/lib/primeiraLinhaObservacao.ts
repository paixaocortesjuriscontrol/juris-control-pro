export function primeiraLinhaObservacao(valor?: string | null): string {
  if (!valor) return "";
  const primeiraLinha = valor.trim().split(/\r\n?|\n/, 1)[0] ?? "";
  return primeiraLinha.replace(/\s+/g, " ").trim();
}

export interface TrechoObservacao { texto: string; destaque: boolean }

/** Converte tags simples (<destaque>, <b>, <strong>) em trechos destacados; remove as demais tags e entidades básicas. */
export function trechosObservacao(valor?: string | null): TrechoObservacao[] {
  if (!valor) return [];
  const ent = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const out: TrechoObservacao[] = [];
  let destaque = 0;
  for (const parte of valor.split(/(<\/?[a-zA-Z][^>]*>)/)) {
    const tag = /^<(\/?)([a-zA-Z]+)/.exec(parte);
    if (tag) {
      const nome = tag[2].toLowerCase();
      if (["destaque", "b", "strong", "mark"].includes(nome)) destaque = Math.max(0, destaque + (tag[1] ? -1 : 1));
      else if (nome === "br" || nome === "p") out.push({ texto: " ", destaque: false });
      continue;
    }
    const texto = ent(parte).replace(/\s+/g, " ");
    if (texto) out.push({ texto, destaque: destaque > 0 });
  }
  return out;
}

export function textoObservacaoSemTags(valor?: string | null): string {
  return trechosObservacao(valor).map((t) => t.texto).join("").replace(/\s+/g, " ").trim();
}
