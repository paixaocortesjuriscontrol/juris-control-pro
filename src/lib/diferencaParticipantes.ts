/** Calcula quem entra e quem sai, sem tocar em quem permanece. */
export function diferencaParticipantes(atuais: string[], desejados: string[]) {
  const a = new Set(atuais.filter(Boolean));
  const d = new Set(desejados.filter(Boolean));
  return {
    adicionar: [...d].filter((id) => !a.has(id)),
    remover: [...a].filter((id) => !d.has(id)),
  };
}

