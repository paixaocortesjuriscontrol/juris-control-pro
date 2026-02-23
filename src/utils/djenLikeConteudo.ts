// Utilitários para normalizar/formatar publicações do PJE Comunica no formato "estilo DJEN"
// (Órgão, Data, Tipo, Meio, Partes, Advogados) sem depender do "inteiro teor".

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

/**
 * Extrai DESTINATÁRIOS (partes notificadas) dos metadados estruturados da API PJE Comunica.
 * No portal DJEN, estes aparecem como "Destinatário(a)" no lado esquerdo.
 * NÃO são advogados — são as partes do processo que recebem a comunicação.
 */
export function extractDestinatariosFromMeta(pub: any): string[] {
  const nomes: string[] = [];
  const seen = new Set<string>();

  const add = (nome: string) => {
    const nomeTrim = (nome || '').trim();
    if (!nomeTrim || nomeTrim.length < 3) return;
    const key = nomeTrim.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    nomes.push(nomeTrim);
  };

  // Formato 1: pub.destinatarios[] (mais comum no PJE Comunica)
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) {
      const nome = d?.nome || d?.nomeDestinatario || d?.destinatarioNome || '';
      if (nome) add(nome);
    }
  }

  // Formato 2: campos simples
  if (pub?.destinatarioNome) add(pub.destinatarioNome);
  if (pub?.nomeDestinatario) add(pub.nomeDestinatario);

  // Formato 3: polos (partes do processo)
  if (pub?.poloAtivo && typeof pub.poloAtivo === 'string' && pub.poloAtivo.length < 150) add(pub.poloAtivo);
  if (pub?.poloPassivo && typeof pub.poloPassivo === 'string' && pub.poloPassivo.length < 150) add(pub.poloPassivo);

  return nomes;
}

/**
 * Extrai ADVOGADOS REAIS dos metadados estruturados da API PJE Comunica.
 * Busca em TODOS os locais possíveis da API:
 * 1. pub.destinatarios[].advogados[] (advogados nested dentro de cada destinatário)
 * 2. pub.advogados[] (campo raiz)
 * 3. pub.representantes[] (campo raiz)
 * 4. pub.procuradores[] (campo raiz)
 * 
 * Retorna strings no formato "NOME - OAB UF-NUMERO" quando possível,
 * ou apenas o nome quando não há dados de OAB.
 */
export function extractAdvogadosFromApiMeta(pub: any): string[] {
  const advogados: string[] = [];
  const seen = new Set<string>();

  const addAdvogado = (nome: string, oab?: string, uf?: string) => {
    const nomeTrim = (nome || '').trim();
    if (!nomeTrim || nomeTrim.length < 3) return;
    
    // Ignorar nomes que parecem empresas/partes (não advogados)
    if (/\b(BANCO|S\.A\.|S\/A|LTDA|EIRELI|SINDICATO|MUNICIPIO|ESTADO|UNIÃO|INSTITUTO|FUNDAÇÃO)\b/i.test(nomeTrim)) return;
    
    const oabNum = (oab || '').replace(/\D/g, '');
    const ufClean = (uf || '').toUpperCase().trim();
    
    let entry: string;
    let key: string;
    
    if (oabNum && ufClean) {
      entry = `${nomeTrim} - OAB ${ufClean}-${oabNum}`;
      key = `${oabNum}-${ufClean}`;
    } else if (oabNum) {
      entry = `${nomeTrim} - OAB ${oabNum}`;
      key = oabNum;
    } else {
      entry = nomeTrim;
      key = nomeTrim.toLowerCase();
    }
    
    if (seen.has(key)) return;
    seen.add(key);
    advogados.push(entry);
  };

  const processAdvogadoItem = (item: any) => {
    if (!item) return;
    if (typeof item === 'string') {
      addAdvogado(item);
      return;
    }
    const nome = item.nome || item.nomeAdvogado || item.nomeRepresentante || item.nomeProcurador || '';
    const oab = item.numeroOab || item.oab || item.numero_oab || item.inscricaoOab || '';
    const uf = item.ufOab || item.uf || item.uf_oab || item.siglaUf || '';
    if (nome) addAdvogado(nome, String(oab), String(uf));
  };

  // 1. Advogados NESTED dentro de cada destinatário
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) {
      // d.advogados[]
      if (Array.isArray(d?.advogados)) {
        for (const adv of d.advogados) processAdvogadoItem(adv);
      }
      // d.representantes[]
      if (Array.isArray(d?.representantes)) {
        for (const rep of d.representantes) processAdvogadoItem(rep);
      }
      // d.procuradores[]
      if (Array.isArray(d?.procuradores)) {
        for (const proc of d.procuradores) processAdvogadoItem(proc);
      }
      // d.nomeAdvogado (campo simples no destinatário)
      if (d?.nomeAdvogado && typeof d.nomeAdvogado === 'string') {
        addAdvogado(d.nomeAdvogado, d.numeroOab || '', d.ufOab || '');
      }
    }
  }

  // 2. pub.destinatarioadvogados[] (campo estruturado da API com advogado nested)
  if (Array.isArray(pub?.destinatarioadvogados)) {
    for (const da of pub.destinatarioadvogados) {
      const adv = da?.advogado || da;
      if (adv) {
        const nome = adv.nome || adv.nomeAdvogado || '';
        const oab = adv.numero_oab || adv.numeroOab || adv.oab || '';
        const uf = adv.uf_oab || adv.ufOab || adv.uf || '';
        if (nome) addAdvogado(nome, String(oab), String(uf));
      }
    }
  }

  // 3. pub.advogados[] (campo raiz)
  if (Array.isArray(pub?.advogados)) {
    for (const adv of pub.advogados) processAdvogadoItem(adv);
  }

  // 4. pub.representantes[] (campo raiz)
  if (Array.isArray(pub?.representantes)) {
    for (const rep of pub.representantes) processAdvogadoItem(rep);
  }

  // 5. pub.procuradores[] (campo raiz)
  if (Array.isArray(pub?.procuradores)) {
    for (const proc of pub.procuradores) processAdvogadoItem(proc);
  }

  return advogados;
}

/**
 * @deprecated Use extractDestinatariosFromMeta instead. 
 * Mantido para compatibilidade - agora retorna destinatários (partes), não advogados.
 */
export function extractAdvogadosFromMeta(pub: any): string[] {
  return extractDestinatariosFromMeta(pub);
}

/**
 * Verifica se um ADVOGADO (por OAB e/ou nome) está presente nos metadados
 * estruturados da API (`destinatarioadvogados`, `advogados`, etc.).
 * 
 * Retorna true se encontrar o advogado nos metadados, independentemente
 * de ele aparecer ou não no corpo do texto da publicação.
 */
export function advogadoPresenteNosMetadados(
  pub: any,
  oab?: string,
  nomeAdvogado?: string
): boolean {
  const oabDigits = (oab || '').replace(/\D/g, '').trim();
  const nomeNorm = (nomeAdvogado || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (!oabDigits && !nomeNorm) return false;

  const checkAdvogado = (item: any): boolean => {
    if (!item) return false;
    const adv = item?.advogado || item;
    const advOab = String(adv?.numero_oab || adv?.numeroOab || adv?.oab || '').replace(/\D/g, '');
    const advNome = String(adv?.nome || adv?.nomeAdvogado || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

    if (oabDigits && advOab === oabDigits) return true;
    if (nomeNorm && advNome && advNome.includes(nomeNorm)) return true;
    return false;
  };

  // 1. pub.destinatarioadvogados[]
  if (Array.isArray(pub?.destinatarioadvogados)) {
    for (const da of pub.destinatarioadvogados) {
      if (checkAdvogado(da)) return true;
    }
  }

  // 2. pub.advogados[]
  if (Array.isArray(pub?.advogados)) {
    for (const a of pub.advogados) {
      if (checkAdvogado(a)) return true;
    }
  }

  // 3. nested em destinatarios[].advogados[]
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) {
      if (Array.isArray(d?.advogados)) {
        for (const a of d.advogados) {
          if (checkAdvogado(a)) return true;
        }
      }
      if (Array.isArray(d?.representantes)) {
        for (const r of d.representantes) {
          if (checkAdvogado(r)) return true;
        }
      }
    }
  }

  // 4. pub.representantes[] / pub.procuradores[]
  for (const field of ['representantes', 'procuradores'] as const) {
    if (Array.isArray(pub?.[field])) {
      for (const item of pub[field]) {
        if (checkAdvogado(item)) return true;
      }
    }
  }

  return false;
}

/**
 * Verifica se uma PARTE (polo ativo/passivo) está presente nos metadados
 * estruturados da API (`destinatarios[]`, `poloAtivo`, `poloPassivo`).
 * 
 * Retorna true se o nome da parte for encontrado nos metadados.
 */
export function partePresenteNosMetadados(
  pub: any,
  nomeParte: string
): boolean {
  const parteNorm = (nomeParte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();

  if (!parteNorm) return false;

  const checkNome = (nome: string): boolean => {
    const nomeNorm = (nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim();
    return !!nomeNorm && nomeNorm.includes(parteNorm);
  };

  // 1. pub.destinatarios[].nome
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) {
      const nome = d?.nome || d?.nomeDestinatario || '';
      if (nome && checkNome(nome)) return true;
    }
  }

  // 2. campos simples
  if (pub?.poloAtivo && checkNome(pub.poloAtivo)) return true;
  if (pub?.poloPassivo && checkNome(pub.poloPassivo)) return true;
  if (pub?.destinatarioNome && checkNome(pub.destinatarioNome)) return true;

  return false;
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

  // Injetar destinatários dos metadados da API como "Destinatário(s)" (NÃO como "Advogados")
  // Esses são as partes notificadas, exatamente como aparece no portal DJEN
  const jaTemDestinatario = /\b(?:Destinat[áa]rio|Advogados?:|ADV\.|OAB[\s/])/i.test(original);
  if (!jaTemDestinatario) {
    const destsMeta = extractDestinatariosFromMeta(pub);
    if (destsMeta.length > 0) {
      sections.push('Destinatário(s):\n' + destsMeta.join('\n'));
    }
  }

  const blocks = [
    headerLines.filter(Boolean).join('\n'),
    sections.filter(Boolean).join('\n\n'),
    original,
  ].filter((b) => String(b || '').trim().length > 0);

  return blocks.join('\n\n');
}
