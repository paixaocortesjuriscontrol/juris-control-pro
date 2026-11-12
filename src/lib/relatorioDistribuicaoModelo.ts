import type ExcelJS from "exceljs";
import { obterTribunalMni } from "@/utils/mniTribunalMap";

export type ClassificacaoDistribuicao = "DISTRIBUIÇÃO INICIAL" | "TRÂMITE INTERNO";

export type ParteRelatorio = {
  nome?: string | null;
  polo?: string | null;
  is_advogado?: boolean | null;
};

export type ProcessoRelatorio = {
  numero?: string | null;
  orgao_julgador?: string | null;
  classe?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
  advogados_identificados?: unknown;
  tribunal?: string | null;
  coordenacao_id?: string | null;
};

export type PublicacaoRelatorio = {
  processo_numero?: string | null;
  orgao?: string | null;
  conteudo?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
  advogados_json?: unknown;
  data_disponibilizacao?: string | null;
  data_publicacao?: string | null;
  tribunal?: string | null;
};

export type BennerRelatorio = {
  id: string;
  processo?: string | null;
  turma?: string | null;
  relator?: string | null;
  recorrente?: string | null;
  reclamante?: string | null;
  reclamada?: string | null;
  advogados_internos?: string[] | null;
  tipo_recurso?: string | null;
  tipo_recurso_reclamante?: string | null;
  tipo_recurso_banco?: string | null;
  tipo_recurso_terceiro?: string | null;
  data_distribuicao_real?: string | null;
  data_distribuicao_planilha?: string | null;
  data_distribuicao?: string | null;
  data_publicacao_djen?: string | null;
  tribunal?: string | null;
};

export type LinhaRelatorioDistribuicao = {
  processo: string;
  orgao: string;
  dataDistribuicao: string;
  dataDjen: string;
  poloAtivo: string;
  poloPassivo: string;
  advogados: string;
  classe: string;
  tribunal: string;
  classificacao: ClassificacaoDistribuicao;
  ordemData: string;
};

const txt = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const digits = (v: unknown) => txt(v).replace(/\D/g, "");

export function formatarDataBr(v: unknown): string {
  const valor = txt(v);
  if (!valor) return "";
  const simples = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (simples) return `${simples[3]}/${simples[2]}/${simples[1]}`;
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Mesma regra da fórmula da coluna J do modelo enviado. */
export function classificarOrgaoDistribuicao(orgao: string): ClassificacaoDistribuicao {
  const valor = txt(orgao).toUpperCase();
  return ["PRESIDÊNCIA", "TURMA", "SETR2", "SBDI-II", "SDI-2"].some((termo) => valor.includes(termo))
    ? "DISTRIBUIÇÃO INICIAL"
    : "TRÂMITE INTERNO";
}

export function tribunalOrigemPeloCnj(processo: string): string {
  const info = obterTribunalMni(processo);
  if (!info || !info.sigla.startsWith("TRT")) return "";
  return info.nome
    .replace("Tribunal Regional do Trabalho da ", "TRT da ")
    .replace("(Campinas/SP)", "(Campinas)");
}

function orgaoDaPublicacao(pub?: PublicacaoRelatorio): string {
  const orgao = txt(pub?.orgao);
  if (orgao && norm(orgao) !== "TST") return orgao;
  const conteudo = txt(pub?.conteudo).replace(/<[^>]+>/g, " ");
  const achado = conteudo.match(/distribu[ií]do\s+(?:para|à|a)\s+([^.\n;]+)/i);
  return txt(achado?.[1]) || orgao;
}

function montarOrgao(b: BennerRelatorio, processo?: ProcessoRelatorio, pub?: PublicacaoRelatorio): string {
  const turma = txt(b.turma);
  const relator = txt(b.relator);
  if (turma && relator) {
    if (/gab\.?/i.test(turma)) return `${turma} ${relator}`;
    return `${turma} - ${/^gab\.?/i.test(relator) ? relator : `Gab. ${relator}`}`;
  }
  return turma || txt(processo?.orgao_julgador) || orgaoDaPublicacao(pub);
}

function nomesDasPartes(partes: ParteRelatorio[], polo: "ativo" | "passivo"): string[] {
  const ativo = polo === "ativo";
  return Array.from(new Set(partes
    .filter((p) => !p.is_advogado && txt(p.nome))
    .filter((p) => {
      const valor = norm(p.polo);
      return ativo
        ? valor === "ACTIVE" || valor === "ATIVO" || valor.startsWith("ACTIV")
        : valor === "PASSIVE" || valor === "PASSIVO" || valor.startsWith("PASSIV");
    })
    .map((p) => txt(p.nome))));
}

function montarPolos(b: BennerRelatorio, partes: ParteRelatorio[], processo?: ProcessoRelatorio, pub?: PublicacaoRelatorio) {
  const ativos = nomesDasPartes(partes, "ativo");
  const passivos = nomesDasPartes(partes, "passivo");
  const ativo = ativos.join("; ") || txt(pub?.polo_ativo) || txt(processo?.polo_ativo);
  const passivo = passivos.join("; ") || txt(pub?.polo_passivo) || txt(processo?.polo_passivo);
  if (ativo || passivo) return { ativo, passivo };

  const reclamante = txt(b.reclamante);
  const reclamada = txt(b.reclamada);
  const recorrente = norm(b.recorrente);
  const bancoRecorre = (recorrente.includes("RECLAMAD") || recorrente.includes("BANCO")) && !recorrente.includes("RECLAMANTE");
  if (bancoRecorre) return { ativo: reclamada, passivo: reclamante };
  return { ativo: reclamante, passivo: reclamada };
}

type AdvogadoJson = {
  nome?: unknown;
  name?: unknown;
  advogado?: unknown;
  oab?: unknown;
  license_number?: unknown;
  numero_oab?: unknown;
  numeroOab?: unknown;
  uf?: unknown;
  estado?: unknown;
  oab_uf?: unknown;
};

function listaJson(valor: unknown): Array<string | AdvogadoJson> {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "string") {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatarOab(valor: unknown, uf?: unknown): string {
  const oab = txt(valor);
  if (!oab) return "";
  if (/^OAB/i.test(oab)) return oab;
  const estado = txt(uf).toUpperCase();
  if (estado) return `OAB/${estado} ${oab}`;
  return /^\d/.test(oab) ? `OAB ${oab}` : `OAB/${oab}`;
}

function formatarAdvogados(b: BennerRelatorio, partes: ParteRelatorio[], processo?: ProcessoRelatorio, pub?: PublicacaoRelatorio): string {
  const porNome = new Map<string, string>();
  const adicionar = (nomeValor: unknown, oabValor?: unknown, uf?: unknown) => {
    const nome = txt(nomeValor);
    if (!nome) return;
    const oab = formatarOab(oabValor, uf);
    const completo = oab && !nome.toUpperCase().includes(oab.toUpperCase()) ? `${nome} - ${oab}` : nome;
    const chave = norm(nome);
    const anterior = porNome.get(chave);
    if (!anterior || (completo.length > anterior.length && completo.includes(nome))) porNome.set(chave, completo);
  };

  for (const fonte of [pub?.advogados_json, processo?.advogados_identificados]) {
    for (const item of listaJson(fonte)) {
      if (typeof item === "string") adicionar(item);
      else adicionar(
        item?.nome || item?.name || item?.advogado,
        item?.oab || item?.license_number || item?.numero_oab || item?.numeroOab,
        item?.uf || item?.estado || item?.oab_uf,
      );
    }
  }
  for (const parte of partes.filter((p) => p.is_advogado)) adicionar(parte.nome);
  for (const nome of b.advogados_internos || []) adicionar(nome);
  return Array.from(porNome.values()).join("; ");
}

const CLASSES: Record<string, string> = {
  "ACAO RESCISORIA": "AR",
  "AGRAVO DE INSTRUMENTO": "AIRR",
  "AGRAVO DE INSTRUMENTO EM RECURSO DE REVISTA": "AIRR",
  "AGRAVO EM RECURSO EXTRAORDINARIO": "ARE",
  "AGRAVO INTERNO": "AgInt",
  "EMBARGOS DE DECLARACAO": "ED",
  "EMBARGOS DE DIVERGENCIA": "E-Div",
  "EMBARGOS SDI": "E-SDI",
  "EMBARGOS EM RECURSO DE REVISTA": "E-RR",
  "MANDADO DE SEGURANCA": "MS",
  "MEDIDA CAUTELAR": "MC",
  "RECLAMACAO": "Rcl",
  "RECURSO DE REVISTA": "RR",
  "RECURSO DE REVISTA COM AGRAVO (ARR)": "AIRR",
  "RECURSO ESPECIAL": "REsp",
  "RECURSO EXTRAORDINARIO": "RE",
  "RECURSO ORDINARIO": "RO",
};

function classeJudicial(b: BennerRelatorio, processo?: ProcessoRelatorio): string {
  const processoClasse = txt(processo?.classe);
  if (processoClasse) return processoClasse;
  const valores = [b.tipo_recurso, b.tipo_recurso_reclamante, b.tipo_recurso_banco, b.tipo_recurso_terceiro]
    .flatMap((v) => txt(v).split(/\s*(?:\+|\|)\s*/))
    .filter(Boolean);
  return Array.from(new Set(valores.map((v) => CLASSES[norm(v)] || txt(v)))).join(" / ");
}

export function montarLinhaRelatorioDistribuicao(
  b: BennerRelatorio,
  partes: ParteRelatorio[] = [],
  processo?: ProcessoRelatorio,
  pub?: PublicacaoRelatorio,
): LinhaRelatorioDistribuicao {
  const orgao = montarOrgao(b, processo, pub);
  const polos = montarPolos(b, partes, processo, pub);
  const dataDistribuicao = b.data_distribuicao_real || b.data_distribuicao_planilha || b.data_distribuicao || "";
  const dataDjen = b.data_publicacao_djen || pub?.data_disponibilizacao || pub?.data_publicacao || "";
  return {
    processo: txt(b.processo),
    orgao,
    dataDistribuicao: formatarDataBr(dataDistribuicao),
    dataDjen: formatarDataBr(dataDjen),
    poloAtivo: polos.ativo,
    poloPassivo: polos.passivo,
    advogados: formatarAdvogados(b, partes, processo, pub),
    classe: classeJudicial(b, processo),
    tribunal: tribunalOrigemPeloCnj(txt(b.processo)) || txt(processo?.tribunal) || txt(pub?.tribunal) || txt(b.tribunal),
    classificacao: classificarOrgaoDistribuicao(orgao),
    ordemData: txt(dataDistribuicao).slice(0, 10),
  };
}

export function formulaClassificacao(row: number): string {
  return `IF(OR(ISNUMBER(SEARCH("Presidência",B${row})),ISNUMBER(SEARCH("Turma",B${row})),ISNUMBER(SEARCH("SETR2",B${row})),ISNUMBER(SEARCH("SBDI-II",B${row})),ISNUMBER(SEARCH("SDI-2",B${row}))),"DISTRIBUIÇÃO INICIAL","TRÂMITE INTERNO")`;
}

function clonarEstilo(estilo: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  return JSON.parse(JSON.stringify(estilo || {}));
}

/** Preenche o modelo original, preservando cabeçalho, estilos e a aba de instruções. */
export async function preencherModeloDistribuicao(
  workbook: ExcelJS.Workbook,
  linhas: LinhaRelatorioDistribuicao[],
): Promise<Blob> {
  const ws = workbook.getWorksheet("Modelo_Distribuicoes");
  if (!ws) throw new Error("O modelo não contém a aba Modelo_Distribuicoes.");
  if (!workbook.getWorksheet("Instruções_de_Preenchimento")) {
    throw new Error("O modelo não contém a aba Instruções_de_Preenchimento.");
  }

  const estilos = [2, 3].map((numero) => {
    const row = ws.getRow(Math.min(numero, ws.rowCount));
    return Array.from({ length: 10 }, (_, i) => clonarEstilo(row.getCell(i + 1).style));
  });
  // ExcelJS não remove o restante quando spliceRows começa antes do fim e
  // apaga todas as linhas restantes; remover de trás para frente evita que
  // qualquer processo de exemplo permaneça no relatório.
  for (let numero = ws.rowCount; numero >= 2; numero--) ws.spliceRows(numero, 1);

  linhas.forEach((linha, index) => {
    const numero = index + 2;
    const row = ws.getRow(numero);
    row.values = [
      linha.processo,
      linha.orgao,
      linha.dataDistribuicao,
      linha.dataDjen,
      linha.poloAtivo,
      linha.poloPassivo,
      linha.advogados,
      linha.classe,
      linha.tribunal,
      { formula: formulaClassificacao(numero), result: linha.classificacao },
    ];
    const estiloLinha = estilos[index % 2];
    for (let coluna = 1; coluna <= 10; coluna++) {
      row.getCell(coluna).style = clonarEstilo(estiloLinha[coluna - 1]);
    }
    row.commit();
  });

  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.modified = new Date();
  workbook.lastModifiedBy = "Juris Control";
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function chaveProcessoRelatorio(processo: unknown): string {
  return digits(processo);
}
