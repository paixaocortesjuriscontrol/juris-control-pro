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
