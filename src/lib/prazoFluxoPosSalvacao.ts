/**
 * Decide o que acontece com o formulário de prazo logo depois de salvar.
 *
 * Regra que o cliente pediu (Bruna Sousa, 04/11/2026): ao clicar em
 * "Salvar e agendar outro prazo" o formulário precisa CONTINUAR ABERTO,
 * no Painel de Controle, na Análise DJEN, na ficha do processo e em
 * qualquer outra tela — ou seja, sem depender de o consumidor da janela
 * ter ou não um aviso de criação (`onAfterCreate`).
 *
 * O botão "Salvar e fechar" continua fechando, e a edição de um prazo
 * já existente continua fechando (não há o que encadear).
 */

export type PassoPosSalvacaoPrazo = "continuar-aberto" | "continuar-publicacao" | "fechar";

export interface OpcoesPassoPosSalvacaoPrazo {
  /** true quando estamos criando um prazo novo (não editando um existente). */
  isNovo: boolean;
  /** Usuário clicou em "Salvar e agendar outro prazo". */
  clicouOutroPrazo: boolean;
  /** Usuário clicou em "Salvar e fechar" (botão terciário). */
  clicouSalvarEFechar: boolean;
  /** O consumidor informou um aviso de criação (fluxo de publicações DJEN). */
  temAvisoDeCriacao: boolean;
}

export function decidirPassoPosSalvacaoPrazo(
  opcoes: OpcoesPassoPosSalvacaoPrazo,
): PassoPosSalvacaoPrazo {
  if (!opcoes.isNovo) return "fechar";
  if (opcoes.clicouSalvarEFechar) return "fechar";
  if (opcoes.clicouOutroPrazo) return "continuar-aberto";
  if (opcoes.temAvisoDeCriacao) return "continuar-publicacao";
  return "fechar";
}
