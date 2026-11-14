import { situacoesBase, type TipoSituacaoItem } from "@/constants/situacoesItem";

const TIPOS: TipoSituacaoItem[] = ["prazo", "tarefa", "audiencia", "parcelamento", "evento"];

/** Mapa tipo do formulário -> chave gravada em permissoes_situacao_tipo_tarefa. */
const TIPO_KEY: Record<TipoSituacaoItem, string> = {
  prazo: "PRAZO",
  tarefa: "TAREFA",
  audiencia: "AUDIENCIA",
  parcelamento: "PARCELAMENTO RECORRENTE",
  evento: "EVENTO",
};

export interface RegraSituacaoPainel {
  coordenacao_id?: string;
  situacao: string;
  tipo_tarefa: string;
  ativa: boolean | null;
}

export interface SituacaoFiltroOption {
  /** Valores possíveis gravados no status do item (separados por |). */
  value: string;
  label: string;
  valores: string[];
}

/** Confere se o status do item bate com a opção selecionada no filtro. */
export function statusCasaSituacao(status: string | null | undefined, value: string): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return value.split("|").some((v) => v === s);
}

/**
 * Monta as situações habilitadas nas coordenações consideradas, sem duplicar
 * rótulos compartilhados entre tipos diferentes de item.
 */
export function montarOpcoesSituacoes(
  regras: RegraSituacaoPainel[],
  coordenacaoIds: string[] = [],
): SituacaoFiltroOption[] {
  const ids = coordenacaoIds.length > 0
    ? coordenacaoIds
    : Array.from(new Set(regras.map((r) => r.coordenacao_id).filter(Boolean))) as string[];
  // Sem cadastro de coordenação (uso isolado da função), vale a regra padrão:
  // ausência de configuração significa situação liberada.
  const escopo = ids.length > 0 ? ids : ["__sem_configuracao__"];

  // Cada coordenação decide independentemente. Sem regra para o tipo ou para
  // a situação, ela está liberada; com várias coordenações, vale a união.
  const ativa = (tipo: TipoSituacaoItem, valor: string) => {
    const key = TIPO_KEY[tipo];
    return escopo.some((coordenacaoId) => {
      const regrasTipo = regras.filter(
        (r) => r.coordenacao_id === coordenacaoId &&
          (r.tipo_tarefa || "").trim().toUpperCase() === key,
      );
      if (regrasTipo.length === 0) return true;
      const linhas = regrasTipo.filter((r) => r.situacao === valor);
      if (linhas.length === 0) return true;
      return linhas.some((r) => r.ativa !== false);
    });
  };

  const porLabel = new Map<string, SituacaoFiltroOption>();
  for (const tipo of TIPOS) {
    for (const s of situacoesBase(tipo)) {
      if (!ativa(tipo, s.value)) continue;
      const existente = porLabel.get(s.label);
      if (existente) {
        if (!existente.valores.includes(s.value)) existente.valores.push(s.value);
      } else {
        porLabel.set(s.label, { label: s.label, value: s.value, valores: [s.value] });
      }
    }
  }

  return Array.from(porLabel.values()).map((o) => ({ ...o, value: o.valores.join("|") }));
}

/** Conta cada situação na base já filtrada pelos demais filtros do Painel. */
export function contarItensPorSituacao(
  itens: { status?: string | null }[],
  opcoes: SituacaoFiltroOption[],
): Record<string, number> {
  const totais: Record<string, number> = {};
  for (const opcao of opcoes) totais[opcao.value] = 0;
  for (const item of itens) {
    for (const opcao of opcoes) {
      if (statusCasaSituacao(item.status, opcao.value)) totais[opcao.value] += 1;
    }
  }
  return totais;
}
