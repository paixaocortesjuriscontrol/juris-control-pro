import type { Complementos } from "./projurisComplementos";

export const SISTEMAS_JUDICIAIS = [
  "Eproc", "Esaj", "Projudi", "PJE", "Portal de Serviços", "Portal do Advogado",
  "JPE", "Próprio Site", "Tucujuris", "SEI",
];

const norm = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const txt = (v: unknown) => String(v ?? "").trim();

/** Ajusta grafias da planilha (ex.: "Portal do Adv", "Jpe", "ESAJ") à lista oficial. */
export function normalizarSistemaJudicial(v: unknown): string {
  const k = norm(v);
  if (!k) return "";
  if (k.startsWith("portal do adv")) return "Portal do Advogado";
  if (k.startsWith("portal de serv")) return "Portal de Serviços";
  return SISTEMAS_JUDICIAIS.find((s) => norm(s) === k) ?? txt(v);
}

const UFS: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF",
  "espirito santo": "ES", goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI",
  "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO",
  roraima: "RR", "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

function dataIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = txt(v);
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = txt(v).replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** Converte uma linha da planilha "Processos em planilha" do Projuris em complementos. */
export function complementosPlanilhaProcessos(r: Record<string, unknown>): Complementos {
  const out: Complementos = {};
  const set = (campo: string, v: unknown) => { const s = txt(v); if (s) out[campo] = s; };
  set("identificador_projuris", r["Identificador"]);
  set("assunto", r["Assunto"]);
  set("descricao", r["Descrição"]);
  set("pasta_fisica", r["Pasta física"]);
  set("pasta_cliente", r["Pasta cliente"]);
  set("situacao_original", r["Situação"]);
  set("instancia", r["Instância"]);
  set("justica", r["Justiça"]);
  set("orgao_julgador", r["Órgao"] ?? r["Órgão"]);
  set("comarca", r["Cidade"]);
  set("fase", r["Fase"]);
  set("classe", r["Classe CNJ"]);
  set("probabilidade", r["Probabilidade"]);
  set("polo_ativo", r["Partes ativas"]);
  set("polo_passivo", r["Partes passivas"]);
  set("responsaveis_projuris", r["Responsáveis"]);
  const uf = UFS[norm(r["Estado"])]; if (uf) out.uf = uf;
  const area = ({ civel: "civil", civil: "civil", trabalhista: "trabalhista", "direito privado": "direito_privado", empresarial: "empresarial" } as Record<string, string>)[norm(r["Área"])];
  if (area) out.area = area;
  const sistema = normalizarSistemaJudicial(r["Sistema Judicial"]) || normalizarSistemaJudicial(r["Sistema"]);
  if (sistema) out.sistema = sistema;
  const seg = norm(r["Segredo de justiça"]);
  if (seg === "sim") out.segredo_justica = true; else if (seg === "nao") out.segredo_justica = false;
  const dist = dataIso(r["Data distribuição"]); if (dist) out.data_distribuicao = dist;
  const vc = numero(r["Valor ação"]); if (vc && vc > 0) out.valor_causa = vc;
  const vp = numero(r["Valor provisionado"]); if (vp && vp > 0) out.valor_provisionado = vp;
  const notas = [
    ["Marcadores", r["Marcadores"]], ["Numeração complementar", r["Numeração complementar"]],
    ["Processos relacionados", r["Processos relacionados"]], ["Comentários", r["Comentários"]],
    ["Últimos andamentos", [txt(r["Data dos últimos andamentos"]), txt(r["Tipo dos últimos andamentos"]), txt(r["Descrição dos últimos andamentos"])].filter(Boolean).join(" — ")],
  ].filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${txt(v)}`);
  if (notas.length) out.observacoes_processo = ["Informações complementares do Projuris:", ...notas].join("\n");
  return out;
}

/** Agrupa por CNJ (20 dígitos); CNJs com linhas divergentes são marcados como ambíguos. */
export function fontesPlanilhaProcessos(linhas: Record<string, unknown>[]) {
  const porCnj = new Map<string, { cd: string; campos: Complementos }[]>();
  let semCnj = 0;
  for (const r of linhas) {
    const cnj = txt(r["Número CNJ"]).replace(/\D/g, "");
    if (cnj.length !== 20) { semCnj++; continue; }
    const campos = complementosPlanilhaProcessos(r);
    const lista = porCnj.get(cnj) ?? [];
    if (!lista.some((x) => JSON.stringify(x.campos) === JSON.stringify(campos))) lista.push({ cd: txt(r["Identificador"]) || cnj, campos });
    porCnj.set(cnj, lista);
  }
  const fontes: { cd: string; cnj: string; campos: Complementos }[] = [];
  let ambiguos = 0;
  for (const [cnj, lista] of porCnj) {
    if (lista.length === 1) fontes.push({ cnj, ...lista[0] }); else ambiguos++;
  }
  return { fontes, ambiguos, semCnj };
}
