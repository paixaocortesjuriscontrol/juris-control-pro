// ============================================================================
// CONFIGURATION MODULE for monitorar-djen
// ============================================================================

export interface DjenConfig {
  modo_processamento: 'sequencial' | 'semi_paralelo' | 'paralelo_total';
  max_paralelo: number;
  max_por_invocacao: number;
  delay_entre_monitoramentos: number;
  delay_entre_paginas: number;
  delay_entre_tribunais: number;
  delay_jina_api: number;
  soft_timeout_ms: number;
  finalization_buffer_ms: number;
  max_retries: number;
  retry_base_delay_ms: number;
}

export const DEFAULT_CONFIG: DjenConfig = {
  modo_processamento: 'semi_paralelo',
  max_paralelo: 5,
  max_por_invocacao: 10,
  delay_entre_monitoramentos: 500,
  delay_entre_paginas: 300,
  delay_entre_tribunais: 200,
  delay_jina_api: 2000,
  soft_timeout_ms: 50000,
  finalization_buffer_ms: 10000,
  max_retries: 3,
  retry_base_delay_ms: 2000,
};

export let CONFIG: DjenConfig = { ...DEFAULT_CONFIG };

// Legacy constants - will be replaced by CONFIG values
export let MAX_PER_INVOCATION = 10;
export let SOFT_TIMEOUT_MS = 50_000;
export let FINALIZATION_BUFFER_MS = 10_000;
export let INTER_MONITORAMENTO_DELAY_MS = 500;
export let INTER_TRIBUNAL_DELAY_MS = 200;
export let INTER_PAGE_DELAY_MS = 300;
export let JINA_MIN_INTERVAL_MS = 2000;

// Other constants
export const RETRY_DELAY_MINUTES = 15;
export const MAX_RETRIES = 4;
export const BASE_DELAY_MS = 1500;
export const STAGGER_DELAY_MS = 500;
export const INTER_CANDIDATE_DELAY_MS = 1000;

export function applyConfigToLegacy(): void {
  MAX_PER_INVOCATION = CONFIG.max_por_invocacao;
  SOFT_TIMEOUT_MS = CONFIG.soft_timeout_ms;
  FINALIZATION_BUFFER_MS = CONFIG.finalization_buffer_ms;
  INTER_MONITORAMENTO_DELAY_MS = CONFIG.delay_entre_monitoramentos;
  INTER_TRIBUNAL_DELAY_MS = CONFIG.delay_entre_tribunais;
  INTER_PAGE_DELAY_MS = CONFIG.delay_entre_paginas;
  JINA_MIN_INTERVAL_MS = CONFIG.delay_jina_api;
}

export function applyConservativeProfile(reason: string): void {
  CONFIG = {
    ...CONFIG,
    modo_processamento: 'sequencial',
    max_paralelo: 1,
    max_por_invocacao: 2,
    delay_entre_monitoramentos: 1500,
    delay_entre_paginas: 800,
    delay_entre_tribunais: 800,
    delay_jina_api: 3000,
    soft_timeout_ms: 60000,
    finalization_buffer_ms: 15000,
    max_retries: 1,
    retry_base_delay_ms: 2000,
  };
  applyConfigToLegacy();
  console.log(`[DJEN] Modo conservador aplicado (${reason}).`);
}

export function updateConfig(newConfig: Partial<DjenConfig>): void {
  CONFIG = { ...CONFIG, ...newConfig };
  applyConfigToLegacy();
}

export async function loadConfigFromDatabase(supabase: any): Promise<void> {
  try {
    const { data: tipoRow } = await supabase
      .from('tipo_monitoramento')
      .select('id')
      .eq('slug', 'djen_termos')
      .maybeSingle();

    const query = supabase
      .from('parametros_monitoramento_djen')
      .select('*')
      .eq('ativo', true);

    const { data, error } = tipoRow?.id
      ? await query.eq('tipo_monitoramento_id', tipoRow.id).limit(1).single()
      : await query.limit(1).single();

    if (error) {
      console.log('[DJEN] Erro ao carregar parâmetros da tabela, usando valores padrão:', error.message);
      return;
    }

    if (data) {
      CONFIG = {
        modo_processamento: data.modo_processamento || 'semi_paralelo',
        max_paralelo: data.max_paralelo || 5,
        max_por_invocacao: data.max_por_invocacao || 10,
        delay_entre_monitoramentos: data.delay_entre_monitoramentos || 500,
        delay_entre_paginas: data.delay_entre_paginas || 300,
        delay_entre_tribunais: data.delay_entre_tribunais || 200,
        delay_jina_api: data.delay_jina_api || 2000,
        soft_timeout_ms: data.soft_timeout_ms || 50000,
        finalization_buffer_ms: data.finalization_buffer_ms || 10000,
        max_retries: data.max_retries || 3,
        retry_base_delay_ms: data.retry_base_delay_ms || 2000,
      };

      applyConfigToLegacy();

      console.log(`[DJEN] Parâmetros carregados: modo=${CONFIG.modo_processamento}, paralelo=${CONFIG.max_paralelo}, por_invocacao=${CONFIG.max_por_invocacao}`);
    }
  } catch (e) {
    console.log('[DJEN] Erro ao carregar config:', e);
  }
}
