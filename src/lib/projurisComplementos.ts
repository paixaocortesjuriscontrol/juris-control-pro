export type Complemento = string | number | boolean;
export type Complementos = Record<string, Complemento>;
export const COLUNAS_COMPLEMENTOS_PROJURIS = [
  "deidentificador", "dtcitacao", "dtrecebimento", "dtarquivamento", "vlprovisionado", "vlcondenacao",
  "dtencerramento", "dttransitojulgado", "deencerramento", "nmsistema", "flprobabilidade", "flresultado",
  "cdareaprocesso", "cdcidade", "cdestado", "cdfaseprocesso", "cdprocessojustica", "cdprocessovaranumero", "cdprocessovaratipo",
  "cdsituacaoprocesso", "cdclasse", "cdprocessoorgaojudicial", "cdunidadeorganizacionalatual",
];

const texto = (v: unknown) => String(v ?? "").trim();
export const vazioComplemento = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());

export function complementosProjuris(origem: Record<string, unknown>): Complementos {
  const out: Complementos = {};
  for (const [coluna, campo] of Object.entries({ descricao: "descricao", nmassunto: "assunto", nmpasta: "pasta_fisica", nmpastacliente: "pasta_cliente", deidentificador: "identificador_projuris", nmsistema: "sistema", flprobabilidade: "probabilidade", flresultado: "resultado" })) {
    const valor = texto(origem[coluna]);
    if (valor) out[campo] = valor;
  }
  // Descrição e observações são preservadas integralmente, inclusive em fichas já existentes.
  if (out.descricao) out.observacoes_processo = out.descricao;
  for (const [coluna, campo] of Object.entries({ dtdistribuicao: "data_distribuicao", dtcitacao: "data_citacao", dtrecebimento: "data_recebimento", dtarquivamento: "data_arquivamento", dtencerramento: "data_encerramento" })) {
    const valor = texto(origem[coluna]);
    const iso = valor.match(/^(\d{4}-\d{2}-\d{2})(?:$|[ T])/ )?.[1];
    if (iso && !Number.isNaN(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso) out[campo] = iso;
  }
  for (const [coluna, campo] of Object.entries({ vlacao: "valor_causa", vlprovisionado: "valor_provisionado", vlcondenacao: "valor_condenacao" })) {
    const valor = texto(origem[coluna]);
    if (/^-?\d+(?:\.\d+)?$/.test(valor) && Number.isFinite(Number(valor))) out[campo] = Number(valor);
  }
  const instancia = { PRIMEIRA_INSTANCIA: "Primeira instância", SEGUNDA_INSTANCIA: "Segunda instância", TERCEIRA_INSTANCIA: "Terceira instância" }[texto(origem.flprocessoinstancia)];
  if (instancia) out.instancia = instancia;
  if (["S", "N"].includes(texto(origem.flsegredojustica))) out.segredo_justica = texto(origem.flsegredojustica) === "S";
  return out;
}

export function selecionarComplementos(atual: Record<string, unknown>, origem: Complementos) {
  const preencher: Complementos = {};
  const conflitos: Complementos = {};
  for (const [campo, valor] of Object.entries(origem)) {
    if (vazioComplemento(atual[campo])) preencher[campo] = valor;
    else if (String(atual[campo]).trim() !== String(valor).trim()) conflitos[campo] = valor;
  }
  return { preencher, conflitos };
}

export function fontesComplementosUnicas(rows: Record<string, unknown>[], numeros: Record<string, unknown>[], enriquecer?: (row: Record<string, unknown>) => Complementos) {
  const nums = new Map<string, Set<string>>();
  for (const row of numeros) {
    if (texto(row.flativo).toUpperCase() !== "S") continue;
    const cnj = texto(row.denumeroprocesso).replace(/\D/g, "");
    if (cnj.length !== 20) continue;
    const cd = texto(row.cdprocesso);
    const set = nums.get(cd) ?? new Set<string>(); set.add(cnj); nums.set(cd, set);
  }
  const porNumero = new Map<string, { cd: string; campos: Complementos }[]>();
  for (const row of rows) {
    if (texto(row.flativo).toUpperCase() !== "S" || texto(row.flexclusaotipo)) continue;
    const cd = texto(row.cdprocesso); const ns = nums.get(cd);
    if (!ns || ns.size !== 1) continue;
    const cnj = Array.from(ns)[0]; if (!cnj) continue;
    const campos = enriquecer ? enriquecer(row) : complementosProjuris(row);
    if (!Object.keys(campos).length) continue;
    const list = porNumero.get(cnj) ?? [];
    if (!list.some(x => x.cd === cd && JSON.stringify(x.campos) === JSON.stringify(campos))) list.push({ cd, campos });
    porNumero.set(cnj, list);
  }
  const fontes = Array.from(porNumero.entries()).flatMap(([cnj, list]) => list.length === 1 ? [{ cnj, ...list[0] }] : []);
  return { fontes, ambiguos: Array.from(porNumero.values()).filter(x => x.length > 1).length };
}