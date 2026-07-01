/**
 * Campos obrigatórios da aba Distribuição TST conforme especificação da
 * advogada Kellen (2026-06). Os nomes das chaves correspondem às colunas
 * em `dados_benner` (tabela fonte da Distribuição TST).
 *
 * Use `getPendencias(row)` para descobrir quais campos obrigatórios estão
 * vazios em um registro. Aceita tanto o objeto bruto de `dados_benner`
 * quanto o `DistribuicaoTst` mapeado (chaves equivalentes coexistem).
 */

export type CampoObrigatorio = {
  /** Chave em `dados_benner` (snake_case) usada na consulta SQL. */
  key: string;
  /** Chaves alternativas no objeto da UI (DistribuicaoTst). */
  aliases?: string[];
  /** Rótulo amigável exibido na tela / planilha. */
  label: string;
  /** Quadrinho (seção) do formulário. */
  quadrinho: string;
  /**
   * Quando definido, o campo só é cobrado se o predicado retornar `true`
   * para o registro inteiro (útil para "Data Julgamento → S abre demais").
   */
  requiredWhen?: (row: any) => boolean;
};

const eq = (v: any, ...alvos: string[]) => {
  const s = String(v ?? "").trim().toUpperCase();
  return alvos.some((a) => s === a.toUpperCase());
};

/** Helpers de leitura case-insensitive para o campo "Parte Recorrente". */
const parteRec = (row: any): string =>
  String(row?.parte_recorrente ?? row?.recorrente ?? "").trim().toUpperCase();

/** A parte recorrente envolve Reclamante? (também aceita "Reclamante e Reclamada") */
export const recorrenteEnvolveReclamante = (row: any): boolean => {
  const p = parteRec(row);
  return p.includes("RECLAMANTE");
};

/** A parte recorrente envolve Reclamada/Banco? */
export const recorrenteEnvolveBanco = (row: any): boolean => {
  const p = parteRec(row);
  // "Reclamada" ou "Reclamante e Reclamada"
  return /RECLAMAD/.test(p);
};

/** A parte recorrente é Terceiro? */
export const recorrenteEhTerceiro = (row: any): boolean => {
  return parteRec(row) === "TERCEIRO";
};

/** Mídia Negativa marcada como SIM? */
export const midiaNegativaSim = (row: any): boolean =>
  eq(row?.midia_negativa, "SIM", "S");

/** Tem data de julgamento marcada como SIM? */
export const temDataJulgamentoSim = (row: any): boolean =>
  eq(row?.tem_data_julgamento, "S", "SIM");

/** Igual a vazio: null / undefined / string vazia / só espaços. Booleans contam como preenchidos. */
export function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "boolean") return false;
  if (typeof v === "number") return Number.isNaN(v);
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === "";
}

export const CAMPOS_OBRIGATORIOS: CampoObrigatorio[] = [
  // Quadrinho I – Dados Básicos
  { key: "data_distribuicao_real", label: "Data Distribuição Real (D)", quadrinho: "I. Dados Básicos" },
  { key: "processo", aliases: ["processo_numero"], label: "Número do Processo", quadrinho: "I. Dados Básicos" },
  { key: "dossie", label: "Dossiê (A)", quadrinho: "I. Dados Básicos" },
  { key: "tribunal", label: "Tribunal (B)", quadrinho: "I. Dados Básicos" },
  { key: "equipe", label: "Equipe", quadrinho: "I. Dados Básicos" },
  { key: "reclamante", label: "Reclamante", quadrinho: "I. Dados Básicos" },
  { key: "reclamada", label: "Reclamada", quadrinho: "I. Dados Básicos" },

  // Quadrinho II – Relator e Turma
  { key: "relator", label: "Relator (F)", quadrinho: "II. Relator e Turma" },
  { key: "turma", label: "Turma (E)", quadrinho: "II. Relator e Turma" },
  { key: "recorrente", aliases: ["parte_recorrente"], label: "Parte Recorrente (AA)", quadrinho: "II. Relator e Turma" },

  // Quadrinho III – Recurso do Reclamante
  // Só cobrados quando o Reclamante figura como Parte Recorrente.
  { key: "tipo_recurso_reclamante", label: "Tipo de Recurso do Reclamante (C)", quadrinho: "III. Recurso do Reclamante", requiredWhen: recorrenteEnvolveReclamante },
  { key: "materias_recurso_reclamante", label: "Matérias Recurso Reclamante", quadrinho: "III. Recurso do Reclamante", requiredWhen: recorrenteEnvolveReclamante },
  { key: "tem_chance_exito_reclamante", label: "Tem chance de êxito (Reclamante)?", quadrinho: "III. Recurso do Reclamante", requiredWhen: recorrenteEnvolveReclamante },

  // Quadrinho IV – Recurso do Reclamado/Banco
  // Só cobrados quando a Reclamada (banco) figura como Parte Recorrente.
  { key: "tipo_recurso_banco", label: "Tipo de Recurso do Banco (C)", quadrinho: "IV. Recurso do Banco", requiredWhen: recorrenteEnvolveBanco },
  { key: "materias_recurso_banco", label: "Matérias Recurso do Banco", quadrinho: "IV. Recurso do Banco", requiredWhen: recorrenteEnvolveBanco },

  // Quadrinho V – Recurso Terceiro (só quando Parte Recorrente = Terceiro)
  { key: "tipo_recurso_terceiro", label: "Tipo de Recurso (Terceiro) (C)", quadrinho: "V. Recurso Terceiro", requiredWhen: recorrenteEhTerceiro },
  { key: "tem_chance_exito_terceiro", label: "Tem chance de êxito (Terceiro)?", quadrinho: "V. Recurso Terceiro", requiredWhen: recorrenteEhTerceiro },

  // Quadrinho VI – Análise
  { key: "honra", label: "Matéria de Honra (O)", quadrinho: "VI. Análise" },
  { key: "midia_negativa", label: "Mídia Negativa (H)", quadrinho: "VI. Análise" },
  {
    key: "risco_nivel",
    label: "Risco — Nível (ALTO/MÉDIO/BAIXO)",
    quadrinho: "VI. Análise",
    requiredWhen: midiaNegativaSim,
  },
  {
    key: "risco_descricao",
    label: "Risco (descrição) (I)",
    quadrinho: "VI. Análise",
    // Cobrado apenas quando há Mídia Negativa = SIM.
    requiredWhen: midiaNegativaSim,
  },
  { key: "recurso_terceiros", label: "Recurso de Terceiros", quadrinho: "VI. Análise" },
  { key: "decisao_quarteirizado", label: "Decisão - Análise do Quarteirizado (G)", quadrinho: "VI. Análise" },
  { key: "provas_digitais", label: "Provas Digitais (J)", quadrinho: "VI. Análise" },

  // Quadrinho VII – Julgamento
  {
    key: "data_julgamento",
    label: "Data Julgamento (L)",
    quadrinho: "VII. Julgamento",
    requiredWhen: temDataJulgamentoSim,
  },
  {
    key: "horario_julgamento",
    label: "Horário (M)",
    quadrinho: "VII. Julgamento",
    requiredWhen: temDataJulgamentoSim,
  },
  {
    key: "tipo_julgamento",
    label: "Tipo Julgamento (N)",
    quadrinho: "VII. Julgamento",
    requiredWhen: temDataJulgamentoSim,
  },

  // Quadrinho VIII – Fechamento
  { key: "processo_baixado", label: "Processo Baixado (Z)", quadrinho: "VIII. Fechamento" },
];

/** Conjunto de chaves obrigatórias para asterisco no formulário. */
export const CHAVES_OBRIGATORIAS = new Set<string>(
  CAMPOS_OBRIGATORIOS.flatMap((c) => [c.key, ...(c.aliases || [])]),
);

/** Colunas a selecionar em `dados_benner` para checar pendências. */
export const COLUNAS_SELECT_PENDENCIAS = Array.from(
  new Set(CAMPOS_OBRIGATORIOS.map((c) => c.key)),
);

function getValor(row: any, c: CampoObrigatorio): any {
  if (row == null) return null;
  const tentativas = [c.key, ...(c.aliases || [])];
  for (const k of tentativas) {
    if (row[k] !== undefined) return row[k];
  }
  return null;
}

export type Pendencia = { key: string; label: string; quadrinho: string };

/** Verifica pendências na lista de "Análise por matéria" (JSONB). Cada matéria
 *  selecionada exige aparelhamento, chance_turma, chance_relator e chance_exito. */
function pendenciasMateriasAnalise(
  row: any,
  campoJsonb: string,
  rotuloBloco: string,
  quadrinho: string,
): Pendencia[] {
  const lista = row?.[campoJsonb];
  if (!Array.isArray(lista) || lista.length === 0) return [];
  const out: Pendencia[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object" || !item.materia) continue;
    const m = String(item.materia).trim();
    if (isEmpty(item.aparelhamento)) out.push({ key: `${campoJsonb}.aparelhamento.${m}`, label: `${rotuloBloco} • "${m}": Aparelhamento`, quadrinho });
    if (isEmpty(item.chance_turma)) out.push({ key: `${campoJsonb}.chance_turma.${m}`, label: `${rotuloBloco} • "${m}": Chance Turma`, quadrinho });
    if (isEmpty(item.chance_relator)) out.push({ key: `${campoJsonb}.chance_relator.${m}`, label: `${rotuloBloco} • "${m}": Chance Relator`, quadrinho });
    if (isEmpty(item.chance_exito)) out.push({ key: `${campoJsonb}.chance_exito.${m}`, label: `${rotuloBloco} • "${m}": Êxito`, quadrinho });
  }
  return out;
}

/** Retorna a lista de campos obrigatórios em aberto para `row`. */
export function getPendencias(row: any): Pendencia[] {
  if (!row) return [];
  const out: Pendencia[] = [];
  for (const c of CAMPOS_OBRIGATORIOS) {
    if (c.requiredWhen && !c.requiredWhen(row)) continue;
    const v = getValor(row, c);
    if (isEmpty(v)) out.push({ key: c.key, label: c.label, quadrinho: c.quadrinho });
  }
  // Pendências dinâmicas: para cada matéria selecionada nos quadros de recurso,
  // exigir Aparelhamento + Chance Turma + Chance Relator + Êxito.
  // Só cobrar sub-itens quando a parte figura como recorrente (mesma regra dos
  // campos de tipo/matéria/êxito do bloco correspondente).
  if (recorrenteEnvolveReclamante(row)) {
    out.push(...pendenciasMateriasAnalise(row, "materias_analise_reclamante", "Análise Reclamante", "III. Recurso do Reclamante"));
  }
  if (recorrenteEnvolveBanco(row)) {
    out.push(...pendenciasMateriasAnalise(row, "materias_analise_banco", "Análise Banco", "IV. Recurso do Banco"));
  }
  if (recorrenteEhTerceiro(row)) {
    out.push(...pendenciasMateriasAnalise(row, "materias_analise_terceiro", "Análise Terceiro", "V. Recurso Terceiro"));
  }
  return out;
}

/** Versão resumida em string única para Excel/UI compacta. */
export function pendenciasResumo(row: any, sep = "; "): string {
  return getPendencias(row).map((p) => p.label).join(sep);
}