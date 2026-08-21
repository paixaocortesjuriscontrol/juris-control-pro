/**
 * executar-djet-pautas-agendado
 *
 * Disparada por pg_cron a cada poucos minutos. Só executa de fato quando
 *   1) configuracoes_monitoramento (tipo='djet_pautas') está ativo
 *   2) hora atual em BRT está dentro de [horario, horario+10min]
 *   3) ainda não houve execução do dia em execucoes_agendadas (tipo='djet_pautas')
 *
 * Itera tribunais TST + TRT1..TRT24, chama internamente a edge function
 * `buscar-dejt-pautas` (que já baixa PDF + extrai texto + casa termos) e
 * persiste os matches em `publicacoes_djen` com tipo_publicacao='pauta'.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIBUNAIS_DEJT = [
  "TST",
  "TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8",
  "TRT9","TRT10","TRT11","TRT12","TRT13","TRT14","TRT15",
  "TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22",
  "TRT23","TRT24",
];

const WINDOW_MIN = 10;
const DELAY_BETWEEN_TRIBUNAIS_MS = 800;
/** Alertas técnicos do motor Pautas Servidor vão só para o suporte. */
const SUPORTE_EMAIL = "suporte@paixaocortes.adv.br";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "JurisControl <alertas@juriscontrol.adv.br>";


function brtNow(): { ymd: string; hour: number; minute: number; ddmmyyyy: string } {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const t = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false }).split(", ")[1];
  const [h, m] = t.split(":").map(Number);
  const [y, mo, d] = ymd.split("-");
  return { ymd, hour: h === 24 ? 0 : h, minute: m, ddmmyyyy: `${d}/${mo}/${y}` };
}

/**
 * Retorna o weekday em BRT: 0=domingo, 1=segunda, ..., 6=sábado.
 */
function brtWeekday(ymd: string): number {
  const [y, mo, d] = ymd.split("-").map(Number);
  // meio-dia UTC para evitar viradas de fuso
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
}

/**
 * Resolve o horário do dia atual a partir do array em horarios_execucao.
 * - Array com 7 posições: usa horarios[weekday] (0=dom..6=sáb). "" ou null = desativado.
 * - Array com 1 posição (legado): usa o mesmo horário todos os dias.
 * Retorna null se o dia estiver desativado.
 */
function resolveHorarioDoDia(horarios: (string | null)[] | null, weekday: number): string | null {
  if (!horarios || horarios.length === 0) return "06:00";
  if (horarios.length === 1) return horarios[0] || null;
  const v = horarios[weekday];
  return v && v.trim() !== "" ? v : null;
}

function sanitizarHorarios(horarios: unknown[]): string[] {
  return Array.from(new Set(
    horarios
      .map((h) => String(h || "").trim())
      .filter((h) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(h))
      .map((h) => {
        const [hh, mm] = h.split(":");
        return `${hh.padStart(2, "0")}:${mm}`;
      }),
  )).sort().slice(0, 3);
}

function resolveHorariosDoDia(cfg: { horarios_execucao?: unknown; metadata?: unknown }, weekday: number): string[] {
  const metadata = (cfg.metadata as Record<string, unknown> | null) || {};
  const matriz = metadata.horarios_por_dia as unknown;
  if (Array.isArray(matriz) && matriz.length === 7) {
    const linha = matriz[weekday];
    return Array.isArray(linha) ? sanitizarHorarios(linha) : [];
  }
  const arr = Array.isArray(cfg.horarios_execucao) ? cfg.horarios_execucao as unknown[] : [];
  const legado = resolveHorarioDoDia(arr.map((h) => h == null ? null : String(h)), weekday);
  return legado ? [legado] : [];
}

function slotNaJanela(horarios: string[], hour: number, minute: number): string | null {
  const nowMin = hour * 60 + minute;
  for (const horario of horarios) {
    const [hh, mm] = horario.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) continue;
    const tgtMin = hh * 60 + mm;
    if (nowMin >= tgtMin && nowMin <= tgtMin + WINDOW_MIN) return horario;
  }
  return null;
}

function ymdToDdmmyyyy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function buildDateRange(inicioYmd: string, fimYmd: string): string[] {
  const out: string[] = [];
  const start = new Date(`${inicioYmd}T12:00:00Z`);
  const end = new Date(`${fimYmd}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [inicioYmd];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type ProgressoStatus = "pendente" | "executando" | "concluido" | "erro" | "cancelado";
type ProgressoPautaItem = {
  id: string;
  label: string;
  tribunal: string;
  status: ProgressoStatus;
  mensagem?: string | null;
  ultimoErro?: string | null;
  current: number;
  total: number;
  novas: number;
  duplicatas: number;
  descartadas: number;
  diasSemPdf: number;
  /** Data (YMD) da edição do caderno efetivamente lida nesta rodada. */
  edicao?: string | null;
};

function makeProgressItems(datas: string[]): ProgressoPautaItem[] {
  const total = datas.length;
  return TRIBUNAIS_DEJT.map((tribunal) => ({
    id: tribunal,
    label: tribunal,
    tribunal,
    status: "pendente" as ProgressoStatus,
    mensagem: "Aguardando",
    ultimoErro: null,
    current: 0,
    total,
    novas: 0,
    duplicatas: 0,
    descartadas: 0,
    diasSemPdf: 0,
    edicao: null,
  }));
}

/** Dias úteis (seg-sex) entre duas datas YMD. */
function diasUteisEntre(deYmd: string, ateYmd: string): number {
  const de = new Date(`${deYmd}T12:00:00Z`);
  const ate = new Date(`${ateYmd}T12:00:00Z`);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime()) || de >= ate) return 0;
  let n = 0;
  for (const d = new Date(de); d < ate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/**
 * Alerta técnico (somente suporte) quando o portal do DEJT está servindo
 * edição mais antiga que 2 dias úteis em algum tribunal — sinal de queda ou
 * mudança de endpoint na fonte. Envia no máximo uma vez por dia.
 */
async function alertarFonteAtrasada(
  supabase: ReturnType<typeof createClient>,
  configTable: string,
  configTipo: string,
  itens: ProgressoPautaItem[],
  ymd: string,
) {
  try {
    const atrasados = itens
      .filter((i) => !!i.edicao && diasUteisEntre(i.edicao!, ymd) > 2)
      .map((i) => ({ tribunal: i.tribunal, edicao: i.edicao!, atraso: diasUteisEntre(i.edicao!, ymd) }))
      .sort((a, b) => b.atraso - a.atraso);
    if (atrasados.length === 0) return;
    if (!RESEND_API_KEY) {
      console.log("[DJET-Pautas-Agendado] fonte atrasada, sem RESEND_API_KEY:", atrasados);
      return;
    }

    const { data: cfg } = await supabase
      .from(configTable)
      .select("metadata")
      .eq("tipo", configTipo)
      .maybeSingle();
    const md = (cfg?.metadata as Record<string, unknown> | null) || {};
    if (typeof md.alerta_fonte_atrasada_em === "string" && md.alerta_fonte_atrasada_em.slice(0, 10) === ymd) {
      return; // já avisado hoje
    }

    const linhas = atrasados
      .map((a) => `<li><strong>${a.tribunal}</strong>: última edição ${ymdToDdmmyyyy(a.edicao)} (${a.atraso} dia(s) útil(eis) de atraso)</li>`)
      .join("");
    const html = `
      <p>O portal do DEJT está servindo edições antigas para ${atrasados.length} tribunal(is) no motor <strong>DJEN Pautas Servidor</strong>.</p>
      <ul>${linhas}</ul>
      <p>Possíveis causas: edição do dia ainda não publicada, queda do portal ou mudança do endpoint dos cadernos.</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [SUPORTE_EMAIL],
        subject: `DJEN Pautas Servidor - Alerta técnico - Fonte DEJT atrasada (${atrasados.length} tribunal(is))`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[DJET-Pautas-Agendado] falha ao enviar alerta de fonte atrasada:", res.status, await res.text());
      return;
    }
    await supabase
      .from(configTable)
      .update({ metadata: { ...md, alerta_fonte_atrasada_em: new Date().toISOString() } })
      .eq("tipo", configTipo);
  } catch (e) {
    console.error("[DJET-Pautas-Agendado] erro no alerta de fonte atrasada:", e);
  }
}


function buildProgressPayload(itens: ProgressoPautaItem[], datasJanela: string[], ymd: string) {
  const concluidos = itens.filter((i) => ["concluido", "erro", "cancelado"].includes(i.status)).length;
  const falhas = itens.filter((i) => i.status === "erro").length;
  const atual = itens.find((i) => i.status === "executando") || null;
  return {
    totalItens: itens.length,
    concluidos,
    falhas,
    atual: atual ? { id: atual.id, label: atual.label } : null,
    itens: itens.map((i) => ({ ...i })),
    janela: { dataInicio: datasJanela[0] || ymd, dataFim: datasJanela[datasJanela.length - 1] || ymd },
  };
}

function descreverErroHttp(status: number): string {
  if (status === 546) return "HTTP 546: limite de CPU/memória da Edge Function";
  if (status === 504) return "HTTP 504: timeout ao processar o caderno";
  if (status >= 500) return `HTTP ${status}: falha transitória do servidor`;
  return `HTTP ${status}`;
}

async function inferExecucaoServidorId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from("workers_servidor")
    .select("current_execucao_id, heartbeat_at")
    .eq("current_tipo", "djet_pautas_servidor")
    .eq("status", "busy")
    .not("current_execucao_id", "is", null)
    .order("heartbeat_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const id = (data?.current_execucao_id as string | null) || null;
  if (!id || !data?.heartbeat_at) return id;
  const fresh = Date.now() - new Date(data.heartbeat_at as string).getTime() < 10 * 60_000;
  return fresh ? id : null;
}

async function isExecucaoServidorCancelada(supabase: ReturnType<typeof createClient>, execucaoServidorId: string | null) {
  if (!execucaoServidorId) return false;
  const { data } = await supabase
    .from("execucoes_servidor")
    .select("status")
    .eq("id", execucaoServidorId)
    .maybeSingle();
  return data?.status === "cancelado";
}

interface Monitoramento {
  id: string;
  tipo: string;
  termo_busca: string | null;
  oab: string | null;
  uf: string | null;
  exclusoes: string[] | null;
  tribunais: string[] | null;
  condicao_concomitante: string | null;
  coordenacao_id: string | null;
}

interface MatchOut {
  monitoramentoId: string;
  termoMatch: string;
  processo: string | null;
  conteudo: string;
  hash: string;
  dataPublicacao: string;
  fonte: string;
  tribunal: string;
}

function monitsForTribunal(monits: Monitoramento[], tribunal: string): Monitoramento[] {
  return monits.filter((m) => {
    if (!m.tribunais || m.tribunais.length === 0) return true;
    return m.tribunais.some((t) => (t || "").toUpperCase() === tribunal);
  });
}

function calcularDataPublicacaoYmd(dataDispYmd: string): string {
  const base = new Date(`${dataDispYmd}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  const estaNoRecesso = (d: Date) => {
    const mes = d.getUTCMonth();
    const dia = d.getUTCDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  while (base.getUTCDay() === 0 || base.getUTCDay() === 6) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  if (estaNoRecesso(base)) {
    if (base.getUTCMonth() === 11) base.setUTCFullYear(base.getUTCFullYear() + 1);
    base.setUTCMonth(0);
    base.setUTCDate(7);
    while (base.getUTCDay() === 0 || base.getUTCDay() === 6) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
  }
  return base.toISOString().slice(0, 10);
}

function monitToInput(m: Monitoramento) {
  const termos: string[] = [];
  if (m.termo_busca) termos.push(m.termo_busca);
  return {
    id: m.id,
    termos,
    condicaoConcomitante: m.condicao_concomitante || undefined,
    exclusoes: m.exclusoes || [],
    oab: m.oab || undefined,
    coordenacao_id: m.coordenacao_id ?? null,
  };
}

async function persistMatches(
  supabase: ReturnType<typeof createClient>,
  matches: MatchOut[],
  monitCoordMap: Map<string, string | null>,
  persistMode: "browser" | "servidor" = "browser",
  execucaoId: string | null = null,
): Promise<{ novas: number; duplicadas: number }> {
  if (matches.length === 0) return { novas: 0, duplicadas: 0 };
  const seen = new Set<string>();
  const tabela = persistMode === "servidor" ? "publicacoes_djen_servidor" : "publicacoes_djen";
  const rows = matches.filter((m) => {
    const coordenacaoId = monitCoordMap.get(m.monitoramentoId) ?? null;
    // Dedup local: coordenação + hash (sem monitoramento). Mesma pauta vista
    // por dois monitoramentos da mesma coordenação → 1 linha só.
    const key = `${coordenacaoId || ""}|${m.hash || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((m) => {
    const base: Record<string, unknown> = {
      monitoramento_id: m.monitoramentoId,
      coordenacao_id: monitCoordMap.get(m.monitoramentoId) ?? null,
      hash_conteudo: m.hash,
      // Normaliza para 12:00 UTC (= 09:00 BRT) para que o dia BRT seja igual
      // ao dia UTC — evita que o front, em BRT (UTC-3), renderize como "ontem".
      data_disponibilizacao: `${m.dataPublicacao}T12:00:00Z`,
      data_publicacao: `${calcularDataPublicacaoYmd(m.dataPublicacao)}T12:00:00Z`,
      processo_numero: m.processo,
      conteudo: m.conteudo,
      fonte: m.fonte,
      tribunal: m.tribunal,
      tipo_publicacao: "pauta",
    };
    if (persistMode === "servidor") {
      base.origem = "servidor";
      if (execucaoId) base.execucao_id = execucaoId;
    } else {
      base.lida = false;
    }
    return base;
  });

  let novas = 0;
  let duplicadas = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const hashes = Array.from(new Set(slice.map((r) => r.hash_conteudo as string).filter(Boolean)));
    const { data: existentes } = hashes.length > 0
      ? await supabase
        .from(tabela)
        .select("id, coordenacao_id, hash_conteudo")
        .eq("tipo_publicacao", "pauta")
        .in("hash_conteudo", hashes)
      : { data: [] as Array<{ id: string; coordenacao_id: string | null; hash_conteudo: string }> };
    const existingKeys = new Set(
      (existentes || []).map((e) => `${e.coordenacao_id || ""}|${e.hash_conteudo || ""}`),
    );
    const novosRows = slice.filter((r) => !existingKeys.has(`${r.coordenacao_id || ""}|${r.hash_conteudo || ""}`));
    duplicadas += slice.length - novosRows.length;
    if (novosRows.length === 0) continue;

    const { data, error } = await supabase
      .from(tabela)
      .insert(novosRows)
      .select("id");
    if (error) {
      for (const r of novosRows) {
        const { error: e2 } = await supabase.from(tabela).insert(r);
        if (!e2) novas++; else duplicadas++;
      }
    } else {
      const inseridas = data?.length ?? 0;
      novas += inseridas;
      duplicadas += novosRows.length - inseridas;
    }
    // Grava junção execução×publicação (somente servidor)
    if (persistMode === "servidor" && execucaoId) {
      const hashes = slice.map((r) => r.hash_conteudo as string).filter(Boolean);
      const monitoramentoIds = Array.from(new Set(slice.map((r) => r.monitoramento_id as string).filter(Boolean)));
      if (hashes.length > 0 && monitoramentoIds.length > 0) {
        const { data: ids } = await supabase
          .from("publicacoes_djen_servidor")
          .select("id")
          .in("monitoramento_id", monitoramentoIds)
          .in("hash_conteudo", hashes);
        if (ids && ids.length > 0) {
          const junctionRows = ids.map((p: { id: string }) => ({
            publicacao_id: p.id,
            execucao_id: execucaoId,
            tipo_engine: "pautas",
          }));
          await supabase
            .from("publicacoes_djen_servidor_execucoes")
            .upsert(junctionRows, { onConflict: "publicacao_id,execucao_id", ignoreDuplicates: true });
        }
      }
    }
  }
  return { novas, duplicadas };
}

async function runJob(
  supabase: ReturnType<typeof createClient>,
  execId: string,
  ymd: string,
  persistMode: "browser" | "servidor" = "browser",
  configTable: string = "configuracoes_monitoramento",
  options: { execucaoServidorId?: string | null; dataInicio?: string; dataFim?: string; coordenacaoId?: string | null; monitoramentoIds?: string[]; schedulerSlot?: string | null; reprocessarEdicoes?: boolean } = {},
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const startedAt = Date.now();
  let totalNovas = 0;
  let totalDuplicadas = 0;
  let totalErros = 0;
  const execucaoServidorId = persistMode === "servidor"
    ? options.execucaoServidorId || await inferExecucaoServidorId(supabase)
    : null;
  let payloadServidor: Record<string, unknown> | null = null;
  if (execucaoServidorId && (!options.dataInicio || !options.dataFim)) {
    const { data } = await supabase
      .from("execucoes_servidor")
      .select("payload")
      .eq("id", execucaoServidorId)
      .maybeSingle();
    payloadServidor = (data?.payload as Record<string, unknown> | null) || null;
  }
  const dataInicioOpcao = options.dataInicio || (typeof payloadServidor?.dataInicio === "string" ? payloadServidor.dataInicio : undefined);
  const dataFimOpcao = options.dataFim || (typeof payloadServidor?.dataFim === "string" ? payloadServidor.dataFim : undefined);
  const datasJanela = buildDateRange(dataInicioOpcao || ymd, dataFimOpcao || dataInicioOpcao || ymd);
  const itens = makeProgressItems(datasJanela);
  // "Reprocessar edição" pode vir do body (cron/manual) ou do payload da
  // execução enfileirada pelo painel (rota VPS).
  const reprocessarEdicoes = options.reprocessarEdicoes === true || payloadServidor?.reprocessarEdicoes === true;

  // ── Motor Servidor: aceita a edição vigente do DEJT (o portal serve só o
  // caderno atual num caminho fixo, muitas vezes atrasado alguns dias) e usa
  // o controle de "edição já processada" por tribunal para não reprocessar.
  const aceitarEdicaoVigente = persistMode === "servidor";
  const configTipo = persistMode === "servidor" ? "djet_pautas_servidor" : "djet_pautas";
  const edicoesProcessadas: Record<string, string> = {};
  let configMetadata: Record<string, unknown> = {};
  if (aceitarEdicaoVigente) {
    const { data: cfgRow } = await supabase
      .from(configTable)
      .select("metadata")
      .eq("tipo", configTipo)
      .maybeSingle();
    configMetadata = (cfgRow?.metadata as Record<string, unknown> | null) || {};
    const prev = configMetadata.edicoes_processadas as Record<string, unknown> | undefined;
    // "Reprocessar edição": ignora o controle de edições já processadas nesta
    // rodada (útil quando um caderno foi lido parcialmente por erro de chunk).
    if (prev && typeof prev === "object" && !options.reprocessarEdicoes) {
      for (const [trib, val] of Object.entries(prev)) {
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) edicoesProcessadas[trib] = val;
      }
    }
  }

  const filtroDetalhes = {
    scheduler_slot: options.schedulerSlot || null,
    filtro: {
      coordenacaoId: options.coordenacaoId || null,
      monitoramentoIds: options.monitoramentoIds || null,
      persistMode,
      dataInicio: dataInicioOpcao || null,
      dataFim: dataFimOpcao || null,
    },
  };
  let lastFlush = 0;
  const flushProgresso = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlush < 700) return;
    lastFlush = now;
    const progresso = buildProgressPayload(itens, datasJanela, ymd);
    await supabase
      .from("execucoes_agendadas")
      .update({
        status: "executando",
        registros_encontrados: totalNovas,
        registros_processados: totalNovas + totalDuplicadas,
        erros: totalErros,
        detalhes: { ...filtroDetalhes, novas: totalNovas, duplicadas: totalDuplicadas, progresso },
      })
      .eq("id", execId)
      .neq("status", "cancelado");
    if (!execucaoServidorId) return;
    await supabase
      .from("execucoes_servidor")
      .update({
        status: "executando",
        finalizado_em: null,
        erro: null,
        progresso,
        progresso_atualizado_em: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", execucaoServidorId)
      .neq("status", "cancelado");
  };

  try {
    // Carrega todos os monitoramentos ativos
    const { data: monitsData, error: monitsErr } = await supabase
      .from("monitoramentos_djen")
      .select("id, tipo, termo_busca, oab, uf, ativo, exclusoes, tribunais, condicao_concomitante, coordenacao_id")
      .eq("ativo", true)
      .neq("somente_kurier", true);

    if (monitsErr) throw monitsErr;
    let monits = (monitsData || []) as unknown as Monitoramento[];
    const filtroMonitoramentoIds = Array.isArray(options.monitoramentoIds)
      ? new Set(options.monitoramentoIds.filter(Boolean))
      : null;
    if (filtroMonitoramentoIds && filtroMonitoramentoIds.size > 0) {
      monits = monits.filter((m) => filtroMonitoramentoIds.has(m.id));
    } else if (options.coordenacaoId) {
      monits = monits.filter((m) => m.coordenacao_id === options.coordenacaoId);
    }
    const monitCoordMap = new Map<string, string | null>();
    monits.forEach((m) => monitCoordMap.set(m.id, m.coordenacao_id));

    await flushProgresso(true);

    for (const tribunal of TRIBUNAIS_DEJT) {
      const item = itens.find((i) => i.id === tribunal)!;
      const monitsTrib = monitsForTribunal(monits, tribunal);
      const monsInput = monitsTrib.map(monitToInput).filter((m) => m.termos.length > 0 || m.oab);
      item.status = "executando";
      item.mensagem = monsInput.length === 0 ? "Sem monitoramentos para este tribunal" : "Iniciando...";
      await flushProgresso(true);
      if (monsInput.length === 0) {
        item.status = "concluido";
        item.current = item.total;
        item.mensagem = "Sem monitoramentos aplicáveis";
        await flushProgresso(true);
        continue;
      }

      // Quando todos os dias da janela caírem em "edição já processada", o
      // fechamento do tribunal precisa dizer isso — e não "0 encontrada(s)".
      let diasEdicaoJaProcessada = 0;
      let diasProcessados = 0;
      for (const dataYmd of datasJanela) {
        if (await isExecucaoServidorCancelada(supabase, execucaoServidorId)) {
          for (const it of itens.filter((i) => i.status === "pendente" || i.status === "executando")) {
            it.status = "cancelado";
            it.mensagem = "Cancelado pelo usuário";
          }
          await flushProgresso(true);
          return;
        }
        const dataDDMMYYYY = ymdToDdmmyyyy(dataYmd);
        item.mensagem = `Processando ${dataDDMMYYYY}`;
        // Pula sábado/domingo: DEJT não publica caderno novo.
        const dow = new Date(`${dataYmd}T12:00:00Z`).getUTCDay();
        if (dow === 0 || dow === 6) {
          item.current += 1;
          item.diasSemPdf += 1;
          item.mensagem = `Sem caderno (${dow === 0 ? "domingo" : "sábado"})`;
          await flushProgresso();
          continue;
        }
        try {
          // Chunk de páginas para não estourar o CPU limit da Edge Function
          // em cadernos grandes (TRT1/TRT2/TRT5). Como uma pauta pode começar
          // no fim de um chunk e seus processos continuarem no chunk seguinte
          // (caso real TRT5: marcador na pág. 100 e processo na pág. 101),
          // reprocessamos uma faixa de sobreposição. A deduplicação local por
          // coordenação+hash remove os repetidos, mas evita perder sub-blocos.
          const CHUNK_PAGES = 100;
          const OVERLAP_PAGES = 25;
          const MAX_CHUNKS = 40; // teto de segurança (~4000 páginas)
          const matches: MatchOut[] = [];
          let pageStart = 1;
          let numPages = CHUNK_PAGES; // provisório; será atualizado após 1ª resposta
          let chunkIdx = 0;
          let ultimoStatus = 0;
          let falhouChunk = false;
          let cadernoNaoAtualizado: { lastModified: string | null; dataDisponibilizacao?: string | null; dataPublicacaoLegal?: string | null } | null = null;
          // Edição efetivamente servida pelo portal (data de disponibilização
          // lida dentro do PDF) e se ela já foi processada antes.
          let edicaoDetectada: string | null = null;
          let edicaoJaProcessada = false;


          while (pageStart <= numPages && chunkIdx < MAX_CHUNKS) {
            const pageEnd = Math.min(pageStart + CHUNK_PAGES - 1, numPages);
            const requestPageStart = chunkIdx === 0 ? pageStart : Math.max(1, pageStart - OVERLAP_PAGES);
            // Retry transiente (HTTP 5xx/546) por chunk
            let resp: Response | null = null;
            let lastStatus = 0;
            for (let attempt = 0; attempt < 3; attempt++) {
              resp = await fetch(`${supabaseUrl}/functions/v1/buscar-dejt-pautas`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceKey}`,
                  "apikey": serviceKey,
                },
                body: JSON.stringify({
                  tribunal,
                  dataDDMMYYYY,
                  caderno: "judiciario",
                  monitoramentos: monsInput,
                  pageStart: requestPageStart,
                  pageEnd,
                  aceitarEdicaoVigente,
                }),
              });
              lastStatus = resp.status;
              if (resp.ok) break;
              if (resp.status >= 500 || resp.status === 546) {
                await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
                continue;
              }
              break;
            }
            ultimoStatus = lastStatus;
            if (!resp || !resp.ok) {
              falhouChunk = true;
              console.error(`[DJET-Pautas-Agendado] ${tribunal} ${dataDDMMYYYY} chunk p${requestPageStart}-${pageEnd}: HTTP ${lastStatus}`);
              break;
            }
            const json = await resp.json();
            // Endpoint diario.jt.jus.br serve "caderno vigente" — quando o TRT
            // ainda não publicou o do dia, devolve o do dia útil anterior.
            // Neste caso não faz sentido continuar paginando o mesmo PDF.
            if (json?.sem_dados && (json?.motivo === "caderno-nao-atualizado" || json?.motivo === "caderno-de-outra-data")) {
              cadernoNaoAtualizado = {
                lastModified: (json?.lastModified as string | null) ?? null,
                dataDisponibilizacao: (json?.dataDisponibilizacao as string | null) ?? null,
                dataPublicacaoLegal: (json?.dataPublicacaoLegal as string | null) ?? null,
              };
              break;
            }
            // Motor Servidor: identifica a edição servida e evita reprocessar
            // o mesmo caderno em outra data/rodada.
            if (aceitarEdicaoVigente && !edicaoDetectada) {
              const disp = (json?.dataDisponibilizacao as string | null) || null;
              if (disp) {
                edicaoDetectada = disp;
                item.edicao = disp;
                if (edicoesProcessadas[tribunal] === disp) {
                  edicaoJaProcessada = true;
                  break;
                }
              }
            }

            const chunkMatches: MatchOut[] = (json?.matches || []).map((m: Record<string, unknown>) => ({
              monitoramentoId: m.monitoramentoId as string,
              termoMatch: m.termoMatch as string,
              processo: (m.processo as string) ?? null,
              conteudo: m.conteudo as string,
              hash: m.hash as string,
              dataPublicacao: m.dataPublicacao as string,
              fonte: (m.fonte as string) || "dejt-pdf",
              tribunal: (m.tribunal as string) || tribunal,
            }));
            matches.push(...chunkMatches);
            const np = Number(json?.numPages) || 0;
            if (np > 0) numPages = np;
            item.mensagem = `${dataDDMMYYYY}: p.${requestPageStart}-${pageEnd}/${numPages || "?"}`;
            await flushProgresso();
            pageStart = pageEnd + 1;
            chunkIdx++;
            // Pausa entre chunks para dar respiro ao worker
            if (pageStart <= numPages) await new Promise((r) => setTimeout(r, 200));
          }

          if (edicaoJaProcessada) {
            item.current += 1;
            diasEdicaoJaProcessada += 1;
            item.mensagem = edicaoDetectada
              ? `Edição ${ymdToDdmmyyyy(edicaoDetectada)} já processada`
              : "Edição já processada";
            await flushProgresso(true);
            continue;
          }

          if (cadernoNaoAtualizado) {
            item.current += 1;
            item.diasSemPdf += 1;
            const lm = cadernoNaoAtualizado.lastModified;
            const dataInfo = cadernoNaoAtualizado.dataDisponibilizacao || cadernoNaoAtualizado.dataPublicacaoLegal;
            item.mensagem = lm
              ? `Caderno não corresponde ao dia (disp/pub: ${dataInfo || "—"}; last-modified: ${lm})`
              : "Caderno ainda não publicado";
            await flushProgresso(true);
            continue;
          }

          if (falhouChunk) {
            totalErros++;
            item.current += 1;
            item.status = "erro";
            item.ultimoErro = descreverErroHttp(ultimoStatus);
            item.mensagem = `${item.ultimoErro} em ${dataDDMMYYYY}`;
            await flushProgresso(true);
            continue;
          }
          const { novas, duplicadas } = await persistMatches(supabase, matches, monitCoordMap, persistMode, execucaoServidorId);
          totalNovas += novas;
          totalDuplicadas += duplicadas;
          item.current += 1;
          diasProcessados += 1;
          item.novas += novas;
          item.duplicatas += duplicadas;
          if (aceitarEdicaoVigente && edicaoDetectada) {
            edicoesProcessadas[tribunal] = edicaoDetectada;
          }
          const edicaoLabel = edicaoDetectada ? `Edição ${ymdToDdmmyyyy(edicaoDetectada)}` : dataDDMMYYYY;
          item.mensagem = `${edicaoLabel} (${numPages}p): ${matches.length} achado(s) · ${novas} nova(s)`;
          await flushProgresso();
          console.log(`[DJET-Pautas-Agendado] ${tribunal} ${dataDDMMYYYY} (edição ${edicaoDetectada || dataYmd}): ${matches.length} matches → ${novas} novas / ${duplicadas} dup`);

        } catch (e) {
          totalErros++;
          item.current += 1;
          item.ultimoErro = String((e as Error)?.message || e).slice(0, 200);
          item.mensagem = `Erro em ${dataDDMMYYYY}`;
          await flushProgresso(true);
          console.error(`[DJET-Pautas-Agendado] ${tribunal} ${dataDDMMYYYY} erro:`, e);
        }

        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_TRIBUNAIS_MS));
      }
      // Tribunal finalizado: se houve erro em qualquer dia, mantém vermelho no painel.
      if (item.status !== "cancelado") {
        item.status = item.ultimoErro ? "erro" : "concluido";
        const edicaoLida = item.edicao ? ymdToDdmmyyyy(item.edicao) : null;
        const atrasoDias = item.edicao ? diasUteisEntre(item.edicao, ymd) : 0;
        const sufixoAtraso = atrasoDias > 2 ? ` (fonte atrasada ${atrasoDias} dias úteis)` : "";
        if (item.ultimoErro) {
          item.mensagem = `Erro · ${item.ultimoErro}`;
        } else if (diasEdicaoJaProcessada > 0 && diasProcessados === 0) {
          // Nada novo na fonte: o DEJT continua servindo a mesma edição que já
          // foi lida em rodada anterior. Não é "0 encontrada(s)".
          item.mensagem = edicaoLida
            ? `Edição ${edicaoLida} já processada — nada novo na fonte${sufixoAtraso}`
            : `Edição já processada — nada novo na fonte${sufixoAtraso}`;
        } else if (edicaoLida && atrasoDias > 2) {
          // Portal do DEJT está servindo edição antiga neste tribunal.
          item.mensagem = `Fonte atrasada — edição ${edicaoLida} · ${item.novas + item.duplicatas} encontrada(s) · ${item.novas} nova(s) · ${item.duplicatas} já existente(s)`;
        } else if (edicaoLida) {
          item.mensagem = `Edição ${edicaoLida} · ${item.novas + item.duplicatas} encontrada(s) · ${item.novas} nova(s) · ${item.duplicatas} já existente(s)`;
        } else if (item.novas === 0 && item.duplicatas === 0 && item.diasSemPdf > 0) {
          // Todos os dias da janela vieram sem caderno publicado — não mascarar
          // como "Concluído · 0 nova(s)".
          item.mensagem = item.diasSemPdf === 1
            ? "Caderno ainda não publicado"
            : `Caderno ainda não publicado (${item.diasSemPdf} dia(s))`;
        } else {
          item.mensagem = `Concluído · ${item.novas + item.duplicatas} encontrada(s) · ${item.novas} nova(s) · ${item.duplicatas} já existente(s)`;
        }
      }

      await flushProgresso(true);
    }

    const progressoFinal = buildProgressPayload(itens, datasJanela, ymd);

    await supabase
      .from("execucoes_agendadas")
      .update({
        status: "concluido",
        finalizado_em: new Date().toISOString(),
        registros_encontrados: totalNovas,
        registros_processados: totalNovas + totalDuplicadas,
        erros: totalErros,
        detalhes: { ...filtroDetalhes, novas: totalNovas, duplicadas: totalDuplicadas, duracao_ms: Date.now() - startedAt, progresso: progressoFinal },
      })
      .eq("id", execId);

    if (execucaoServidorId) {
      await supabase
        .from("execucoes_servidor")
        .update({
          status: "concluido",
          finalizado_em: new Date().toISOString(),
          resultado: {
            exec_id: execId,
            encontradas: totalNovas + totalDuplicadas,
            novas: totalNovas,
            duplicadas: totalDuplicadas,
            erros: totalErros,
          },
        })
        .eq("id", execucaoServidorId)
        .neq("status", "cancelado");
    }

    if (aceitarEdicaoVigente) {
      // Persiste o controle de edições já processadas por tribunal e o instante
      // da última verificação — base do alerta de fonte atrasada.
      await supabase
        .from(configTable)
        .update({
          ultima_execucao: new Date().toISOString(),
          metadata: {
            ...configMetadata,
            // Mescla com o histórico: tribunais cortados por "edição já
            // processada" nesta rodada não devem perder o registro anterior.
            edicoes_processadas: {
              ...((configMetadata.edicoes_processadas as Record<string, string> | null) || {}),
              ...edicoesProcessadas,
            },
            edicoes_verificadas_em: new Date().toISOString(),
          },
        })
        .eq("tipo", configTipo);
      await alertarFonteAtrasada(supabase, configTable, configTipo, itens, ymd);
    } else {
      await supabase
        .from(configTable)
        .update({ ultima_execucao: new Date().toISOString() })
        .eq("tipo", configTipo);
    }

  } catch (e) {
    console.error("[DJET-Pautas-Agendado] erro fatal:", e);
    if (execucaoServidorId) {
      await supabase
        .from("execucoes_servidor")
        .update({
          status: "erro",
          finalizado_em: new Date().toISOString(),
          erro: String((e as Error)?.message || e),
          progresso_atualizado_em: new Date().toISOString(),
        })
        .eq("id", execucaoServidorId)
        .neq("status", "cancelado");
    }
    await supabase
      .from("execucoes_agendadas")
      .update({
        status: "falhou",
        finalizado_em: new Date().toISOString(),
        ultimo_erro: String((e as Error)?.message || e),
        detalhes: { ...filtroDetalhes, duracao_ms: Date.now() - startedAt },
      })
      .eq("id", execId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    let force = false;
    let persistMode: "browser" | "servidor" = "browser";
    let execucaoServidorId: string | null = null;
    let dataInicio: string | undefined;
    let dataFim: string | undefined;
    let coordenacaoId: string | null = null;
    let monitoramentoIds: string[] | undefined;
    let reprocessarEdicoes = false;
    try {
      const body = await req.json().catch(() => ({}));
      force = body?.force === true;
      if (body?.persist_mode === "servidor") persistMode = "servidor";
      execucaoServidorId = typeof body?.execucaoServidorId === "string" ? body.execucaoServidorId : null;
      dataInicio = typeof body?.dataInicio === "string" ? body.dataInicio : undefined;
      dataFim = typeof body?.dataFim === "string" ? body.dataFim : undefined;
      coordenacaoId = typeof body?.coordenacaoId === "string" && body.coordenacaoId.trim() ? body.coordenacaoId : null;
      monitoramentoIds = Array.isArray(body?.monitoramentoIds)
        ? body.monitoramentoIds.filter((id: unknown) => typeof id === "string" && id.trim())
        : undefined;
      reprocessarEdicoes = body?.reprocessarEdicoes === true;
    } catch { /* ignore */ }

    // 1) Lê configuração — usa tabela correta conforme modo (servidor vs browser)
    const configTable = persistMode === "servidor" ? "configuracoes_monitoramento_servidor" : "configuracoes_monitoramento";
    const configTipo = persistMode === "servidor" ? "djet_pautas_servidor" : "djet_pautas";
    const { data: cfg, error: cfgErr } = await supabase
      .from(configTable)
      .select("id, ativo, horarios_execucao, metadata")
      .eq("tipo", configTipo)
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    if (!cfg || !cfg.ativo) {
      return new Response(JSON.stringify({ skipped: "inativo", table: configTable, tipo: configTipo }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = brtNow();
    let schedulerSlot: string | null = null;

    // 2) Janela de horário
    if (!force) {
      const wd = brtWeekday(now.ymd);
      const horarios = resolveHorariosDoDia(cfg, wd);
      if (horarios.length === 0) {
        return new Response(JSON.stringify({ skipped: "dia_desativado", weekday: wd }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      schedulerSlot = slotNaJanela(horarios, now.hour, now.minute);
      if (!schedulerSlot) {
        return new Response(JSON.stringify({ skipped: "fora_janela", now: `${now.hour}:${now.minute}`, target: horarios.join(", ") }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) Trava do dia
    const ymdStart = `${now.ymd}T00:00:00-03:00`;
    const ymdEnd = `${now.ymd}T23:59:59-03:00`;
    const tiposExistentes = persistMode === "servidor" ? ["djet_pautas_servidor"] : ["djet_pautas", "djet_pautas_servidor"];
    const { data: existing } = await supabase
      .from("execucoes_agendadas")
      .select("id, status")
      .in("tipo", tiposExistentes)
      .contains("detalhes", { scheduler_slot: schedulerSlot })
      .gte("iniciado_em", ymdStart)
      .lte("iniciado_em", ymdEnd)
      .limit(1);

    if (!force && existing && existing.length > 0) {
      return new Response(JSON.stringify({ skipped: "ja_executou_hoje", status: existing[0].status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Cria registro de execução
    const execucaoTipo = persistMode === "servidor" ? "djet_pautas_servidor" : "djet_pautas";
    const { data: exec, error: execErr } = await supabase
      .from("execucoes_agendadas")
      .insert({
        tipo: execucaoTipo,
        status: "executando",
        iniciado_em: new Date().toISOString(),
        detalhes: {
          scheduler_slot: schedulerSlot,
          filtro: {
            coordenacaoId,
            monitoramentoIds: monitoramentoIds || null,
            persistMode,
            dataInicio: dataInicio || null,
            dataFim: dataFim || null,
          },
        },
      })
      .select("id")
      .single();

    if (execErr || !exec) {
      throw new Error(`falha ao criar execucao_agendada: ${execErr?.message}`);
    }

    // 5) Executa em background (não bloqueia resposta do cron)
    const task = runJob(supabase, exec.id as string, now.ymd, persistMode, configTable, { execucaoServidorId, dataInicio, dataFim, coordenacaoId, monitoramentoIds, schedulerSlot, reprocessarEdicoes });
    // @ts-ignore EdgeRuntime existe no Deno Deploy do Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(task);
    } else {
      task.catch((e) => console.error("[DJET-Pautas-Agendado] task error:", e));
    }

    return new Response(JSON.stringify({ started: true, exec_id: exec.id, tipo: execucaoTipo, ymd: now.ymd }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[DJET-Pautas-Agendado] handler erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});