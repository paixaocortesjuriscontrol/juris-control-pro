// ============================================================================
// Normalização de sigla de tribunal para o Kurier.
// O Kurier grava o tribunal em formatos livres ("TRT 10_DJEN", "TRT - 2 REGIAO",
// "TJSP_DJEN - ESTADUAL", "DJMG"), enquanto os termos (monitoramentos_djen.tribunais)
// usam a sigla canônica ("TRT10", "TJSP", "TJMG").
// Retorna null quando não é possível reconhecer com segurança.
// ============================================================================

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB',
  'PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

/** Diários estaduais que não trazem o prefixo TJ. */
const DIARIOS_ESTADUAIS: Record<string, string> = {
  DJMG: 'TJMG',
  DJMS: 'TJMS',
  DJMT: 'TJMT',
  DJERJ: 'TJRJ',
  DJESP: 'TJSP',
  DJEGO: 'TJGO',
  DJEBA: 'TJBA',
  DJEPE: 'TJPE',
  DJEPR: 'TJPR',
  DJERS: 'TJRS',
  DJESC: 'TJSC',
  DJEDFT: 'TJDFT',
};

export function normalizarSiglaTribunalKurier(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let s = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  // Remove sufixos descritivos após " - " (ESTADUAL, JUDICIARIO, etc.)
  // mas preserva "TRT - 10 REGIAO" (onde o sufixo começa com dígito).
  s = s.replace(/\s*-\s*(?![0-9])[A-Z].*$/, '');
  // Remove marcadores de diário
  s = s.replace(/_DJEN/g, ' ').replace(/\bDJEN\b/g, ' ');
  s = s.replace(/\bREGIAO\b/g, ' ').replace(/\bREGIÃO\b/g, ' ');
  s = s.replace(/[^A-Z0-9]+/g, ' ').trim();

  if (!s) return null;

  // TRT / TRF com número (com ou sem espaço)
  const mReg = s.match(/\b(TRT|TRF)\s*0*(\d{1,2})\b/);
  if (mReg) return `${mReg[1]}${parseInt(mReg[2], 10)}`;

  // Tribunais superiores
  const mSup = s.match(/\b(TST|STJ|STF|STM|TSE)\b/);
  if (mSup) return mSup[1];

  // TJ + UF (aceita "TJ SP" ou "TJSP") e TJDFT
  if (/\bTJ\s*DFT\b/.test(s) || /\bTJDF\b/.test(s)) return 'TJDFT';
  const mTj = s.match(/\bTJ\s*([A-Z]{2})\b/);
  if (mTj && UFS.includes(mTj[1])) return `TJ${mTj[1]}`;

  // Diários estaduais conhecidos
  const compact = s.replace(/\s+/g, '');
  for (const [k, v] of Object.entries(DIARIOS_ESTADUAIS)) {
    if (compact.startsWith(k)) return v;
  }

  return null;
}

/**
 * Verifica se a publicação pertence ao escopo de tribunais do monitoramento.
 * - Monitoramento sem tribunais definidos: aceita qualquer tribunal.
 * - Sigla não reconhecida: aceita (conservador, para não perder publicação).
 */
export function tribunalPermitidoKurier(
  tribunalRaw: string | null | undefined,
  tribunaisMon: string[] | null | undefined,
): { permitido: boolean; sigla: string | null; reconhecida: boolean } {
  const lista = (tribunaisMon || []).map((t) => String(t || '').toUpperCase().trim()).filter(Boolean);
  const sigla = normalizarSiglaTribunalKurier(tribunalRaw);
  if (lista.length === 0) return { permitido: true, sigla, reconhecida: !!sigla };
  if (!sigla) return { permitido: true, sigla: null, reconhecida: false };
  return { permitido: lista.includes(sigla), sigla, reconhecida: true };
}
