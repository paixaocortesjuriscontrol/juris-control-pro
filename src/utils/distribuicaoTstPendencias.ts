/**
 * Campos obrigatórios da aba Distribuição TST conforme especificação da
 * advogada Kellen (2026-06). Os nomes das chaves correspondem às colunas
 * em `dados_benner` (tabela fonte da Distribuição TST).
 *
 * Use `getPendencias(row)` para descobrir quais campos obrigatórios estão
 * vazios em um registro. Aceita tanto o objeto bruto de `dados_benner`
 * quanto o `DistribuicaoTst` mapeado (chaves equivalentes coexistem).
 */

import { aplicarRegraOutraMateria, isOutraMateria } from "./outraMateria";
import { isMateriaOficialSync } from "./materiasOficiaisCache";
import { getRecursosForaDaLista } from "./tipoRecursoOficial";
import { getMotivoRejeicaoDossie } from "./dossieBenner";



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
const parteRec = (row: any): string => {
  const bruto = [row?.parte_recorrente, row?.recorrente].find(
    (v) => v !== null && v !== undefined && String(v).trim() !== "",
  );
  return String(bruto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
};

export type ParteRecorrenteInfo = {
  reclamante: boolean;
  banco: boolean;
  terceiro: boolean;
  /** `true` quando a seleção identifica ao menos uma parte recorrente válida. */
  valida: boolean;
};

/**
 * Interpreta o campo "Parte Recorrente" e diz quais quadros de recurso ficam
 * obrigatórios. Valores herdados de importações/Judit que não identificam a
 * parte (ex.: "-----", "Ativo: BANCO SANTANDER ... Passivo: ...") são tratados
 * como NÃO selecionados — a advogada precisa escolher a parte.
 */
export function parseParteRecorrente(row: any): ParteRecorrenteInfo {
  const s = parteRec(row);
  const vazio = { reclamante: false, banco: false, terceiro: false, valida: false };
  if (!s || /^[-–—\s.]+$/.test(s)) return vazio;
  // Texto de capa da Judit (lista de partes) não é seleção de parte recorrente.
  if (/ATIVO\s*:|PASSIVO\s*:/.test(s) || s.length > 60) return vazio;
  const ambos = /\bAMBOS\b/.test(s);
  const reclamante = ambos || /\bRECLAMANTE\b/.test(s);
  const banco = ambos || /RECLAMAD[AO]?\b/.test(s) || /\bBANCO\b/.test(s);
  const terceiro = /\bTERCEIRO?S?\b/.test(s);
  return { reclamante, banco, terceiro, valida: reclamante || banco || terceiro };
}

/** A parte recorrente envolve Reclamante? (também aceita "Reclamante e Reclamada") */
export const recorrenteEnvolveReclamante = (row: any): boolean =>
  parseParteRecorrente(row).reclamante;

/** A parte recorrente envolve Reclamada/Banco? */
export const recorrenteEnvolveBanco = (row: any): boolean =>
  parseParteRecorrente(row).banco;

/** A parte recorrente envolve Terceiro? */
export const recorrenteEhTerceiro = (row: any): boolean =>
  parseParteRecorrente(row).terceiro;

/** Terceiro é a ÚNICA parte recorrente (isenta o preenchimento dos demais quadros). */
export const recorrenteSomenteTerceiro = (row: any): boolean => {
  const p = parseParteRecorrente(row);
  return p.terceiro && !p.reclamante && !p.banco;
};

/** A parte recorrente foi selecionada de forma válida? */
export const parteRecorrenteSelecionada = (row: any): boolean =>
  parseParteRecorrente(row).valida;


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
  new Set([...CAMPOS_OBRIGATORIOS.map((c) => c.key), "tipo_recurso"]),
);

/**
 * Conjunto COMPLETO de colunas necessário para reproduzir o card
 * "Pronto sem pendência". Inclui os campos de isenção — sem eles
 * `getPendencias` acusa pendências inexistentes.
 */
export const COLUNAS_SELECT_PRONTO_SEM_PENDENCIA = Array.from(
  new Set([
    "id",
    "status",
    "acordo",
    "cejusc",
    "processo_outro_escritorio",
    "segredo_justica",
    "transito_julgado",
    "recurso_terceiro",
    "recurso_terceiros",
    "recorrente",
    "midia_negativa",
    "tem_data_julgamento",
    "materias_analise_reclamante",
    "materias_analise_banco",
    // Sem estas duas colunas o card ignorava as pendências de "Análise
    // Terceiro" (Aparelhamento / Chance Turma / Chance Relator / Êxito) que
    // a lista exibe — gerando divergência entre o contador e a listagem.
    "materias_recurso_terceiro",
    // Campo genérico de recurso (usado por importações/Judit). Sem ele a
    // validação "tipo de recurso fora da lista oficial" não enxergava os
    // valores inventados gravados aqui — o processo aparecia como pronto sem
    // pendência e só era rejeitado na hora de gerar a Carga Benner.
    "tipo_recurso",
    ...COLUNAS_SELECT_PENDENCIAS,
  ]),
);

/**
 * Processos em outro escritório, sob segredo de justiça ou CEJUSC não são
 * contabilizados (nem com pendência, nem sem) — mesma regra do botão
 * "Verificar Pendências".
 */
/**
 * Situações que rejeitam a linha na Carga Benner (mesmo em seleção manual).
 * Retorna o rótulo do motivo ou `null`.
 */
export function getSituacaoImpeditiva(row: any): string | null {
  if (row?.transito_julgado === true) return "Trânsito em julgado";
  if (row?.processo_outro_escritorio === true) return "Processo em outro escritório";
  if (row?.segredo_justica === true) return "Segredo de justiça";
  if (row?.cejusc === true) return "CEJUSC";
  if (row?.acordo === true) return "Acordo";
  return null;
}

/** O processo já foi marcado como pronto para enviar (ou planilhado/enviado)? */
export function isMarcadoPronto(row: any): boolean {
  const st = String(row?.status ?? "").trim();
  return (
    row?.pronto_envio === true ||
    st === "pronto_envio" ||
    st === "planilhado" ||
    st === "enviado"
  );
}

export function isNaoPrecisaFazer(row: any): boolean {
  return (
    row?.processo_outro_escritorio === true ||
    row?.segredo_justica === true ||
    row?.cejusc === true
  );
}

function getValor(row: any, c: CampoObrigatorio): any {
  if (row == null) return null;
  const tentativas = [c.key, ...(c.aliases || [])];
  for (const k of tentativas) {
    if (row[k] !== undefined) return row[k];
  }
  return null;
}

export type Pendencia = {
  key: string;
  label: string;
  quadrinho: string;
  /**
   * Rótulo do campo do formulário que deve ser destacado quando o `label` da
   * pendência é um texto explicativo longo (ex.: tipo de recurso fora da lista).
   */
  alvoLabel?: string;
  /**
   * Quando `true`, o item é apenas um AVISO ("Verificar", em amarelo): aparece
   * no botão "Verificar Pendências" mas NÃO conta como pendência e não bloqueia
   * o envio. Hoje é usado quando "Outra Matéria" é a única matéria selecionada.
   */
  aviso?: boolean;
};


/** Nomes das matérias selecionadas de um bloco (string de matérias + JSONB). */
function materiasSelecionadasDe(
  row: any,
  campoJsonb: string,
  campoMaterias: string,
): any[] {
  const listaPersistida = Array.isArray(row?.[campoJsonb]) ? row[campoJsonb] : [];
  const materiasSelecionadas = String(row?.[campoMaterias] || "")
    .split(/;|\n/)
    .map((materia) => materia.trim())
    .filter(Boolean);
  const porMateria = new Map<string, any>();
  for (const item of listaPersistida) {
    if (!item || typeof item !== "object" || !item.materia) continue;
    porMateria.set(String(item.materia).trim().toLocaleLowerCase("pt-BR"), item);
  }
  return materiasSelecionadas.length > 0
    ? materiasSelecionadas.map((materia) => ({
        ...(porMateria.get(materia.toLocaleLowerCase("pt-BR")) || {}),
        materia,
      }))
    : listaPersistida;
}

/** Verifica pendências na lista de "Análise por matéria" (JSONB). Cada matéria
 *  selecionada exige aparelhamento, chance_turma, chance_relator e chance_exito. */
function pendenciasMateriasAnalise(
  row: any,
  campoJsonb: string,
  campoMaterias: string,
  rotuloBloco: string,
  quadrinho: string,
): Pendencia[] {
  const lista = materiasSelecionadasDe(row, campoJsonb, campoMaterias);
  if (lista.length === 0) return [];

  const out: Pendencia[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object" || !item.materia) continue;
    // "Outra Matéria" é neutra: nunca gera pendência nem aviso.
    if (isOutraMateria(item.materia)) continue;
    const m = String(item.materia).trim();
    if (isEmpty(item.aparelhamento)) out.push({ key: `${campoJsonb}.aparelhamento.${m}`, label: `${rotuloBloco} • "${m}": Aparelhamento`, quadrinho });
    if (isEmpty(item.chance_turma)) out.push({ key: `${campoJsonb}.chance_turma.${m}`, label: `${rotuloBloco} • "${m}": Chance Turma`, quadrinho });
    if (isEmpty(item.chance_relator)) out.push({ key: `${campoJsonb}.chance_relator.${m}`, label: `${rotuloBloco} • "${m}": Chance Relator`, quadrinho });
    if (isEmpty(item.chance_exito)) out.push({ key: `${campoJsonb}.chance_exito.${m}`, label: `${rotuloBloco} • "${m}": Êxito`, quadrinho });
  }
  return out;
}

/**
 * Lista completa de itens em aberto, incluindo os apenas informativos
 * (`aviso: true`). Use em telas que queiram destacar "Verificar" em amarelo.
 */
export function getPendenciasEAvisos(row: any): Pendencia[] {
  if (!row) return [];
  // Situações em que o processo não exige preenchimento: Acordo, CEJUSC,
  // Processo em outro escritório, Segredo de Justiça, Trânsito em Julgado
  // ou quando o Terceiro é a única parte recorrente.
  // Atenção: "Recurso de Terceiros = SIM" NÃO isenta o preenchimento — é
  // apenas um campo de análise; isentar marcava como "sem pendência"
  // processos com o formulário em branco.
  // Nesses casos "Verificar Pendências" e o Relatório de Pendências devem
  // reportar Sem pendências mesmo que existam campos vazios.
  // Exceção: quando o processo já está marcado como PRONTO PARA ENVIAR, essas
  // mesmas situações rejeitam a linha na Carga Benner. Nesse caso precisam
  // aparecer como pendência na tela (regra: tudo que rejeita na planilha tem
  // que ser visível antes).
  const bloqueio = getSituacaoImpeditiva(row);
  if (bloqueio) {
    if (isMarcadoPronto(row)) {
      return [
        {
          key: "situacao_impeditiva",
          label: `${bloqueio} — NÃO irá para a planilha de Carga Benner`,
          alvoLabel: bloqueio,
          quadrinho: "I. Dados Básicos",
        },
      ];
    }
    return [];
  }
  if (recorrenteSomenteTerceiro(row)) return [];
  const out: Pendencia[] = [];
  for (const c of CAMPOS_OBRIGATORIOS) {
    if (c.requiredWhen && !c.requiredWhen(row)) continue;
    const v = getValor(row, c);
    if (isEmpty(v)) out.push({ key: c.key, label: c.label, quadrinho: c.quadrinho });
  }
  // "Parte Recorrente" é sempre obrigatória e precisa identificar a parte:
  // valores herdados ("-----", lista de partes da Judit) não valem como seleção.
  if (!parteRecorrenteSelecionada(row) && !out.some((p) => p.key === "recorrente")) {
    out.push({
      key: "recorrente",
      label: "Parte Recorrente (AA)",
      quadrinho: "II. Relator e Turma",
    });
  }

  // Pendências dinâmicas: para cada matéria selecionada nos quadros de recurso,
  // exigir Aparelhamento + Chance Turma + Chance Relator + Êxito.
  // Só cobrar sub-itens quando a parte figura como recorrente (mesma regra dos
  // campos de tipo/matéria/êxito do bloco correspondente).
  if (recorrenteEnvolveReclamante(row)) {
    out.push(...pendenciasMateriasAnalise(row, "materias_analise_reclamante", "materias_recurso_reclamante", "Análise Reclamante", "III. Recurso do Reclamante"));
  }
  if (recorrenteEnvolveBanco(row)) {
    out.push(...pendenciasMateriasAnalise(row, "materias_analise_banco", "materias_recurso_banco", "Análise Banco", "IV. Recurso do Banco"));
  }
  if (recorrenteEhTerceiro(row)) {
    out.push(...pendenciasMateriasAnalise(row, "materias_analise_terceiro", "materias_recurso_terceiro", "Análise Terceiro", "V. Recurso Terceiro"));
  }

  // Regra: se TODAS as matérias selecionadas (Reclamante / Reclamada / Terceiro)
  // estiverem fora da lista oficial de pedidos, o processo tem pendência —
  // é o mesmo critério que rejeita a linha na Carga Benner.
  const fora = getMateriasForaDaLista(row);
  if (fora.total > 0 && fora.validas === 0) {
    out.push({
      key: "materias_fora_lista_oficial",
      label:
        "Matérias fora da lista oficial de pedidos — NÃO irá para a planilha de Carga Benner: " +
        fora.resumo,
      quadrinho: "III. Recurso do Reclamante",
    });
  } else if (fora.total > 0) {
    out.push({
      key: "materias_fora_lista_oficial_parcial",
      aviso: true,
      label:
        "Matérias fora da lista oficial (não serão exportadas na Carga Benner): " + fora.resumo,
      quadrinho: "III. Recurso do Reclamante",
    });
  }

  // Regra: tipo de recurso preenchido com valor fora da lista oficial de
  // seleção (típico de preenchimento automático inventado pela Judit) rejeita
  // a linha na Carga Benner — então precisa aparecer como pendência na lista.
  const recursosFora = getRecursosForaDaLista(row);
  if (recursosFora.length > 0) {
    const amostra = recursosFora
      .slice(0, 3)
      .map((r) => `${r.campo}: "${r.valor}"`)
      .join("; ");
    const resto = recursosFora.length > 3 ? ` (+${recursosFora.length - 3})` : "";
    out.push({
      key: "tipo_recurso_fora_lista_oficial",
      label:
        "Tipo de recurso fora da lista oficial de seleção — NÃO irá para a planilha de Carga Benner: " +
        amostra +
        resto,
      alvoLabel: QUADRO_POR_CAMPO_RECURSO[recursosFora[0].campo]?.alvoLabel,
      quadrinho:
        QUADRO_POR_CAMPO_RECURSO[recursosFora[0].campo]?.quadrinho ||
        "III. Recurso do Reclamante",
    });
  }

  // Regra: dossiê fora do padrão também rejeita a linha na Carga Benner.
  // (Dossiê vazio já é cobrado pelos campos obrigatórios.)
  const dossieRaw = String(row?.dossie ?? "").trim();
  if (dossieRaw) {
    const motivoDossie = getMotivoRejeicaoDossie(
      dossieRaw,
      row?.processo ?? row?.processo_numero,
    );
    if (motivoDossie) {
      out.push({
        key: "dossie_formato_invalido",
        label:
          `${motivoDossie} — NÃO irá para a planilha de Carga Benner`,
        alvoLabel: "Dossiê (A)",
        quadrinho: "I. Dados Básicos",
      });
    }
  }
  return out;
}

/** Quadro/rótulo do formulário para cada campo de recurso inválido. */
const QUADRO_POR_CAMPO_RECURSO: Record<
  string,
  { quadrinho: string; alvoLabel: string }
> = {
  "Tipo de Recurso": {
    quadrinho: "III. Recurso do Reclamante",
    alvoLabel: "Tipo de Recurso do Reclamante (C)",
  },
  "Recurso do Reclamante": {
    quadrinho: "III. Recurso do Reclamante",
    alvoLabel: "Tipo de Recurso do Reclamante (C)",
  },
  "Recurso do Banco": {
    quadrinho: "IV. Recurso do Banco",
    alvoLabel: "Tipo de Recurso do Banco (C)",
  },
  "Recurso de Terceiro": {
    quadrinho: "V. Recurso Terceiro",
    alvoLabel: "Tipo de Recurso (Terceiro) (C)",
  },
};



export type MateriasForaDaLista = {
  reclamante: string[];
  banco: string[];
  terceiro: string[];
  /** Quantidade de matérias fora da lista oficial. */
  total: number;
  /** Quantidade de matérias que estão na lista oficial. */
  validas: number;
  /** Resumo textual por parte, para exibição. */
  resumo: string;
};

/**
 * Matérias selecionadas que NÃO constam na lista oficial de pedidos
 * (inclui "Outra Matéria"), separadas por parte — mesmo critério aplicado
 * na geração da planilha de Carga Benner.
 */
export function getMateriasForaDaLista(row: any): MateriasForaDaLista {
  const blocos: Array<[keyof MateriasForaDaLista, string, string, string]> = [
    ["reclamante", "materias_analise_reclamante", "materias_recurso_reclamante", "Reclamante"],
    ["banco", "materias_analise_banco", "materias_recurso_banco", "Reclamada (Banco)"],
    ["terceiro", "materias_analise_terceiro", "materias_recurso_terceiro", "Terceiro"],
  ];
  const res: MateriasForaDaLista = {
    reclamante: [],
    banco: [],
    terceiro: [],
    total: 0,
    validas: 0,
    resumo: "",
  };
  const partes: string[] = [];
  for (const [chave, campoJsonb, campoMaterias, rotulo] of blocos) {
    const itens = materiasSelecionadasDe(row, campoJsonb, campoMaterias).filter(
      (i: any) => i && i.materia && String(i.materia).trim(),
    );
    const foraBloco: string[] = [];
    for (const i of itens) {
      const nome = String(i.materia).trim();
      if (isMateriaOficialSync(nome)) res.validas++;
      else foraBloco.push(nome);
    }
    (res[chave] as string[]) = foraBloco;
    res.total += foraBloco.length;
    if (foraBloco.length > 0) partes.push(`${rotulo}: ${foraBloco.join(", ")}`);
  }
  res.resumo = partes.join(" | ");
  return res;
}



/** Retorna a lista de campos obrigatórios em aberto (sem os avisos). */
export function getPendencias(row: any): Pendencia[] {
  return getPendenciasEAvisos(row).filter((p) => !p.aviso);
}

/** Apenas os avisos ("Verificar", amarelo) — não contam como pendência. */
export function getAvisos(row: any): Pendencia[] {
  return getPendenciasEAvisos(row).filter((p) => p.aviso);
}

/** Versão resumida em string única para Excel/UI compacta. */
export function pendenciasResumo(row: any, sep = "; "): string {
  return getPendencias(row).map((p) => p.label).join(sep);
}