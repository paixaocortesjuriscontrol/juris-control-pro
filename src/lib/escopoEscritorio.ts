/**
 * Escopo do Painel no modo Escritório: o mês inteiro das coordenações,
 * independentemente de quem é responsável ou envolvido.
 * - admin / assistente jurídico geral sem coordenação escolhida: todas;
 * - coordenação escolhida (acessível): só ela;
 * - demais: as coordenações do usuário.
 * Coordenações "restritas" (visão de todos desligada e usuário sem cargo de
 * gestão nelas) não entram na visão completa: se só sobrarem restritas, o
 * usuário vê apenas os itens em que é responsável/envolvido nelas.
 * Retorna null enquanto as coordenações do usuário ainda carregam.
 */
export type EscopoEscritorio =
  | { fetchAll: true }
  | { fetchAll: false; coordenacaoIds: string[]; strictCoordenacaoIsolation: boolean; responsavelIds?: string[] };

export function escopoEscritorio(p: {
  verTodas: boolean;
  coordEscolhida: string;
  coordenacoesUsuario: string[];
  coordLoading: boolean;
  coordRestritas?: string[];
  userId?: string;
}): EscopoEscritorio | null {
  const escolhida = p.coordEscolhida !== "todas" ? p.coordEscolhida : null;
  if (p.verTodas) {
    return escolhida
      ? { fetchAll: false, coordenacaoIds: [escolhida], strictCoordenacaoIsolation: true }
      : { fetchAll: true };
  }
  if (p.coordLoading) return null;
  let coords: string[] = [];
  if (escolhida && p.coordenacoesUsuario.includes(escolhida)) coords = [escolhida];
  else coords = p.coordenacoesUsuario;
  if (coords.length === 0) return null;

  const restritas = new Set(p.coordRestritas ?? []);
  const completas = coords.filter((c) => !restritas.has(c));
  if (completas.length > 0) {
    return { fetchAll: false, coordenacaoIds: completas, strictCoordenacaoIsolation: true };
  }
  if (!p.userId) return null;
  return { fetchAll: false, coordenacaoIds: coords, strictCoordenacaoIsolation: false, responsavelIds: [p.userId] };
}
