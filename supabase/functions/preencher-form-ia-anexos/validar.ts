// Camada 4 — Validação programática + normalizações determinísticas.
// Executa APÓS o LLM e ANTES de devolver ao cliente.
//
// Responsabilidades:
//   1. Normalizar formatos (datas DD/MM/AAAA, horários HH:MM, S/N upper).
//   2. Verificar enums fechados; descartar valores fora do enum.
//   3. Verificar coerência K↔L (se há data de julgamento, K deve ser "S").
//   4. Garantir que campos da Judit não foram reescritos pelo LLM
//      (se divergiram, sobrescreve com o valor literal da Judit).
//   5. Marcar campos de baixa confiança / sem evidência como pendentes.
//   6. Acumular alertas legíveis por humano.

export type Confianca = "alta" | "media" | "baixa";

export interface DadosJudit {
  dossie?: string | null;
  tribunal?: string | null;
  tipo_recurso?: string | null;
  data_distribuicao?: string | null;
  turma?: string | null;
  relator?: string | null;
  recorrentes?: string[] | null;
  situacao_processo?: string | null;
  processo_baixado?: string | null;
}

export interface ExtracaoIA {
  // Campos do form Distribuição TST
  distribuicao_tst?: Record<string, any>;
  // Campos do form Dados Benner
  dados_benner?: Record<string, any>;
  // Metadados
  _evidencias?: Record<string, { trecho?: string; documento_id?: string | null }>;
  _confianca?: Record<string, Confianca>;
  _alertas?: string[];
  _campos_pendentes_revisao_humana?: string[];
}

export interface ResultadoValidado {
  distribuicao_tst: Record<string, any>;
  dados_benner: Record<string, any>;
  alertas: string[];
  pendentes: string[];
  evidencias: Record<string, { trecho?: string; documento_id?: string | null }>;
  judit_aplicado: string[];
}

const ENUM_FAVORAB_TURMA = new Set(["POSITIVA", "NEGATIVA"]);
const ENUM_FAVORAB_RELATOR = new Set(["POSITIVO", "NEGATIVO"]);
const ENUM_APARELHAMENTO = new Set(["BEM APARELHADO", "MAL APARELHADO"]);
const ENUM_CHANCE = new Set(["PROVÁVEL", "POSSÍVEL", "REMOTA"]);
const ENUM_SN = new Set(["S", "N"]);

// Campos que SEMPRE exigem revisão humana (juízo do advogado / base externa)
const SEMPRE_PENDENTES = [
  "honra",
  "tema",
  "midia_negativa",
  "decisao_quarteirizado",
  "aparelhamento_reclamante",
  "aparelhamento_banco",
  "aparelhamento_terceiro",
  "chance_exito_reclamante",
  "chance_exito_banco",
  "chance_exito_terceiro",
  "relator_favorabilidade",
  "turma_favorabilidade",
];

function normalizarData(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  // Aceita DD/MM/AAAA
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`; // ISO para gravar em coluna date
  // Aceita ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizarHora(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2})[:hH](\d{2})/);
  if (!m) {
    // "às 9h" → "09:00"
    const m2 = v.trim().match(/(\d{1,2})\s*h\s*(\d{0,2})/i);
    if (!m2) return null;
    const hh = String(parseInt(m2[1], 10)).padStart(2, "0");
    const mm = m2[2] ? m2[2].padStart(2, "0") : "00";
    return `${hh}:${mm}`;
  }
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function ehSantanderRecorrente(recorrentes: string[] | null | undefined): boolean {
  if (!recorrentes || recorrentes.length === 0) return false;
  return recorrentes.some((r) => /santander/i.test(r));
}

/** Indício textual de que a evidência se refere a uma sessão de julgamento no TST. */
const RE_EVIDENCIA_TST =
  /(tst|sess[ãa]o\s+de\s+julgamento|pauta\s+de\s+julgamento|inclu[ií]do?\s+em\s+pauta|certid[ãa]o\s+de\s+pauta|sbdi|sdi\b|sdc\b|[óo]rg[ãa]o\s+especial|tribunal\s+pleno|\d\s*[ªa]\s*turma)/i;

/**
 * Trava da seção Julgamento (K/L/M/N).
 * Limpa data/horário/tipo de julgamento quando:
 *   1. tem_data_julgamento = "N";
 *   2. não há evidência literal citando sessão/pauta do TST;
 *   3. a data é anterior à data de distribuição no TST (Judit).
 */
function travarSecaoJulgamento(
  dist: Record<string, any>,
  benner: Record<string, any>,
  evidencias: Record<string, { trecho?: string; documento_id?: string | null }>,
  judit: DadosJudit | null
): string[] {
  const alertas: string[] = [];
  const CAMPOS = ["data_julgamento", "horario_julgamento", "tipo_julgamento"];

  const limpar = (motivo: string) => {
    let removeu = false;
    for (const target of [dist, benner]) {
      for (const c of CAMPOS) {
        if (target[c] !== undefined && target[c] !== null && target[c] !== "") {
          delete target[c];
          removeu = true;
        }
      }
    }
    if (removeu) alertas.push(motivo);
  };

  const temData = String(dist.tem_data_julgamento || benner.tem_data_julgamento || "")
    .trim()
    .toUpperCase();

  // 1. K = "N" → nunca gravar L/M/N
  if (temData === "N") {
    limpar(
      "Seção Julgamento: 'Tem data de julgamento?' = N. Data/horário/tipo de julgamento descartados."
    );
    return alertas;
  }

  const dataJulg = dist.data_julgamento || benner.data_julgamento;
  if (!dataJulg) return alertas;

  // 2. Evidência precisa citar sessão/pauta do TST
  const trecho = String(evidencias?.data_julgamento?.trecho || "");
  if (!trecho || !RE_EVIDENCIA_TST.test(trecho)) {
    limpar(
      "Seção Julgamento: sem evidência literal de sessão/pauta no TST (possível andamento de 1ª instância ou TRT). Data/horário/tipo descartados."
    );
    dist.tem_data_julgamento = "N";
    return alertas;
  }

  // 3. Data anterior à distribuição no TST é impossível
  const distribIso = normalizarData(judit?.data_distribuicao ?? null);
  const julgIso = normalizarData(dataJulg);
  if (distribIso && julgIso && julgIso < distribIso) {
    limpar(
      "Seção Julgamento: data de julgamento anterior à distribuição no TST. Data/horário/tipo descartados."
    );
    dist.tem_data_julgamento = "N";
  }

  return alertas;
}

function unirRecorrentes(recorrentes: string[] | null | undefined): string | null {
  if (!recorrentes || recorrentes.length === 0) return null;
  return recorrentes.filter((r) => r && r.trim()).join(", ");
}

/** Aplica os campos da Judit por cima do que o LLM devolveu. Determinístico. */
function hidratarJudit(
  dist: Record<string, any>,
  benner: Record<string, any>,
  judit: DadosJudit | null
): { aplicados: string[]; alertas: string[] } {
  const aplicados: string[] = [];
  const alertas: string[] = [];
  if (!judit) return { aplicados, alertas };

  const setIfDifferent = (
    target: Record<string, any>,
    key: string,
    value: unknown,
    alertKey: string
  ) => {
    if (value === null || value === undefined || value === "") return;
    if (target[key] && String(target[key]).trim() !== String(value).trim()) {
      alertas.push(`Campo '${alertKey}' devolvido pela IA divergiu da Judit. Mantido o valor da Judit.`);
    }
    target[key] = value;
    aplicados.push(alertKey);
  };

  if (judit.relator) {
    setIfDifferent(dist, "relator", judit.relator, "relator");
  }
  if (judit.turma) {
    setIfDifferent(dist, "turma", judit.turma, "turma");
  }
  // Tipo de recurso só vem da Judit (memory: judit-resource-attribution-rules)
  if (judit.tipo_recurso) {
    setIfDifferent(benner, "tipo_recurso", judit.tipo_recurso, "tipo_recurso");
  }
  // Recorrente literal da Judit (camada 1)
  const recorrenteStr = unirRecorrentes(judit.recorrentes);
  if (recorrenteStr) {
    setIfDifferent(dist, "parte_recorrente", recorrenteStr, "parte_recorrente");
    setIfDifferent(benner, "recorrente", recorrenteStr, "recorrente");
  }

  // Situação do processo segundo a Judit é fonte de verdade.
  // Se a Judit diz "Ativo" / "Em curso", JAMAIS permitir trânsito em julgado pela IA.
  const sitJudit = String(judit.situacao_processo || "").trim().toLowerCase();
  const baixadoJudit = String(judit.processo_baixado || "").trim().toUpperCase();
  const ativo = /ativ|active|em\s*curso|em\s*tramita|andamento/.test(sitJudit);
  const transitado = /tr[âa]nsito|baixad/.test(sitJudit);

  if (ativo || (baixadoJudit === "N" && !transitado)) {
    if (dist.transito_julgado === true) {
      alertas.push("IA marcou 'trânsito em julgado' mas Judit indica processo ATIVO. Override aplicado.");
    }
    dist.transito_julgado = false;
    if (benner.transito_julgado === true) {
      alertas.push("IA marcou 'trânsito em julgado' (Benner) mas Judit indica processo ATIVO. Override aplicado.");
    }
    benner.transito_julgado = false;
    if (benner.processo_baixado === "S") {
      alertas.push("IA marcou 'processo baixado=S' mas Judit indica ATIVO. Forçado para 'N'.");
    }
    benner.processo_baixado = "N";
    if (benner.data_transito_julgado) {
      alertas.push("Removida 'data_transito_julgado' devido à Judit indicar processo ATIVO.");
      delete benner.data_transito_julgado;
    }
    setIfDifferent(dist, "situacao_processo", judit.situacao_processo, "situacao_processo");
    setIfDifferent(benner, "situacao_processo", judit.situacao_processo, "situacao_processo");
    aplicados.push("transito_julgado");
  } else if (transitado) {
    setIfDifferent(dist, "situacao_processo", judit.situacao_processo, "situacao_processo");
    setIfDifferent(benner, "situacao_processo", judit.situacao_processo, "situacao_processo");
  }

  return { aplicados, alertas };
}

function limparEnums(obj: Record<string, any>): { obj: Record<string, any>; alertas: string[] } {
  const alertas: string[] = [];
  const out: Record<string, any> = {};
  const enumChecks: Record<string, Set<string>> = {
    relator_favorabilidade: ENUM_FAVORAB_RELATOR,
    turma_favorabilidade: ENUM_FAVORAB_TURMA,
    aparelhamento_reclamante: ENUM_APARELHAMENTO,
    aparelhamento_banco: ENUM_APARELHAMENTO,
    aparelhamento_terceiro: ENUM_APARELHAMENTO,
    chance_exito_reclamante: ENUM_CHANCE,
    chance_exito_banco: ENUM_CHANCE,
    chance_exito_terceiro: ENUM_CHANCE,
    processo_baixado: ENUM_SN,
    midia_negativa: ENUM_SN,
    materia_honra: ENUM_SN,
    provas_digitais: ENUM_SN,
    tem_data_julgamento: ENUM_SN,
  };
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    let value: any = typeof v === "string" ? v.trim() : v;
    const allowed = enumChecks[k];
    if (allowed && typeof value === "string") {
      const upper = value.toUpperCase();
      if (!allowed.has(upper)) {
        alertas.push(`Campo '${k}' fora do enum permitido (recebido: '${value}'). Descartado.`);
        continue;
      }
      value = upper;
    }
    if (k === "data_julgamento" || k === "data_distribuicao") {
      const norm = normalizarData(value);
      if (!norm) {
        alertas.push(`Campo '${k}' com data inválida: '${value}'. Descartado.`);
        continue;
      }
      value = norm;
    }
    if (k === "horario_julgamento") {
      const norm = normalizarHora(value);
      if (!norm) {
        alertas.push(`Campo '${k}' com horário inválido: '${value}'. Descartado.`);
        continue;
      }
      value = norm;
    }
    out[k] = value;
  }
  return { obj: out, alertas };
}

/** Retorna lista combinada de pendentes (sempre + baixa confiança + LLM apontou). */
function calcularPendentes(
  dist: Record<string, any>,
  benner: Record<string, any>,
  confianca: Record<string, Confianca>,
  pendentesIA: string[]
): string[] {
  const set = new Set<string>(pendentesIA);
  for (const k of SEMPRE_PENDENTES) set.add(k);
  for (const [campo, c] of Object.entries(confianca || {})) {
    if (c === "baixa") set.add(campo);
  }
  // Coerência K↔L: se sobrou data de julgamento APÓS a trava da seção Julgamento
  // (ver travarSecaoJulgamento), marca tem_data_julgamento = "S".
  const dataJulg = dist.data_julgamento || benner.data_julgamento;
  const temData = dist.tem_data_julgamento || benner.tem_data_julgamento;
  if (dataJulg && !temData) {
    dist.tem_data_julgamento = "S";
  }
  if (!dataJulg && String(temData).toUpperCase() === "S") {
    set.add("data_julgamento");
  }
  return [...set].sort();
}

export function validarEHidratar(
  extracao: ExtracaoIA,
  judit: DadosJudit | null
): ResultadoValidado {
  const alertas: string[] = [...(extracao._alertas || [])];
  const evidencias = extracao._evidencias || {};

  // 1. Limpa enums + normaliza formatos
  const { obj: distLimpo, alertas: alertasDist } = limparEnums(extracao.distribuicao_tst || {});
  const { obj: bennerLimpo, alertas: alertasBenner } = limparEnums(extracao.dados_benner || {});
  alertas.push(...alertasDist, ...alertasBenner);

  // 2. Hidrata Judit por cima (camada 1)
  const { aplicados, alertas: alertasJudit } = hidratarJudit(distLimpo, bennerLimpo, judit);
  alertas.push(...alertasJudit);

  // 3. Consolida campos do bloco legado `dados_benner` em `distribuicao_tst`
  //    (a aba Dados Benner foi removida; o form é unificado). `dist` ganha
  //    precedência se houver colisão.
  for (const [k, v] of Object.entries(bennerLimpo)) {
    if (distLimpo[k] === undefined || distLimpo[k] === null || distLimpo[k] === "") {
      distLimpo[k] = v;
    }
  }

  // 3.1 Trava da seção Julgamento (K/L/M/N) — depende da Judit e das evidências.
  alertas.push(...travarSecaoJulgamento(distLimpo, bennerLimpo, evidencias, judit));

  // 4. Calcula pendentes
  const pendentes = calcularPendentes(
    distLimpo,
    bennerLimpo,
    extracao._confianca || {},
    extracao._campos_pendentes_revisao_humana || []
  );

  // 5. Sanidade extra: Santander recorrente sem nada extraído gera alerta
  if (judit && ehSantanderRecorrente(judit.recorrentes) && !distLimpo.data_julgamento) {
    // não é erro; só registra para o usuário
  }

  return {
    distribuicao_tst: distLimpo,
    dados_benner: {},
    alertas,
    pendentes,
    evidencias,
    judit_aplicado: aplicados,
  };
}
