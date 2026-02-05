// ============================================================================
// TRIBUNAL CONSTANTS and HELPERS for monitorar-djen
// ============================================================================

export const TODOS_IDS_CIVEIS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR',
  'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
];

export const TODOS_IDS_TRABALHISTAS = [
  'TST', 'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8',
  'TRT9', 'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16',
  'TRT17', 'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24',
];

// Expande IDs sintéticos (TODOS_CIVEIS, TODOS_TRT) para a lista real de tribunais
export function expandirTribunais(tribunais: string[] | undefined | null): string[] | null {
  if (!tribunais || tribunais.length === 0) return null;
  
  const expandidos = new Set<string>();
  
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') {
      TODOS_IDS_CIVEIS.forEach(id => expandidos.add(id));
    } else if (t === 'TODOS_TRT') {
      TODOS_IDS_TRABALHISTAS.forEach(id => expandidos.add(id));
    } else {
      expandidos.add(t);
    }
  }
  
  // Se após expansão temos muitos tribunais (>15), buscar sem filtro é mais eficiente
  if (expandidos.size > 15) {
    console.log(`[DJEN] Expandiu para ${expandidos.size} tribunais. Buscando sem filtro para melhor performance.`);
    return null;
  }
  
  return Array.from(expandidos);
}

export const browserHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://comunica.pje.jus.br",
  "Referer": "https://comunica.pje.jus.br/",
};

export const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";
