// ============================================================================
// UTILITY FUNCTIONS for monitorar-djen
// ============================================================================

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getBrazilISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getBrazilDayUtcRange(iso: string): { startUtc: string; endUtc: string } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const start = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
  }
  const [, y, mo, d] = m;
  const start = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 3, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  const normalized = (conteudo + dataDisponibilizacao).toLowerCase().replace(/\s+/g, ' ').trim();
  return generateHash(normalized);
}

export function extractProcessoNumero(conteudo: string, explicitNumero?: string | null): string | null {
  if (explicitNumero) return explicitNumero;
  
  const patterns = [
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
    /Processo\s*(?:n[º°]?\.?\s*)?(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i,
    /(\d{7}\/\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = conteudo.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Formata uma Date como YYYY-MM-DD usando componentes locais (sem conversão UTC).
 * Evita o bug de toISOString().split('T')[0] que desloca a data por fuso horário.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calcularPrimeiroDiaUtil(dataBase: Date, diasUteisAdicionar: number = 0): Date {
  const resultado = new Date(dataBase);
  
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth();
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  
  const proximoDiaUtil = (d: Date): Date => {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    if (estaNoRecesso(d)) {
      d.setMonth(0);
      d.setDate(7);
      if (d.getMonth() === 11) d.setFullYear(d.getFullYear() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
    return d;
  };
  
  proximoDiaUtil(resultado);
  
  let contador = 0;
  while (contador < diasUteisAdicionar) {
    resultado.setDate(resultado.getDate() + 1);
    proximoDiaUtil(resultado);
    contador++;
  }
  
  return resultado;
}

export async function withTimeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label}_timeout_${timeoutMs}ms`));
    }, timeoutMs) as unknown as number;
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const providedSignal = options.signal;
  let abortListener: (() => void) | null = null;

  if (providedSignal) {
    if (providedSignal.aborted) controller.abort();
    abortListener = () => controller.abort();
    try {
      providedSignal.addEventListener('abort', abortListener, { once: true });
    } catch {
      // ignore
    }
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (providedSignal && abortListener) {
      try {
        providedSignal.removeEventListener('abort', abortListener);
      } catch {
        // ignore
      }
    }
  }
}

export async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 4,
  baseDelay = 3000,
  timeoutMs = 15_000 
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      
      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited. Waiting ${waitTime}ms (retry ${attempt + 1})`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const waitTime = baseDelay * Math.pow(2, attempt);
      console.log(`Fetch error, waiting ${waitTime}ms:`, error);
      await delay(waitTime);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Linha é dado bancário/lixo (não é nome de parte).
 */
function linhaEDadoBancarioOuLixo(s: string): boolean {
  const t = s.trim();
  if (!t || t.length < 3) return true;
  if (/^\s*\(?R\$\s*[\d.\s,]+\)?\s*/.test(t)) return true;
  if (/\bTitular\s+da\s+conta\s*banc[aá]ria\s*:/i.test(t)) return true;
  if (/\bCPF\s*:\s*\d/i.test(t) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(t)) return true;
  if (/\bBanco\s*:\s*/i.test(t) || /\bAg[eê]ncia\s*:\s*/i.test(t)) return true;
  if (/\bOpera[çc][ãa]o\s*:\s*/i.test(t) || /\bConta\s+poupan[çc]a\s*:/i.test(t)) return true;
  if (/\b(art\.|§|inciso|CLT|defende|para tanto)\b/i.test(t)) return true;
  return false;
}

/**
 * Lista parece nomes de PARTES (empresas) e não advogados. Exige padrão de empresa (BANCO, S.A., etc.).
 */
function listaParecePartes(lines: string[]): boolean {
  if (lines.length === 0) return false;
  const joined = lines.join(' ').toUpperCase();
  return /\b(BANCO|S\.A\.|S\/A|CONTAX|RECUPERA[ÇC][ÃA]O\s+JUDICIAL|SINDICATO|INSTITUI[ÇC][ÃA]O)\b/.test(joined);
}

/**
 * Lista parece advogados (DR., DRA., OAB).
 */
function listaPareceAdvogados(lines: string[]): boolean {
  const joined = lines.join(' ');
  return /\b(DR\.|DRA\.|OAB\s*[A-Z]{2}\s*[-–]?\s*\d+)/i.test(joined);
}

/**
 * Extrai os dados do "lado esquerdo" da publicação (Parte(s), Advogado(s), Órgão, Tipo, Meio).
 * Corrige quando o tribunal coloca dados bancários em "Parte(s)" e nomes de partes em "Advogado(s)".
 */
export function extrairDadosLadoEsquerdo(conteudo: string): {
  orgao: string | null;
  tipo_comunicacao: string | null;
  meio: string | null;
  partes: string[];
  advogados: string[];
} {
  // Preservar quebras de linha para manter blocos "Advogado(s):" linha a linha
  const text = String(conteudo || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*[\r\n]+\s*/g, '\n')
    .trim();

  let orgao: string | null = null;
  let tipo_comunicacao: string | null = null;
  let meio: string | null = null;
  let partes: string[] = [];
  let advogados: string[] = [];

  const mOrgao = text.match(/\b[ÓO]rg[ãa]o\s*:\s*([^\n]+)/i);
  if (mOrgao) orgao = mOrgao[1].trim().slice(0, 200) || null;

  const mTipo = text.match(/Tipo\s+de\s+[Cc]omunica[çc][ãa]o\s*:\s*([^\n]+)/i);
  if (mTipo) tipo_comunicacao = mTipo[1].trim().slice(0, 100) || null;

  const mMeio = text.match(/\bMeio\s*:\s*([^\n]+)/i);
  if (mMeio) meio = mMeio[1].trim().slice(0, 50) || null;

  // Parte(s) com ou sem dois pontos (DJEN: "Parte(s)" ou "Parte(s):" + quebra + lista)
  const parteSection = text.match(/\bParte\s*\(\s*s\s*\)\s*(?:\s*:\s*)?\s*\n?([\s\S]*?)(?=\bAdvogado\s*\(\s*s\s*\)|\bAdvogados?\s*(?:\(\s*s\s*\))?\s*(?:\s*:\s*)?\s*\n|Conteúdo\s+Integral\s*:|$)/i);
  const rawParteLines: string[] = [];
  const vazioOuTraco = (s: string) => !s || /^[\s\-–—]*$/.test(s);
  if (parteSection) {
    const block = parteSection[1].trim();
    rawParteLines.push(...block.split(/\n/).map((l) => l.replace(/^[\s•\-*]+\s*/, '').trim()).filter(Boolean));
    for (const line of rawParteLines) {
      const s = line.slice(0, 300).trim();
      if (s && !vazioOuTraco(s) && !linhaEDadoBancarioOuLixo(s)) partes.push(s);
    }
  }

  // Advogado(s) com ou sem dois pontos — DJEN: "Advogado(s):" + quebra + lista
  const advSection = text.match(/\bAdvogados?\s*(?:\(\s*s\s*\))?\s*(?:\s*:\s*)?\s*\n?\s*([\s\S]*?)(?=\bParte\s*\(\s*s\s*\)|\bConteúdo\s+Integral\s*:|\bInteiro\s+teor\s*:|\n\s*\n\s*\n|$)/i);
  const linhaPareceAdvogado = (s: string) => /(?:DR\.|DRA\.|OAB\s+[A-Z]{2}\s*[-–—]?\s*\d)/i.test(s) && s.length <= 220;
  const rawAdvLines: string[] = [];
  if (advSection) {
    const block = advSection[1].trim();
    const byNewline = block.split(/\n/).map((l) => l.replace(/^[\s•\-*]+\s*/, '').trim()).filter(Boolean);
    if (byNewline.length === 1 && /(?:DR\.|DRA\.|OAB\s+[A-Z]{2})/i.test(byNewline[0])) {
      const one = byNewline[0];
      const byDr = one.split(/(?=\s*(?:DR\.|DRA\.)\s+)/gi).map((p) => p.trim()).filter(Boolean);
      rawAdvLines.push(...(byDr.length > 1 ? byDr : [one]));
    } else {
      rawAdvLines.push(...byNewline);
    }
    for (const line of rawAdvLines) {
      const s = line.slice(0, 250).trim();
      if (s && !vazioOuTraco(s) && linhaPareceAdvogado(s)) advogados.push(s);
    }
  }
  // Fallback 1: no texto inteiro, linhas "DR./DRA. NOME - OAB UF-NÚMERO" (traço - ou – ou —)
  if (advogados.length === 0 && text) {
    const oabRegex = /\s*((?:DR\.?|DRA\.?)\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*\/?\s*([A-Z]{2})\s*[-–—]?\s*(\d[\d.]*)/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = oabRegex.exec(text)) !== null) {
      const nome = (m[1] || '').trim();
      const uf = (m[2] || '').toUpperCase();
      const num = (m[3] || '').trim();
      if (nome.length < 4 || !uf || !num) continue;
      const key = `${uf}-${num}`;
      if (seen.has(key)) continue;
      seen.add(key);
      advogados.push(`${nome} - OAB ${uf}-${num}`);
    }
  }
  // Fallback 2: "OAB UF-NÚMERO" próximo a nome (ex.: "NOME OAB DF-60610")
  if (advogados.length === 0 && text) {
    const altRegex = /([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{3,60}?)\s+OAB\s+([A-Z]{2})\s*[-–—]?\s*(\d[\d.]*)/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = altRegex.exec(text)) !== null) {
      const nome = (m[1] || '').trim();
      const uf = (m[2] || '').toUpperCase();
      const num = (m[3] || '').trim();
      if (nome.length < 4 || /^(PARTE|ADVOGADO|CONTEÚDO|INTIMAÇÃO)$/i.test(nome)) continue;
      const key = `${uf}-${num}`;
      if (seen.has(key)) continue;
      seen.add(key);
      advogados.push(`${nome} - OAB ${uf}-${num}`);
    }
  }

  // Sem troca por heurística: gravar exatamente o que está em Parte(s) e Advogado(s) no texto.
  partes = partes.slice(0, 20);
  advogados = advogados.slice(0, 30);
  return { orgao, tipo_comunicacao, meio, partes, advogados };
}

/**
 * Retorna apenas o trecho do conteúdo que corresponde ao "lado esquerdo" da publicação
 * (metadados: Órgão, Tipo, Meio, Processo, Parte(s), Advogado(s)), antes do corpo.
 * Evita extrair "Advogado" do meio do texto (Conteúdo Integral / Inteiro teor).
 */
export function conteudoAteLadoEsquerdo(conteudo: string): string {
  const text = String(conteudo || '').trim();
  if (!text) return '';
  const markers = [
    /\n\s*Conteúdo\s+Integral\s*:/i,
    /\n\s*Inteiro\s+teor\s*:/i,
    /\n\s*INTEIRO\s+TEOR\s*:/,
    /\n\s*Corpo\s+do\s+texto\s*:/i,
  ];
  for (const re of markers) {
    const m = text.match(re);
    if (m && typeof m.index === 'number') return text.slice(0, m.index).trim();
  }
  return text;
}

/**
 * Extrai o "lado esquerdo" da publicação a partir dos metadados estruturados da API (raw_json).
 * Prioridade: usar os dados que a API envia (lado esquerdo do DJEN), não o parsing do conteúdo.
 * Retorna um objeto com orgao, tipo_comunicacao, meio, partes, advogados (vazios quando a API não envia).
 */
export function extrairLadoEsquerdoDeRawJson(raw: any): {
  orgao: string | null;
  tipo_comunicacao: string | null;
  meio: string | null;
  partes: string[];
  advogados: string[];
} {
  const obj = raw?.comunicacao ?? raw;
  const result = {
    orgao: null as string | null,
    tipo_comunicacao: null as string | null,
    meio: null as string | null,
    partes: [] as string[],
    advogados: [] as string[],
  };
  if (!obj) return result;

  result.orgao = (obj.nomeOrgao ?? obj.orgao ?? obj.órgao ?? '')?.trim()?.slice(0, 200) || null;
  result.tipo_comunicacao = (obj.tipoComunicacao ?? obj.tipo ?? obj.tipo_comunicacao ?? '')?.trim()?.slice(0, 100) || null;
  result.meio = (obj.meioComunicacao ?? obj.meio ?? '')?.trim()?.slice(0, 50) || null;

  if (Array.isArray(obj.partes)) {
    for (const p of obj.partes) {
      const nome = (p?.nome ?? p?.nomeParte ?? p?.parte ?? '').trim();
      if (nome && nome.length <= 300) result.partes.push(nome);
    }
    result.partes = result.partes.slice(0, 20);
  }
  const poloAtivo = (obj.poloAtivo ?? obj.polo_ativo ?? '').trim();
  const poloPassivo = (obj.poloPassivo ?? obj.polo_passivo ?? '').trim();
  if (poloAtivo && !result.partes.includes(poloAtivo)) result.partes.unshift(poloAtivo);
  if (poloPassivo && !result.partes.includes(poloPassivo)) result.partes.push(poloPassivo);
  result.partes = result.partes.slice(0, 20);

  result.advogados = extrairAdvogadosDeRawJson(raw);
  return result;
}

/**
 * Extrai advogados dos metadados estruturados da API PJE Comunica (raw_json).
 * Usado quando pub.raw_json tem destinatarios ou advogados.
 */
export function extrairAdvogadosDeRawJson(raw: any): string[] {
  const obj = raw?.comunicacao ?? raw;
  if (!obj) return [];
  const advs: string[] = [];
  const seen = new Set<string>();
  const add = (nome: string, oab?: string, uf?: string) => {
    const nomeTrim = (nome || '').trim();
    if (!nomeTrim || nomeTrim.length < 3) return;
    const key = nomeTrim.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const oabNum = (oab || '').replace(/\D/g, '');
    const ufNorm = (uf || '').trim().toUpperCase();
    if (oabNum && ufNorm) advs.push(`${nomeTrim} - OAB ${ufNorm}-${oabNum}`);
    else if (oabNum) advs.push(`${nomeTrim} - OAB ${oabNum}`);
    else advs.push(nomeTrim);
  };
  if (Array.isArray(obj.destinatarios)) {
    for (const d of obj.destinatarios) {
      const nome = d?.nome || d?.nomeAdvogado || d?.destinatarioNome || '';
      const oab = d?.oab || d?.numeroOab || d?.numeroInscricao || '';
      const uf = d?.uf || d?.siglaUf || d?.ufOab || '';
      if (nome) add(nome, oab, uf);
    }
  }
  if (Array.isArray(obj.advogados)) {
    for (const a of obj.advogados) {
      const nome = a?.nome || a?.nomeAdvogado || '';
      const oab = a?.numeroOab || a?.oab || '';
      const uf = a?.siglaUf || a?.uf || '';
      if (nome) add(nome, oab, uf);
    }
  }
  if (obj.destinatarioNome) add(obj.destinatarioNome, obj.destinatarioOab, obj.destinatarioUf);
  if (obj.nomeAdvogado) add(obj.nomeAdvogado, obj.oabAdvogado, obj.ufAdvogado);
  return advs.slice(0, 30);
}
