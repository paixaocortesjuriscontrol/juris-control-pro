// Helper compartilhado para rotular monitoramentos nas combos/selects.
// Formato: TIPO + termo (ex: "PALAVRA-CHAVE + SANTANDER", "PARTE + AMOYRE",
// "ADVOGADO + 15553/SP + OSMAR MENDES").
export function formatMonitoramentoLabel(m: {
  id?: string;
  tipo?: string | null;
  termo_busca?: string | null;
  descricao?: string | null;
  oab?: string | null;
  uf?: string | null;
}): string {
  const tipoRaw = (m.tipo || '').toString().trim();
  const tipo = tipoRaw ? tipoRaw.toUpperCase() : 'TERMO';
  const nome = (m.descricao || m.termo_busca || '').toString().trim();

  if (tipoRaw.toLowerCase() === 'advogado') {
    const oabUf = [m.oab, m.uf].filter(Boolean).join('/').trim();
    const nomeLimpo = nome && nome !== oabUf && nome !== m.oab ? nome : '';
    const parts = ['ADVOGADO', oabUf, nomeLimpo].filter(Boolean);
    return parts.join(' + ');
  }

  if (nome) return `${tipo} + ${nome}`;
  return tipo || (m.id ? m.id.slice(0, 8) : 'Termo');
}
