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
  }));
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
      data_disponibilizacao: m.dataPublicacao,
      data_publicacao: calcularDataPublicacaoYmd(m.dataPublicacao),
      processo_numero: m.processo,
      conteudo: m.conteudo,
      fonte: m.fonte,
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
  options: { execucaoServidorId?: string | null; dataInicio?: string; dataFim?: string } = {},
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
  let lastFlush = 0;
  const flushProgressoServidor = async (force = false) => {
    if (!execucaoServidorId) return;
    const now = Date.now();
    if (!force && now - lastFlush < 700) return;
    lastFlush = now;
    const concluidos = itens.filter((i) => ["concluido", "erro", "cancelado"].includes(i.status)).length;
    const falhas = itens.filter((i) => i.status === "erro").length;
    const atual = itens.find((i) => i.status === "executando") || null;
    await supabase
      .from("execucoes_servidor")
      .update({
        status: "executando",
        finalizado_em: null,
        erro: null,
        progresso: {
          totalItens: itens.length,
          concluidos,
          falhas,
          atual: atual ? { id: atual.id, label: atual.label } : null,
          itens: itens.slice(-200),
          janela: { dataInicio: datasJanela[0] || ymd, dataFim: datasJanela[datasJanela.length - 1] || ymd },
        },
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
    const monits = (monitsData || []) as unknown as Monitoramento[];
    const monitCoordMap = new Map<string, string | null>();
    monits.forEach((m) => monitCoordMap.set(m.id, m.coordenacao_id));

    await flushProgressoServidor(true);

    for (const tribunal of TRIBUNAIS_DEJT) {
      const item = itens.find((i) => i.id === tribunal)!;
      const monitsTrib = monitsForTribunal(monits, tribunal);
      const monsInput = monitsTrib.map(monitToInput).filter((m) => m.termos.length > 0 || m.oab);
      item.status = "executando";
      item.mensagem = monsInput.length === 0 ? "Sem monitoramentos para este tribunal" : "Iniciando...";
      await flushProgressoServidor(true);
      if (monsInput.length === 0) {
        item.status = "concluido";
        item.current = item.total;
        item.mensagem = "Sem monitoramentos aplicáveis";
        await flushProgressoServidor(true);
        continue;
      }

      for (const dataYmd of datasJanela) {
        if (await isExecucaoServidorCancelada(supabase, execucaoServidorId)) {
          for (const it of itens.filter((i) => i.status === "pendente" || i.status === "executando")) {
            it.status = "cancelado";
            it.mensagem = "Cancelado pelo usuário";
          }
          await flushProgressoServidor(true);
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
          await flushProgressoServidor();
          continue;
        }
        try {
          // Retry transiente (HTTP 5xx) — DEJT às vezes devolve 546/503.
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
          }),
            });
            lastStatus = resp.status;
            if (resp.ok) break;
            // 5xx ou 546 (timeout custom) → retenta
            if (resp.status >= 500 || resp.status === 546) {
              await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
              continue;
            }
            break;
          }
          if (!resp || !resp.ok) {
            totalErros++;
            item.current += 1;
            item.ultimoErro = `HTTP ${lastStatus}`;
            item.mensagem = `Erro HTTP ${lastStatus} em ${dataDDMMYYYY}`;
            await flushProgressoServidor(true);
            console.error(`[DJET-Pautas-Agendado] ${tribunal} ${dataDDMMYYYY}: HTTP ${lastStatus}`);
            continue;
          }
          const json = await resp.json();
          const matches: MatchOut[] = (json?.matches || []).map((m: Record<string, unknown>) => ({
          monitoramentoId: m.monitoramentoId as string,
          termoMatch: m.termoMatch as string,
          processo: (m.processo as string) ?? null,
          conteudo: m.conteudo as string,
          hash: m.hash as string,
          dataPublicacao: m.dataPublicacao as string,
          fonte: (m.fonte as string) || "dejt-pdf",
          tribunal: (m.tribunal as string) || tribunal,
        }));
          const { novas, duplicadas } = await persistMatches(supabase, matches, monitCoordMap, persistMode, execucaoServidorId);
          totalNovas += novas;
          totalDuplicadas += duplicadas;
          item.current += 1;
          item.novas += novas;
          item.duplicatas += duplicadas;
          item.mensagem = `${dataDDMMYYYY}: ${matches.length} achado(s) · ${novas} nova(s)`;
          await flushProgressoServidor();
          console.log(`[DJET-Pautas-Agendado] ${tribunal} ${dataDDMMYYYY}: ${matches.length} matches → ${novas} novas / ${duplicadas} dup`);
        } catch (e) {
          totalErros++;
          item.current += 1;
          item.ultimoErro = String((e as Error)?.message || e).slice(0, 200);
          item.mensagem = `Erro em ${dataDDMMYYYY}`;
          await flushProgressoServidor(true);
          console.error(`[DJET-Pautas-Agendado] ${tribunal} ${dataDDMMYYYY} erro:`, e);
        }

        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_TRIBUNAIS_MS));
      }
      // Tribunal finalizado: marca concluído (mesmo que tenha tido erros em dias específicos).
      if (item.status !== "cancelado") {
        item.status = "concluido";
        item.mensagem = `Concluído · ${item.novas} nova(s)` + (item.ultimoErro ? ` · último erro: ${item.ultimoErro}` : "");
      }
      await flushProgressoServidor(true);
    }

    await supabase
      .from("execucoes_agendadas")
      .update({
        status: "concluido",
        finalizado_em: new Date().toISOString(),
        registros_encontrados: totalNovas,
        registros_processados: totalNovas + totalDuplicadas,
        erros: totalErros,
        detalhes: { novas: totalNovas, duplicadas: totalDuplicadas, duracao_ms: Date.now() - startedAt },
      })
      .eq("id", execId);

    await flushProgressoServidor(true);

    if (execucaoServidorId) {
      await supabase
        .from("execucoes_servidor")
        .update({
          status: "concluido",
          finalizado_em: new Date().toISOString(),
          resultado: { exec_id: execId, novas: totalNovas, duplicadas: totalDuplicadas, erros: totalErros },
        })
        .eq("id", execucaoServidorId)
        .neq("status", "cancelado");
    }

    await supabase
      .from(configTable)
      .update({ ultima_execucao: new Date().toISOString() })
      .eq("tipo", persistMode === "servidor" ? "djet_pautas_servidor" : "djet_pautas");
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
        detalhes: { duracao_ms: Date.now() - startedAt },
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
    try {
      const body = await req.json().catch(() => ({}));
      force = body?.force === true;
      if (body?.persist_mode === "servidor") persistMode = "servidor";
      execucaoServidorId = typeof body?.execucaoServidorId === "string" ? body.execucaoServidorId : null;
      dataInicio = typeof body?.dataInicio === "string" ? body.dataInicio : undefined;
      dataFim = typeof body?.dataFim === "string" ? body.dataFim : undefined;
    } catch { /* ignore */ }

    // 1) Lê configuração — usa tabela correta conforme modo (servidor vs browser)
    const configTable = persistMode === "servidor" ? "configuracoes_monitoramento_servidor" : "configuracoes_monitoramento";
    const configTipo = persistMode === "servidor" ? "djet_pautas_servidor" : "djet_pautas";
    const { data: cfg, error: cfgErr } = await supabase
      .from(configTable)
      .select("id, ativo, horarios_execucao")
      .eq("tipo", configTipo)
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    if (!cfg || !cfg.ativo) {
      return new Response(JSON.stringify({ skipped: "inativo", table: configTable, tipo: configTipo }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = brtNow();

    // 2) Janela de horário
    if (!force) {
      const wd = brtWeekday(now.ymd);
      const horario = resolveHorarioDoDia(cfg.horarios_execucao as (string | null)[] | null, wd);
      if (!horario) {
        return new Response(JSON.stringify({ skipped: "dia_desativado", weekday: wd }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [hh, mm] = horario.split(":").map(Number);
      if (isNaN(hh) || isNaN(mm)) {
        return new Response(JSON.stringify({ skipped: "horario_invalido" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const nowMin = now.hour * 60 + now.minute;
      const tgtMin = hh * 60 + mm;
      if (nowMin < tgtMin || nowMin > tgtMin + WINDOW_MIN) {
        return new Response(JSON.stringify({ skipped: "fora_janela", now: `${now.hour}:${now.minute}`, target: horario }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) Trava do dia
    const ymdStart = `${now.ymd}T00:00:00-03:00`;
    const ymdEnd = `${now.ymd}T23:59:59-03:00`;
    const { data: existing } = await supabase
      .from("execucoes_agendadas")
      .select("id, status")
      .eq("tipo", "djet_pautas")
      .gte("iniciado_em", ymdStart)
      .lte("iniciado_em", ymdEnd)
      .limit(1);

    if (!force && existing && existing.length > 0) {
      return new Response(JSON.stringify({ skipped: "ja_executou_hoje", status: existing[0].status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Cria registro de execução
    const { data: exec, error: execErr } = await supabase
      .from("execucoes_agendadas")
      .insert({
        tipo: "djet_pautas",
        status: "executando",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (execErr || !exec) {
      throw new Error(`falha ao criar execucao_agendada: ${execErr?.message}`);
    }

    // 5) Executa em background (não bloqueia resposta do cron)
    const task = runJob(supabase, exec.id as string, now.ymd, persistMode, configTable, { execucaoServidorId, dataInicio, dataFim });
    // @ts-ignore EdgeRuntime existe no Deno Deploy do Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(task);
    } else {
      task.catch((e) => console.error("[DJET-Pautas-Agendado] task error:", e));
    }

    return new Response(JSON.stringify({ started: true, exec_id: exec.id, ymd: now.ymd }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[DJET-Pautas-Agendado] handler erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});