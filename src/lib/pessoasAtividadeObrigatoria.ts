export const MSG_RESPONSAVEL_OU_ENVOLVIDO_OBRIGATORIO =
  "Selecione pelo menos um responsável ou envolvido.";

export type PessoaSelecionada = string | null | undefined;

/** Remove vazios e repetições sem escolher ninguém automaticamente. */
export function pessoasSelecionadas(
  responsaveis: readonly PessoaSelecionada[] = [],
  envolvidos: readonly PessoaSelecionada[] = [],
): string[] {
  return Array.from(
    new Set(
      [...responsaveis, ...envolvidos]
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function temResponsavelOuEnvolvido(
  responsaveis: readonly PessoaSelecionada[] = [],
  envolvidos: readonly PessoaSelecionada[] = [],
): boolean {
  return pessoasSelecionadas(responsaveis, envolvidos).length > 0;
}

export function mensagemPessoasObrigatorias(
  responsaveis: readonly PessoaSelecionada[] = [],
  envolvidos: readonly PessoaSelecionada[] = [],
): string | null {
  return temResponsavelOuEnvolvido(responsaveis, envolvidos)
    ? null
    : MSG_RESPONSAVEL_OU_ENVOLVIDO_OBRIGATORIO;
}

export function exigirResponsavelOuEnvolvido(
  responsaveis: readonly PessoaSelecionada[] = [],
  envolvidos: readonly PessoaSelecionada[] = [],
): void {
  const mensagem = mensagemPessoasObrigatorias(responsaveis, envolvidos);
  if (mensagem) throw new Error(mensagem);
}
