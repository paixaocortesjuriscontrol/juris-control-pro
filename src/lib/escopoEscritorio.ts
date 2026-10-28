/**
 * Escopo do Painel no modo Escritório: o mês inteiro das coordenações,
 * independentemente de quem é responsável ou envolvido.
 * - admin / assistente jurídico geral sem coordenação escolhida: todas;
 * - coordenação escolhida (acessível): só ela;
 * - demais: as coordenações do usuário.
 * Retorna null enquanto as coordenações do usuário ainda carregam.
 */
export type EscopoEscritorio =
  | { fetchAll: true }
  | { fetchAll: false; coordenacaoIds: string[]; strictCoordenacaoIsolation: true };

export function escopoEscritorio(p: {
  verTodas: boolean;
  coordEscolhida: string;
  coordenacoesUsuario: string[];
  coordLoading: boolean;
}): EscopoEscritorio | null {
  const escolhida = p.coordEscolhida !== "todas" ? p.coordEscolhida : null;
  if (p.verTodas) {
    return escolhida
      ? { fetchAll: false, coordenacaoIds: [escolhida], strictCoordenacaoIsolation: true }
      : { fetchAll: true };
  }
  if (p.coordLoading) return null;
  if (escolhida && p.coordenacoesUsuario.includes(escolhida)) {
    return { fetchAll: false, coordenacaoIds: [escolhida], strictCoordenacaoIsolation: true };
  }
  if (p.coordenacoesUsuario.length > 0) {
    return { fetchAll: false, coordenacaoIds: p.coordenacoesUsuario, strictCoordenacaoIsolation: true };
  }
  return null;
}
