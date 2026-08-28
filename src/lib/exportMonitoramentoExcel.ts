import {
  cap,
  carregarMovimentacoes,
  carregarProcessosCompletos,
  carregarResponsaveisPorProcesso,
  formatarDataBr,
  resolverIdsEscopo,
  type EscopoParams,
} from "./exportProcessosModelosData";

const COLUNAS = [
  "Nº do Processo",
  "Órgão",
  "Cliente",
  "Data do Andamento",
  "Descrição",
  "Responsáveis",
  "Lido",
  "Habilitado",
];

interface Opcoes extends EscopoParams {
  /** Data inicial dos andamentos (yyyy-mm-dd) ou null para todo o período. */
  inicio: string | null;
  /** Data final dos andamentos (yyyy-mm-dd) ou null. */
  fim: string | null;
  onProgress?: (mensagem: string) => void;
}

/** Gera o Excel no formato "modelo planilha monitoramento" (aba Relatório). */
export async function exportarExcelMonitoramento(opcoes: Opcoes): Promise<number> {
  const { inicio, fim, onProgress } = opcoes;
  const XLSX = await import("xlsx");

  onProgress?.("Selecionando processos...");
  const ids = await resolverIdsEscopo(opcoes, (c, t) =>
    onProgress?.(`Selecionando processos ${c} de ${t}...`)
  );
  if (ids.length === 0) return 0;

  onProgress?.("Carregando dados dos processos...");
  const processos = await carregarProcessosCompletos(ids, (c, t) =>
    onProgress?.(`Carregando processos ${c} de ${t}...`)
  );
  const responsaveis = await carregarResponsaveisPorProcesso(ids);

  onProgress?.("Carregando andamentos...");
  const movimentacoes = await carregarMovimentacoes(ids, inicio, fim, (c, t) =>
    onProgress?.(`Carregando andamentos ${c} de ${t} processos...`)
  );

  const byId = new Map(processos.map((p) => [p.id, p]));

  const rows = movimentacoes
    .map((m) => {
      const p = byId.get(m.processo_id);
      if (!p) return null;
      const resp = responsaveis.get(p.id) || [];
      const respFallback = p.responsavel_nome ? [String(p.responsavel_nome).toUpperCase()] : [];
      return {
        "Nº do Processo": cap(p.numero),
        "Órgão": cap(p.tribunal),
        Cliente: cap(p.cliente_nome),
        "Data do Andamento": formatarDataBr(m.data_movimentacao),
        "Descrição": cap(m.descricao),
        "Responsáveis": cap((resp.length > 0 ? resp : respFallback).join(", ")),
        Lido: "Não",
        Habilitado: p.acompanhamento_especial ? "Sim" : "Não",
      };
    })
    .filter(Boolean) as Record<string, string>[];

  rows.sort((a, b) => {
    const toIso = (s: string) => s.split("/").reverse().join("-");
    return toIso(b["Data do Andamento"]).localeCompare(toIso(a["Data do Andamento"]));
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUNAS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `monitoramento_${stamp}.xlsx`);
  return rows.length;
}
