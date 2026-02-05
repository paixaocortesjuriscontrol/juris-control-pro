// ============================================================================
// PROXY FUNCTIONS for monitorar-djen (Jina, Browserless)
// ============================================================================

import { delay } from "./utils.ts";

// Jina Reader proxy (fast and cheap fallback)
const JINA_READER_URL = "https://r.jina.ai";
const JINA_API_KEY = Deno.env.get('JINA_API_KEY') || '';

// Browserless API (real Chrome browser - bypasses anti-bot)
const BROWSERLESS_API_URL = "https://chrome.browserless.io";
const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY') || '';

// Rate limiting para Jina
let lastJinaRequestTime = 0;
let JINA_MIN_INTERVAL_MS = 2000;

export function setJinaInterval(ms: number) {
  JINA_MIN_INTERVAL_MS = ms;
}

export function tryParseDjenJson(text: string): any | null {
  // 1) Direct JSON
  try {
    const data = JSON.parse(text);

    // Bright Data may wrap the response in { body: "..." }
    if (data?.body) {
      try {
        const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        if (bodyData && (bodyData.comunicacoes || bodyData.items || Array.isArray(bodyData))) {
          return bodyData;
        }
      } catch {
        // ignore
      }
    }

    if (data && (data.comunicacoes || data.items || Array.isArray(data))) {
      return data;
    }
  } catch {
    // ignore
  }

  // 2) Sometimes Jina returns a text wrapper; try to extract the JSON object containing "comunicacoes"
  const jsonMatch = text.match(/\{[\s\S]*"comunicacoes"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

// Browserless fallback (real Chrome browser - bypasses anti-bot more reliably)
export async function fetchViaBrowserless(url: string): Promise<any | null> {
  if (!BROWSERLESS_API_KEY) {
    console.log('[DJEN] BROWSERLESS_API_KEY not configured');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const browserlessUrl = `${BROWSERLESS_API_URL}/function?token=${BROWSERLESS_API_KEY}`;
    
    console.log('[DJEN] [Browserless] Fetching:', url);
    
    const puppeteerCode = `
      module.exports = async ({ page }) => {
        try {
          const response = await page.goto('${url}', { 
            waitUntil: 'networkidle0', 
            timeout: 15000 
          });
          const text = await page.evaluate(() => document.body.innerText);
          return { data: text, type: 'success' };
        } catch (error) {
          return { data: null, type: 'error', error: error.message };
        }
      };
    `;

    const resp = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: puppeteerCode }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '');
      console.log(`[DJEN] [Browserless] Error ${resp.status}:`, errorText.slice(0, 200));
      return null;
    }

    const result = await resp.json();
    
    if (result?.type === 'error') {
      console.log('[DJEN] [Browserless] Script error:', result.error);
      return null;
    }

    if (result?.data) {
      const parsed = tryParseDjenJson(result.data);
      if (parsed) {
        console.log('[DJEN] [Browserless] ✓ Success!');
        return parsed;
      }
      console.log('[DJEN] [Browserless] Response not JSON:', result.data.slice(0, 200));
    }
    
    return null;
  } catch (e) {
    console.log('[DJEN] [Browserless] Fetch failed:', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fast Jina proxy fallback
export async function fetchJsonViaJina(url: string): Promise<any | null> {
  if (!JINA_API_KEY) {
    console.log('[DJEN] JINA_API_KEY not configured');
    return null;
  }

  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastJinaRequestTime;
  if (timeSinceLastRequest < JINA_MIN_INTERVAL_MS) {
    const waitTime = JINA_MIN_INTERVAL_MS - timeSinceLastRequest;
    console.log(`[DJEN] Rate limiting Jina: waiting ${waitTime}ms`);
    await delay(waitTime);
  }
  lastJinaRequestTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    console.log('[DJEN] Trying Jina proxy fallback...');
    const jinaUrl = `${JINA_READER_URL}/${url}`;

    const resp = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get('retry-after') || '5', 10);
      const waitTime = Math.max(retryAfter * 1000, 5000);
      console.log(`[DJEN] Jina rate limited (429). Waiting ${waitTime}ms before retry...`);
      await delay(waitTime);
      const retryResp = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${JINA_API_KEY}`,
          'Accept': 'application/json, text/plain, */*',
        },
      });
      if (!retryResp.ok) {
        const t = await retryResp.text().catch(() => '');
        console.log(`[DJEN] Jina retry failed ${retryResp.status}: ${t.slice(0, 200)}`);
        return null;
      }
      const text = await retryResp.text();
      return tryParseDjenJson(text);
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.log(`[DJEN] Jina proxy error ${resp.status}: ${t.slice(0, 200)}`);
      return null;
    }

    const text = await resp.text();
    const parsed = tryParseDjenJson(text);

    if (parsed) {
      console.log('[DJEN] ✓ Jina proxy success!');
      return parsed;
    }

    console.log('[DJEN] Jina proxy returned non-JSON:', text.slice(0, 300));
    return null;
  } catch (e) {
    console.log('[DJEN] Jina proxy fetch failed:', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Unified proxy fetch: Browserless (real Chrome) > Jina (fast but may return HTML)
export async function fetchViaProxy(url: string): Promise<any | null> {
  if (BROWSERLESS_API_KEY) {
    const browserlessData = await fetchViaBrowserless(url);
    if (browserlessData) {
      return browserlessData;
    }
    console.log('[DJEN] Browserless failed, trying Jina fallback...');
  }
  
  if (JINA_API_KEY) {
    return await fetchJsonViaJina(url);
  }
  
  return null;
}
