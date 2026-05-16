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
): Promise<{ novas: number; duplicadas: number }> {
  if (matches.length === 0) return { novas: 0, duplicadas: 0 };
  const seen = new Set<string>();
  const rows = matches.filter((m) => {
    if (seen.has(m.hash)) return false;
    seen.add(m.hash);
    return true;
  }).map((m) => ({
    monitoramento_id: m.monitoramentoId,
    coordenacao_id: monitCoordMap.get(m.monitoramentoId) ?? null,
    hash_conteudo: m.hash,
    data_publicacao: m.dataPublicacao,
    processo_numero: m.processo,
    conteudo: m.conteudo,
    fonte: m.fonte,
    tipo_publicacao: "pauta",
    lida: false,
  }));

  let novas = 0;
  let duplicadas = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("publicacoes_djen")
      .upsert(slice, { onConflict: "coordenacao_id,hash_conteudo", ignoreDuplicates: true })
      .select("id");
    if (error) {
      for (const r of slice) {
        const { error: e2 } = await supabase.from("publicacoes_djen").insert(r);
        if (!e2) novas++; else duplicadas++;
      }
    } else {
      const inseridas = data?.length ?? 0;
      novas += inseridas;
      duplicadas += slice.length - inseridas;
    }
  }
  return { novas, duplicadas };
}

async function runJob(
  supabase: ReturnType<typeof createClient>,
  execId: string,
  ymd: string,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const startedAt = Date.now();
  let totalNovas = 0;
  let totalDuplicadas = 0;
  let totalErros = 0;

  try {
    // Carrega todos os monitoramentos ativos
    const { data: monitsData, error: monitsErr } = await supabase
      .from("monitoramentos_djen")
      .select("id, tipo, termo_busca, oab, uf, ativo, exclusoes, tribunais, condicao_concomitante, coordenacao_id")
      .eq("ativo", true);

    if (monitsErr) throw monitsErr;
    const monits = (monitsData || []) as unknown as Monitoramento[];
    const monitCoordMap = new Map<string, string | null>();
    monits.forEach((m) => monitCoordMap.set(m.id, m.coordenacao_id));

    const dataDDMMYYYY = ymdToDdmmyyyy(ymd);

    for (const tribunal of TRIBUNAIS_DEJT) {
      const monitsTrib = monitsForTribunal(monits, tribunal);
      const monsInput = monitsTrib.map(monitToInput).filter((m) => m.termos.length > 0 || m.oab);
      if (monsInput.length === 0) continue;

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/buscar-dejt-pautas`, {
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

        if (!resp.ok) {
          totalErros++;
          console.error(`[DJET-Pautas-Agendado] ${tribunal}: HTTP ${resp.status}`);
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
        const { novas, duplicadas } = await persistMatches(supabase, matches, monitCoordMap);
        totalNovas += novas;
        totalDuplicadas += duplicadas;
        console.log(`[DJET-Pautas-Agendado] ${tribunal}: ${matches.length} matches → ${novas} novas / ${duplicadas} dup`);
      } catch (e) {
        totalErros++;
        console.error(`[DJET-Pautas-Agendado] ${tribunal} erro:`, e);
      }

      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_TRIBUNAIS_MS));
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

    await supabase
      .from("configuracoes_monitoramento")
      .update({ ultima_execucao: new Date().toISOString() })
      .eq("tipo", "djet_pautas");
  } catch (e) {
    console.error("[DJET-Pautas-Agendado] erro fatal:", e);
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
    try {
      const body = await req.json().catch(() => ({}));
      force = body?.force === true;
    } catch { /* ignore */ }

    // 1) Lê configuração
    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracoes_monitoramento")
      .select("id, ativo, horarios_execucao")
      .eq("tipo", "djet_pautas")
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    if (!cfg || !cfg.ativo) {
      return new Response(JSON.stringify({ skipped: "inativo" }), {
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
    const task = runJob(supabase, exec.id as string, now.ymd);
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