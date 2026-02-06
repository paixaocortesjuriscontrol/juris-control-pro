// Utilitários para normalizar/formatar publicações do PJE Comunica no formato “estilo DJEN”
// (Órgão, Data, Tipo, Meio, Partes, Advogados) sem depender do “inteiro teor”.

type TraverseOptions = {
  maxDepth?: number;
  maxValues?: number;
  maxStringLength?: number;
  /** Ignora chaves que costumam conter textos gigantes e redundantes. */
  ignoreKeyRe?: RegExp;
};

function defaultTraverseOptions(): Required<TraverseOptions> {
  return {
    maxDepth: 5,
    maxValues: 250,
    maxStringLength: 500,
    ignoreKeyRe: /^(conteudo|texto|teor|html|body|raw|__raw)$/i,
  };
}

function digitsOnly(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function safeSlice(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n);
}

function collectTextByKey(
  value: any,
  keyRe: RegExp,
  opts?: TraverseOptions
): string {
  const o = { ...defaultTraverseOptions(), ...(opts || {}) };
  const parts: string[] = [];
  const visited = new Set<any>();

  const push = (v: unknown) => {
    if (parts.length >= o.maxValues) return;
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return;
      parts.push(safeSlice(s, o.maxStringLength));
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      parts.push(String(v));
      return;
    }
  };

  const walk = (v: any, depth: number, currentKey?: string) => {
    if (parts.length >= o.maxValues) return;
    if (v === null || v === undefined) return;
    if (depth > o.maxDepth) return;

    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      if (!currentKey || keyRe.test(currentKey)) push(v);
      return;
    }

    if (Array.isArray(v)) {
      for (let i = 0; i < Math.min(v.length, 60); i++) {
        walk(v[i], depth + 1, currentKey);
        if (parts.length >= o.maxValues) return;
      }
      return;
    }

    if (typeof v === 'object') {
      if (visited.has(v)) return;
      visited.add(v);
      for (const [k, vv] of Object.entries(v)) {
        if (o.ignoreKeyRe.test(k)) {
          // ainda assim pode haver nested metadata dentro desses campos, mas é raro e caro;
          // preferimos ignorar para performance.
          continue;
        }
        // Se a chave casar, coletar o valor como texto (e também descer)
        if (keyRe.test(k)) {
          push(vv as any);
        }
        walk(vv, depth + 1, k);
        if (parts.length >= o.maxValues) return;
      }
    }
  };

  walk(value, 0);
  return parts.join('\n');
}

export function collectMetaAdvogadoText(pub: any): string {
  // Coleta apenas campos que tipicamente carregam advogado/OAB/destinatário.
  return collectTextByKey(pub, /(destinat|advog|oab|represent|procurad)/i);
}

function hasDjenLikeHeader(text: string): boolean {
  const t = String(text || '');
  return /\bÓrgão:\s*/i.test(t) && /\bData de disponibiliza/i.test(t);
}

function extractPartesFromConteudo(conteudo: string): string[] {
  const partes: string[] = [];
  const c = String(conteudo || '');

  const req = c.match(/\bRequerente:\s*([^\n\r]{3,200})/i);
  const reqd = c.match(/\bRequerido:\s*([^\n\r]{3,200})/i);
  const aut = c.match(/\bAutor(?:a)?:\s*([^\n\r]{3,200})/i);
  const reu = c.match(/\bRéu(?:\(s\))?:\s*([^\n\r]{3,200})/i);

  const add = (m: RegExpMatchArray | null) => {
    const v = m?.[1]?.trim();
    if (v) partes.push(v);
  };

  add(req);
  add(reqd);
  add(aut);
  add(reu);

  // dedupe simples preservando ordem
  return Array.from(new Set(partes));
}

export function buildDjenLikeConteudo(params: {
  pub: any;
  diaYmd: string;
  monitoramento?: { tipo?: string; termo?: string; oab?: string; uf?: string };
  conteudoOriginal?: string | null;
}): string {
  const { pub, diaYmd, monitoramento, conteudoOriginal } = params;
  const original = String(conteudoOriginal || '').trim();

  // Se já estiver no formato esperado, não mexe.
  if (original && hasDjenLikeHeader(original)) {
    return original;
  }

  const dataDispRaw =
    pub?.dataDisponibilizacao ??
    pub?.data_disponibilizacao ??
    pub?.dataDJe ??
    pub?.data_dje ??
    diaYmd;
  const dataDisp = String(dataDispRaw || diaYmd).slice(0, 10);

  const orgao =
    pub?.nomeOrgao ??
    pub?.nome_orgao ??
    pub?.orgao ??
    pub?.nomeOrgaoJulgador ??
    pub?.nome_orgao_julgador ??
    null;

  const tipo =
    pub?.tipoComunicacao ??
    pub?.tipo_comunicacao ??
    pub?.tipo ??
    null;

  const meio =
    pub?.meio ??
    pub?.meioComunicacao ??
    pub?.meio_comunicacao ??
    pub?.veiculo ??
    null;

  const numeroProcesso =
    pub?.numeroProcesso ??
    pub?.numero_processo ??
    pub?.processo_numero ??
    pub?.processoNumero ??
    pub?.processo ??
    null;

  const headerLines: string[] = [];
  if (orgao) headerLines.push(`Órgão: ${String(orgao).trim()}`);
  if (dataDisp) headerLines.push(`Data de disponibilização: ${dataDisp}`);
  if (tipo) headerLines.push(`Tipo de comunicação: ${String(tipo).trim()}`);
  headerLines.push(`Meio: ${String(meio || 'Diário de Justiça Eletrônico Nacional').trim()}`);
  if (numeroProcesso) headerLines.push(`Processo: ${String(numeroProcesso).trim()}`);

  const sections: string[] = [];

  const partes = extractPartesFromConteudo(original);
  if (partes.length > 0) {
    sections.push(['Parte(s)', ...partes].join('\n'));
  }

  // Se for monitoramento de advogado e o corpo veio “magro”, inserimos ao menos o advogado alvo.
  if (monitoramento?.tipo === 'advogado') {
    const alreadyHasAdvSection = /\bAdvogado\(s\)/i.test(original);
    if (!alreadyHasAdvSection) {
      const nome = String(monitoramento?.termo || '').trim();
      const oabDigits = digitsOnly(monitoramento?.oab);
      const uf = String(monitoramento?.uf || '').trim().toUpperCase();

      // Se não temos nada, tenta puxar algo dos metadados.
      const fallbackMeta = collectMetaAdvogadoText(pub);
      const fallbackNome =
        String(pub?.destinatarioNome || pub?.nomeAdvogado || '').trim() ||
        (fallbackMeta ? fallbackMeta.split(/\n+/)[0]?.trim() : '');

      const displayNome = nome || fallbackNome || 'Advogado';
      const oabLabel = oabDigits
        ? ` - OAB ${uf ? `${uf}-` : ''}${oabDigits}`
        : '';

      sections.push(['Advogado(s)', `${displayNome}${oabLabel}`].join('\n'));
    }
  }

  const blocks = [
    headerLines.filter(Boolean).join('\n'),
    sections.filter(Boolean).join('\n\n'),
    original,
  ].filter((b) => String(b || '').trim().length > 0);

  return blocks.join('\n\n');
}
