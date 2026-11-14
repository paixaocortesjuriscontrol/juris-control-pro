import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { cap, formatarDataBr } from "./exportProcessosModelosData";

const AZUL = "FF1F3864";
const CINZA = "FFF2F2F2";
const BRANCO = "FFFFFFFF";
const borda = {
  top: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
  left: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
  right: { style: "thin" as const, color: { argb: "FFBFBFBF" } },
};

const COLUNAS: { h: string; w: number }[] = [
  { h: "Nº do Processo", w: 26 },
  { h: "Parte Ativa (Requerente)", w: 42 },
  { h: "Parte Passiva (Requerida)", w: 42 },
  { h: "Tribunal", w: 26 },
  { h: "Vara / Câmara", w: 24 },
  { h: "Comarca", w: 20 },
  { h: "UF", w: 7 },
  { h: "Justiça", w: 14 },
  { h: "Situação", w: 20 },
  { h: "Cliente", w: 34 },
  { h: "Responsável", w: 28 },
  { h: "Coordenação", w: 30 },
  { h: "Etiquetas", w: 34 },
  { h: "Novidades", w: 12 },
  { h: "Última novidade", w: 17 },
  { h: "Distribuído em", w: 15 },
];

const situacaoLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
  arquivado_parcialmente: "Arquivado Parcialmente",
  arquivado_definitivamente: "Arquivado Definitivamente",
  suspenso: "Suspenso",
};

/** Dados complementares carregados por processo, já resolvidos em nomes. */
export interface ExtrasAcompanhamento {
  clientes: Map<string, string>;
  responsaveis: Map<string, string>;
  etiquetas: Map<string, string[]>;
  novidades: Map<string, { total: number; ultima: string | null }>;
}

/** Monta uma linha da planilha a partir do processo e dos dados complementares. */
export function montarLinhaAcompanhamento(
  p: any,
  extras: ExtrasAcompanhamento
): (string | number)[] {
  const novidades = extras.novidades.get(p.id);
  return [
    cap(p.numero),
    cap(p.polo_ativo),
    cap(p.polo_passivo),
    cap(p.tribunal),
    cap(p.vara),
    cap(p.comarca),
    cap(p.uf),
    cap(p.justica),
    cap(situacaoLabels[p.status] || p.situacao_original || p.status),
    cap(p.cliente_id ? extras.clientes.get(p.cliente_id) || "" : ""),
    cap(p.advogado_responsavel_id ? extras.responsaveis.get(p.advogado_responsavel_id) || "" : ""),
    cap(p.coordenacao?.nome ?? p.coordenacao_nome ?? ""),
    cap((extras.etiquetas.get(p.id) || []).join(", ")),
    novidades?.total ?? 0,
    novidades?.ultima ? formatarDataBr(novidades.ultima) : "",
    formatarDataBr(p.data_distribuicao),
  ];
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Lista completa de processos em acompanhamento especial, respeitando os filtros da tela. */
async function carregarProcessos(
  coord: string,
  busca: string,
  onProgress?: (carregados: number) => void
): Promise<any[]> {
  const todos: any[] = [];
  const POR_PAGINA = 1000;
  const termo = busca.trim();

  for (;;) {
    let q = supabase
      .from("processos")
      .select(
        "id, numero, polo_ativo, polo_passivo, tribunal, vara, comarca, uf, justica, status, situacao_original, data_distribuicao, cliente_id, advogado_responsavel_id, coordenacao_id, coordenacao:coordenacoes(nome)"
      )
      .eq("acompanhamento_especial", true)
      .order("numero")
      .range(todos.length, todos.length + POR_PAGINA - 1);

    if (coord !== "todas") q = q.eq("coordenacao_id", coord);
    if (termo) {
      q = q.or(
        `numero.ilike.%${termo}%,polo_ativo.ilike.%${termo}%,polo_passivo.ilike.%${termo}%`
      );
    }

    const { data, error } = await q;
    if (error) throw error;
    const linhas = data || [];
    todos.push(...linhas);
    onProgress?.(todos.length);
    if (linhas.length < POR_PAGINA) break;
  }

  return todos;
}

async function carregarExtras(ids: string[]): Promise<ExtrasAcompanhamento> {
  const clientes = new Map<string, string>();
  const responsaveis = new Map<string, string>();
  const etiquetas = new Map<string, string[]>();
  const novidades = new Map<string, { total: number; ultima: string | null }>();

  if (ids.length === 0) return { clientes, responsaveis, etiquetas, novidades };

  const processos = await Promise.all(
    chunk(ids, 300).map(async (parte) => {
      const { data } = await supabase
        .from("processos")
        .select("id, cliente_id, advogado_responsavel_id")
        .in("id", parte);
      return data || [];
    })
  );
  const planos = processos.flat();

  const clienteIds = [...new Set(planos.map((p: any) => p.cliente_id).filter(Boolean))] as string[];
  for (const parte of chunk(clienteIds, 300)) {
    const { data } = await supabase.from("clientes").select("id, nome").in("id", parte);
    (data || []).forEach((c: any) => clientes.set(c.id, c.nome));
  }

  const respIds = [
    ...new Set(planos.map((p: any) => p.advogado_responsavel_id).filter(Boolean)),
  ] as string[];
  for (const parte of chunk(respIds, 300)) {
    const { data } = await supabase.from("profiles").select("id, nome").in("id", parte);
    (data || []).forEach((p: any) => responsaveis.set(p.id, p.nome));
  }

  // Etiquetas do processo (CAPTURA etc.) — melhor esforço: falha não bloqueia a exportação.
  try {
    const vinculos = await Promise.all(
      chunk(ids, 300).map(async (parte) => {
        const { data } = await supabase
          .from("etiquetas_itens")
          .select("entidade_id, etiqueta_id")
          .eq("entidade", "processo")
          .in("entidade_id", parte);
        return data || [];
      })
    );
    const linhasVinc = vinculos.flat();
    const nomesEtiquetas = new Map<string, string>();
    const etiquetaIds = [...new Set(linhasVinc.map((v: any) => v.etiqueta_id).filter(Boolean))] as string[];
    for (const parte of chunk(etiquetaIds, 300)) {
      const { data } = await supabase.from("etiquetas").select("id, nome").in("id", parte);
      (data || []).forEach((e: any) => nomesEtiquetas.set(e.id, e.nome));
    }
    linhasVinc.forEach((v: any) => {
      const nome = nomesEtiquetas.get(v.etiqueta_id);
      if (!nome) return;
      const atual = etiquetas.get(v.entidade_id) || [];
      if (!atual.includes(nome)) atual.push(nome);
      etiquetas.set(v.entidade_id, atual);
    });
  } catch {
    /* sem etiquetas na planilha */
  }

  // Novidades do Acompanhamento Especial por processo.
  for (const parte of chunk(ids, 200)) {
    const { data } = await supabase
      .from("acompanhamento_especial_eventos")
      .select("processo_id, step_date")
      .in("processo_id", parte)
      .limit(20000);
    (data || []).forEach((e: any) => {
      if (!e.processo_id) return;
      const atual = novidades.get(e.processo_id) || { total: 0, ultima: null };
      atual.total += 1;
      const data = String(e.step_date || "");
      if (data && (!atual.ultima || data > atual.ultima)) atual.ultima = data;
      novidades.set(e.processo_id, atual);
    });
  }

  return { clientes, responsaveis, etiquetas, novidades };
}

/** Monta o arquivo Excel a partir dos processos já carregados (sem tocar no banco). */
export async function gerarPlanilhaAcompanhamentoEspecial(
  processos: any[],
  extras: ExtrasAcompanhamento
): Promise<Blob> {
  const linhas = processos.map((p: any) => montarLinhaAcompanhamento(p, extras));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Juris Control";

  const ws = wb.addWorksheet("Acompanhamento Especial", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  ws.columns = COLUNAS.map((c) => ({ width: c.w }));
  ws.mergeCells(1, 1, 1, COLUNAS.length);
  const titulo = ws.getCell(1, 1);
  titulo.value = "Processos em Acompanhamento Especial";
  titulo.font = { name: "Arial", size: 14, bold: true, color: { argb: AZUL } };
  ws.getRow(1).height = 24;

  const cab = ws.getRow(3);
  cab.values = COLUNAS.map((c) => c.h);
  cab.height = 20;
  cab.eachCell((c) => {
    c.font = { name: "Arial", bold: true, color: { argb: BRANCO } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = borda;
  });

  linhas.forEach((l, i) => {
    const r = ws.addRow(l);
    r.eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: "Arial", size: 10 };
      c.border = borda;
      c.alignment = { vertical: "top", wrapText: true };
      if (i % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
    });
  });
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + linhas.length, column: COLUNAS.length },
  };

  // Aba de resumo por coordenação.
  const porCoord = new Map<string, number>();
  processos.forEach((p: any) => {
    const nome = p.coordenacao?.nome || "Sem coordenação";
    porCoord.set(nome, (porCoord.get(nome) || 0) + 1);
  });
  const ws2 = wb.addWorksheet("Resumo por Coordenação");
  ws2.columns = [{ width: 46 }, { width: 18 }];
  ws2.mergeCells("A1:B1");
  const t2 = ws2.getCell("A1");
  t2.value = "Resumo por Coordenação";
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: AZUL } };
  ws2.getRow(1).height = 24;
  const h2 = ws2.getRow(3);
  h2.values = ["Coordenação", "Processos"];
  h2.eachCell((c) => {
    c.font = { name: "Arial", bold: true, color: { argb: BRANCO } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.border = borda;
  });
  [...porCoord.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .forEach(([nome, qtd], i) => {
      const r = ws2.getRow(4 + i);
      r.values = [nome, qtd];
      r.getCell(2).numFmt = "#,##0";
      r.eachCell((c) => {
        c.font = { name: "Arial", size: 10 };
        c.border = borda;
        if (i % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
      });
    });
  const totalRow = ws2.getRow(4 + porCoord.size);
  totalRow.values = ["Total", linhas.length];
  totalRow.getCell(2).numFmt = "#,##0";
  totalRow.eachCell((c) => {
    c.font = { name: "Arial", size: 10, bold: true };
    c.border = borda;
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Gera e baixa o Excel dos processos em Acompanhamento Especial. Retorna o total de linhas. */
export async function exportarExcelAcompanhamentoEspecial(opcoes: {
  coord: string;
  busca: string;
  onProgress?: (mensagem: string) => void;
}): Promise<number> {
  const { coord, busca, onProgress } = opcoes;

  onProgress?.("Selecionando processos em acompanhamento especial...");
  const processos = await carregarProcessos(coord, busca, (n) =>
    onProgress?.(`Carregando processos... ${n.toLocaleString("pt-BR")}`)
  );
  if (processos.length === 0) return 0;

  onProgress?.("Complementando cliente, responsável, etiquetas e novidades...");
  const extras = await carregarExtras(processos.map((p: any) => p.id));

  const blob = await gerarPlanilhaAcompanhamentoEspecial(processos, extras);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acompanhamento_especial_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);

  return processos.length;
}
