// Dispatcher DJEN Servidor — enfileira jobs conforme configuracoes_monitoramento_servidor
// Executado pelo pg_cron a cada 5 minutos. Idempotente por hora via dedupe_key.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Cfg = {
  id: string;
  tipo: string;
  frequencia: string;
  ativo: boolean;
  horarios_execucao: string[] | null;
  ultima_execucao: string | null;
  metadata: Record<string, unknown> | null;
};

function nowSP(): Date {
  // America/Sao_Paulo (UTC-3, sem DST atualmente)
  const offsetMin = -180;
  const now = new Date();
  return new Date(now.getTime() + (offsetMin - now.getTimezoneOffset()) * 60000);
}

function matchSlot(cfg: Cfg, sp: Date): string | null {
  const horarios = cfg.horarios_execucao || [];
  for (const h of horarios) {
    const [hh, mm] = h.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const slot = hh * 60 + mm;
    const cur = sp.getHours() * 60 + sp.getMinutes();
    if (cur >= slot && cur < slot + 5) return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  }
  return null;
}

function shouldDispatch(cfg: Cfg, sp: Date): boolean {
  if (!cfg.ativo) return false;
  // Dias da semana (0=Dom..6=Sáb). Default Seg-Sex se ausente.
  const dias = Array.isArray((cfg.metadata as any)?.dias_semana)
    ? ((cfg.metadata as any).dias_semana as number[])
    : [1, 2, 3, 4, 5];
  if (!dias.includes(sp.getDay())) return false;
  const last = cfg.ultima_execucao ? new Date(cfg.ultima_execucao) : null;

  if (cfg.frequencia === "30min") {
    if (!last) return true;
    return Date.now() - last.getTime() >= 30 * 60 * 1000 - 60_000;
  }
  if (cfg.frequencia === "15min") {
    if (!last) return true;
    return Date.now() - last.getTime() >= 15 * 60 * 1000 - 60_000;
  }
  // diario: dispara se horário cadastrado está dentro do tick atual (janela 5 min)
  const horarios = cfg.horarios_execucao || [];
  for (const h of horarios) {
    const [hh, mm] = h.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const slot = hh * 60 + mm;
    const cur = sp.getHours() * 60 + sp.getMinutes();
    if (cur >= slot && cur < slot + 5) {
      // não disparar mais de uma vez no mesmo dia para o mesmo slot
      if (last) {
        const lastSp = new Date(last.getTime() - 3 * 60 * 60 * 1000);
        if (
          lastSp.getUTCDate() === sp.getDate() &&
          lastSp.getUTCMonth() === sp.getMonth() &&
          lastSp.getUTCHours() === hh
        ) continue;
      }
      return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Reset jobs órfãos
  await sb.rpc("reset_jobs_orfaos_servidor", { p_timeout_minutes: 5 });

  // 2) Carrega configs ativas
  const { data: cfgs, error } = await sb
    .from("configuracoes_monitoramento_servidor")
    .select("id, tipo, frequencia, ativo, horarios_execucao, ultima_execucao, metadata")
    .eq("ativo", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sp = nowSP();
  const enfileirados: string[] = [];
  for (const cfg of (cfgs || []) as Cfg[]) {
    if (!shouldDispatch(cfg, sp)) continue;
    // Calcula rodada do dia e slot horário para visibilidade no Análise DJEN
    const startBrt = new Date(sp);
    startBrt.setHours(0, 0, 0, 0);
    const startUtcIso = new Date(startBrt.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const { count: execHoje } = await sb
      .from("execucoes_servidor")
      .select("id", { count: "exact", head: true })
      .eq("tipo", cfg.tipo)
      .gte("agendado_para", startUtcIso);
    const rodada = (execHoje ?? 0) + 1;
    const slot = matchSlot(cfg, sp);
    const { data: jobId } = await sb.rpc("enfileirar_execucao_servidor", {
      p_tipo: cfg.tipo,
      p_agendado_para: new Date().toISOString(),
      p_payload: {},
      p_rodada: rodada,
      p_slot: slot,
    });
    if (jobId) {
      enfileirados.push(`${cfg.tipo}:${jobId}:r${rodada}${slot ? `@${slot}` : ""}`);
      await sb
        .from("configuracoes_monitoramento_servidor")
        .update({ ultima_execucao: new Date().toISOString() })
        .eq("id", cfg.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, enfileirados, sp: sp.toISOString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});