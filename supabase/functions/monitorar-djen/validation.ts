// ============================================================================
// VALIDATION FUNCTIONS for monitorar-djen
// 100% STRICT phrase matching - no partial matches
// ============================================================================

export interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  criado_por: string;
  coordenacao_id?: string;
  exclusoes?: string[];
  condicao_concomitante?: string;
  termos_or?: string[];
  tribunais?: string[];
  descricao?: string;
  buscar_parte?: boolean;
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    .replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    .replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Palavra-chave: usar SOMENTE o termo. Remove prefixos tribunal/Adv (filtros separados). */
export function extrairPalavraChavePura(termo: string): string {
  if (!termo?.trim()) return termo;
  let s = termo.trim();
  s = s.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, '');
  s = s.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, '');
  s = s.replace(/^Adv\.?\s*/i, '');
  return s.trim() || termo;
}

/** FRASE EXATA na ordem - "Super Quadra" só casa com "Super Quadra", não com "enquadramento". */
export function contemFraseExata(conteudoNorm: string, termoNorm: string): boolean {
  if (!termoNorm) return true;
  try {
    const re = new RegExp(`(?:^|\\s)${escapeRegex(termoNorm)}(?:\\s|$)`, '');
    return re.test(conteudoNorm);
  } catch {
    return false;
  }
}

/**
 * VALIDAÇÃO ESTRITA para termos com "+" (AND logic).
 * Cada segmento separado por "+" DEVE aparecer 100% (frase exata) no texto.
 */
export function validarTermoComAnd(conteudoNorm: string, termo: string): boolean {
  if (!termo.includes('+')) {
    return contemFraseExata(conteudoNorm, normalizar(termo));
  }
  
  const partesAnd = termo.split('+').map(p => p.trim()).filter(Boolean);
  for (const parte of partesAnd) {
    if (/^OAB\s/i.test(parte)) continue;
    const parteNorm = normalizar(parte);
    if (parteNorm && !contemFraseExata(conteudoNorm, parteNorm)) {
      return false;
    }
  }
  return true;
}

export function conteudoContemTermo(
  conteudo: string,
  termo: string,
  tipo: string,
  oab?: string
): boolean {
  if (!conteudo) return false;

  const conteudoNorm = normalizar(conteudo);

  if (tipo === 'advogado' || tipo === 'nome') {
    if (termo) {
      const termoBase = extrairPalavraChavePura(termo);
      // Se o nome completo é encontrado, aceitar (advogados podem ter OABs
      // diferentes em estados diferentes, ex: DF-15553 e SP-310314)
      if (validarTermoComAnd(conteudoNorm, termoBase)) {
        return true;
      }
    }

    // Nome não encontrado: tentar validar pela OAB
    if (tipo === 'advogado' && oab) {
      const oabDigits = String(oab).replace(/\D/g, '');
      if (oabDigits.length >= 3) {
        const oabPattern = new RegExp(oabDigits.split('').join('[.\\s-]?'), 'i');
        if (oabPattern.test(conteudo)) return true;
      }
    }

    // Nem nome nem OAB encontrados
    return false;
  }

  if (tipo === 'processo') {
    const numero = String(termo || '').replace(/\D/g, '');
    if (!numero) return true;
    return conteudoNorm.includes(numero);
  }

  const termoPuro = extrairPalavraChavePura(termo);
  if (!termoPuro) return true;
  return validarTermoComAnd(conteudoNorm, termoPuro);
}

export function parseAdvogadoTermo(raw: string): { nome?: string; oabDigits?: string; uf?: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};

  const oabNomeMatch = trimmed.match(/^(\d{3,6})\s*\/\s*(.+)$/i);
  if (oabNomeMatch) {
    return {
      oabDigits: oabNomeMatch[1],
      nome: oabNomeMatch[2].trim(),
    };
  }

  const nomeOabMatch = trimmed.match(/^(.+?)\s*\/\s*(\d{3,6})$/i);
  if (nomeOabMatch) {
    return {
      oabDigits: nomeOabMatch[2],
      nome: nomeOabMatch[1].trim(),
    };
  }

  const digits = trimmed.replace(/\D/g, '');
  const prefixUf = trimmed.match(/([A-Za-z]{2})\s*\d/);
  const suffixUf = trimmed.match(/\d\s*\/\s*([A-Za-z]{2})$/);
  const uf = (prefixUf?.[1] || suffixUf?.[1])?.toUpperCase();
  const hasLetters = /[A-Za-zÀ-ÿ]/.test(trimmed);

  if (digits.length >= 3 && (uf || !hasLetters)) {
    return { oabDigits: digits, uf };
  }

  return { nome: trimmed };
}

export function buildAdvogadoTargets(
  termo: string,
  termosOr: string[] | undefined,
  oab?: string,
  uf?: string
): Array<{ nome?: string; oabDigits?: string; uf?: string }> {
  const targets: Array<{ nome?: string; oabDigits?: string; uf?: string }> = [];
  const baseNome = String(termo || '').trim();
  const baseOab = String(oab || '').replace(/\D/g, '');
  const baseUf = String(uf || '').trim().toUpperCase();

  if (baseNome || baseOab) {
    targets.push({
      nome: baseNome || undefined,
      oabDigits: baseOab || undefined,
      uf: baseUf || undefined,
    });
  }

  for (const t of termosOr || []) {
    const parsed = parseAdvogadoTermo(t);
    if (parsed.nome || parsed.oabDigits) {
      targets.push(parsed);
    }
  }

  return targets;
}

export function conteudoContemTermoOuOr(
  conteudo: string,
  monitoramento: Monitoramento
): boolean {
  const termoPuro = (monitoramento.tipo === 'palavra-chave' || monitoramento.tipo === 'parte' || monitoramento.tipo === 'advogado' || monitoramento.tipo === 'nome')
    ? extrairPalavraChavePura(monitoramento.termo_busca)
    : monitoramento.termo_busca;

  if (monitoramento.tipo === 'nome') {
    return conteudoContemTermo(conteudo, termoPuro, 'nome', undefined);
  }

  // Para tipo 'parte', a API já filtrou por nomeParte — o termo aparece nos metadados
  // estruturados (partes/polos) e NÃO necessariamente no corpo do texto.
  // Confiar no filtro da API e pular validação de conteúdo.
  if (monitoramento.tipo === 'parte') {
    return true;
  }
  
  if (monitoramento.tipo !== 'advogado') {
    // palavra-chave/processo: aceitar termo principal OU qualquer termo OR
    if (conteudoContemTermo(conteudo, termoPuro, monitoramento.tipo, monitoramento.oab)) {
      return true;
    }

    const termosOrPuros = (monitoramento.termos_or || [])
      .map((t) => extrairPalavraChavePura(t.trim()))
      .filter(Boolean);

    return termosOrPuros.some((t) =>
      conteudoContemTermo(conteudo, t, monitoramento.tipo, undefined)
    );
  }

  const termosOrPuros = (monitoramento.termos_or || []).map((t) => extrairPalavraChavePura(t.trim())).filter(Boolean);
  const targets = buildAdvogadoTargets(
    termoPuro,
    termosOrPuros.length > 0 ? termosOrPuros : undefined,
    monitoramento.oab,
    monitoramento.uf
  );
  
  if (targets.length === 0) {
    return conteudoContemTermo(conteudo, termoPuro, monitoramento.tipo, monitoramento.oab);
  }
  
  return targets.some((t) =>
    conteudoContemTermo(conteudo, t.nome || '', 'advogado', t.oabDigits)
  );
}

export function condicaoConcomitanteAtendida(conteudo: string, condicao?: string): boolean {
  if (!condicao?.trim()) return true;
  
  const conteudoNorm = normalizar(conteudo);
  
  // Se tem "+", usar lógica AND (todas as partes devem casar)
  if (condicao.includes('+')) {
    return validarTermoComAnd(conteudoNorm, condicao);
  }
  
  // Caso contrário, frase exata simples
  const condicaoNorm = normalizar(condicao.trim());
  return contemFraseExata(conteudoNorm, condicaoNorm);
}

export function shouldExclude(conteudo: string, exclusoes: string[], partesJson?: any, advogadosJson?: any): string | null {
  if (!exclusoes || exclusoes.length === 0) return null;

  // Checar texto + metadados estruturados para exclusão robusta
  const textoCompleto = [
    conteudo,
    partesJson ? (typeof partesJson === 'string' ? partesJson : JSON.stringify(partesJson)) : '',
    advogadosJson ? (typeof advogadosJson === 'string' ? advogadosJson : JSON.stringify(advogadosJson)) : '',
  ].filter(Boolean).join('\n').toUpperCase();

  for (const termo of exclusoes) {
    if (textoCompleto.includes(termo.toUpperCase())) {
      return termo;
    }
  }
  return null;
}

export interface AudienciaInfo {
  dataAudiencia: string | null;
  tipoAudiencia: string | null;
  localAudiencia: string | null;
  contexto: string;
}

export function detectAudiencia(conteudo: string): AudienciaInfo | null {
  const conteudoLower = conteudo.toLowerCase();
  
  const audienciaTerms = [
    'audiência',
    'audiencia',
    'sessão de julgamento',
    'sessao de julgamento',
    'pauta de julgamento',
  ];
  
  const hasAudiencia = audienciaTerms.some(term => conteudoLower.includes(term));
  if (!hasAudiencia) return null;
  
  let contexto = '';
  for (const term of audienciaTerms) {
    const index = conteudoLower.indexOf(term);
    if (index !== -1) {
      const start = Math.max(0, index - 100);
      const end = Math.min(conteudo.length, index + term.length + 200);
      contexto = (start > 0 ? '...' : '') + 
                 conteudo.slice(start, end) + 
                 (end < conteudo.length ? '...' : '');
      break;
    }
  }
  
  let dataAudiencia: string | null = null;
  
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = contexto.match(pattern);
    if (match) {
      if (match[2] && isNaN(parseInt(match[2]))) {
        const months: Record<string, string> = {
          'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
          'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
          'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        const month = months[match[2].toLowerCase()] || '01';
        dataAudiencia = `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
      } else {
        dataAudiencia = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      break;
    }
  }
  
  let tipoAudiencia: string | null = null;
  const tipoPatterns = [
    /audiência\s+de\s+(conciliação|instrução|julgamento|instrução e julgamento|una|inicial|custódia)/i,
    /audiencia\s+de\s+(conciliacao|instrucao|julgamento|instrucao e julgamento|una|inicial|custodia)/i,
  ];
  
  for (const pattern of tipoPatterns) {
    const match = conteudo.match(pattern);
    if (match) {
      tipoAudiencia = match[1];
      break;
    }
  }
  
  let localAudiencia: string | null = null;
  const localPatterns = [
    /(?:local|sala|endereço|endereco|forum|fórum)[\s:]+([^,\n]{10,60})/i,
    /(?:na|no|em)\s+(?:sala|fórum|forum)\s+([^,\n]{5,50})/i,
  ];
  
  for (const pattern of localPatterns) {
    const match = conteudo.match(pattern);
    if (match) {
      localAudiencia = match[1].trim();
      break;
    }
  }
  
  return {
    dataAudiencia,
    tipoAudiencia,
    localAudiencia,
    contexto,
  };
}
