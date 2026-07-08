import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Config {
  id: string;
  coordenacao_id: string;
  tipo_tarefa: string;
  canal_email: boolean;
  canal_whatsapp: boolean;
  dias_antes: number[];
  destinatarios_ids: string[];
  ativo: boolean;
}

// Data "hoje" em BRT (UTC-3), independente do fuso do runtime da edge function.
function hojeBRT(): { ymd: string; year: number; month: number; day: number } {
  const agoraUtcMs = Date.now();
  const brtMs = agoraUtcMs - 3 * 60 * 60 * 1000;
  const d = new Date(brtMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { ymd, year: y, month: m, day };
}

// Soma N dias a uma data BRT e retorna { ymd, rangeUtcInicio, rangeUtcFim }
// rangeUtcInicio = 00:00 BRT do dia alvo em UTC = YYYY-MM-DDT03:00:00Z
// rangeUtcFim    = 23:59:59.999 BRT do dia alvo em UTC = YYYY-MM-(DD+1)T02:59:59.999Z
function alvoBRT(nDias: number): { ymd: string; rangeUtcInicio: string; rangeUtcFim: string; dataStrBR: string } {
  const base = hojeBRT();
  const baseUtc = Date.UTC(base.year, base.month - 1, base.day);
  const alvoUtc = baseUtc + nDias * 24 * 60 * 60 * 1000;
  const d = new Date(alvoUtc);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Início BRT 00:00 = 03:00 UTC do mesmo dia
  const rangeUtcInicio = `${ymd}T03:00:00.000Z`;
  // Fim BRT 23:59:59.999 = 02:59:59.999 UTC do dia seguinte
  const fimMs = alvoUtc + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 - 1;
  const rangeUtcFim = new Date(fimMs).toISOString();
  const dataStrBR = `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  return { ymd, rangeUtcInicio, rangeUtcFim, dataStrBR };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const hoje = hojeBRT();
    console.log(`[alertas-tarefas] Executando para data BRT: ${hoje.ymd}`);

    const { data: configsData, error: cfgErr } = await supabase
      .from("config_envio_alertas_tarefas")
      .select("*")
      .eq("ativo", true);
    if (cfgErr) throw cfgErr;
    const configs = (configsData ?? []) as Config[];

    let totalEnviados = 0;
    let totalFalhas = 0;
    const detalhes: any[] = [];

    for (const cfg of configs) {
      if (!cfg.canal_email && !cfg.canal_whatsapp) continue;
      if (!cfg.destinatarios_ids?.length) continue;

      // Buscar destinatários (email + telefone)
      const { data: dests } = await supabase
        .from("profiles")
        .select("id, nome, email, telefone")
        .in("id", cfg.destinatarios_ids);
      if (!dests?.length) continue;

      for (const nDias of cfg.dias_antes) {
        const alvoInfo = alvoBRT(nDias);
        const alvo = alvoInfo.ymd;
        const alvoIni = alvoInfo.rangeUtcInicio;
        const alvoFim = alvoInfo.rangeUtcFim;

        const itens: Array<{ id: string; titulo: string; data: string; hora?: string | null; processo?: string | null; origem: string }> = [];

        // 1) Tarefas (data_vencimento é date — comparação direta em BRT)
        const { data: tarefas } = await supabase
          .from("tarefas")
          .select("id, titulo, data_vencimento, hora_prevista, processo:processos!inner(numero, coordenacao_id)")
          .eq("tipo_tarefa", cfg.tipo_tarefa)
          .eq("processo.coordenacao_id", cfg.coordenacao_id)
          .eq("data_vencimento", alvo)
          .neq("status", "concluida");
        (tarefas ?? []).forEach((t: any) => itens.push({
          id: t.id, titulo: t.titulo, data: t.data_vencimento, hora: t.hora_prevista,
          processo: t.processo?.numero, origem: "tarefa",
        }));

        // 2) Audiências detectadas — data_audiencia é timestamptz, filtrar por range BRT
        if (cfg.tipo_tarefa === "AUDIÊNCIA") {
          const { data: audiencias } = await supabase
            .from("audiencias_detectadas")
            .select("id, processo_numero, data_audiencia, hora, cliente, status")
            .eq("coordenacao_id", cfg.coordenacao_id)
            .gte("data_audiencia", alvoIni)
            .lte("data_audiencia", alvoFim)
            .not("status", "in", "(tratado,ignorado,cancelado)");
          (audiencias ?? []).forEach((a: any) => itens.push({
            id: a.id, titulo: `Audiência ${a.cliente ?? a.processo_numero ?? ""}`.trim(),
            data: a.data_audiencia, hora: a.hora, processo: a.processo_numero, origem: "audiencia",
          }));
        }

        // 3) Eventos — data_inicio timestamptz, range BRT
        if (cfg.tipo_tarefa === "OUTROS") {
          const { data: eventos } = await supabase
            .from("eventos_agenda")
            .select("id, titulo, data_inicio, status, processo:processos!inner(coordenacao_id)")
            .eq("processo.coordenacao_id", cfg.coordenacao_id)
            .gte("data_inicio", alvoIni)
            .lte("data_inicio", alvoFim)
            .neq("status", "concluido");
          (eventos ?? []).forEach((e: any) => itens.push({
            id: e.id, titulo: e.titulo, data: (e.data_inicio ?? "").slice(0, 10), origem: "evento",
          }));
        }

        if (itens.length === 0) continue;

        // Montar mensagem (data BRT dd/MM/yyyy)
        const dataStr = alvoInfo.dataStrBR;
        const linhas = itens.slice(0, 30).map((i) => {
          const h = i.hora ? ` às ${i.hora}` : "";
          const p = i.processo ? ` — ${i.processo}` : "";
          return `• ${i.titulo}${h}${p}`;
        }).join("\n");
        const cabecalho = nDias === 0
          ? `📅 Alertas para HOJE (${dataStr}) — ${cfg.tipo_tarefa}`
          : `⏰ Alertas para ${dataStr} (em ${nDias} dia${nDias > 1 ? "s" : ""}) — ${cfg.tipo_tarefa}`;
        const corpoTexto = `${cabecalho}\n\n${linhas}\n\nTotal: ${itens.length} item(ns)`;

        // Enviar por canal para cada destinatário
        for (const d of dests) {
          // Dedupe
          const refKey = `${cfg.id}:${alvo}:${nDias}`;

          if (cfg.canal_whatsapp && d.telefone) {
            try {
              const { data: jaEnviado } = await supabase
                .from("historico_alertas_enviados")
                .select("id")
                .eq("coordenacao_id", cfg.coordenacao_id)
                .eq("canal", "whatsapp")
                .eq("destinatario", d.telefone)
                .eq("referencia_id", refKey)
                .maybeSingle();
              if (!jaEnviado) {
                const resp = await supabase.functions.invoke("enviar-whatsapp-zapi", {
                  body: { telefones: [d.telefone], mensagem: corpoTexto, tipo: "lembrete" },
                });
                const ok = !resp.error;
                await supabase.from("historico_alertas_enviados").insert({
                  coordenacao_id: cfg.coordenacao_id,
                  tipo_alerta: cfg.tipo_tarefa,
                  canal: "whatsapp",
                  destinatario: d.telefone,
                  conteudo: corpoTexto.slice(0, 2000),
                  referencia_id: refKey,
                  status: ok ? "enviado" : "falha",
                  erro: ok ? null : String(resp.error?.message ?? "erro"),
                });
                if (ok) totalEnviados++; else totalFalhas++;
              }
            } catch (e) {
              console.error("whatsapp err", e);
              totalFalhas++;
            }
          }

          if (cfg.canal_email && d.email) {
            try {
              const { data: jaEnviado } = await supabase
                .from("historico_alertas_enviados")
                .select("id")
                .eq("coordenacao_id", cfg.coordenacao_id)
                .eq("canal", "email")
                .eq("destinatario", d.email)
                .eq("referencia_id", refKey)
                .maybeSingle();
              if (!jaEnviado) {
                // Grava no histórico — envio efetivo depende de provider já configurado no projeto.
                // Se não houver provider de e-mail próprio, este item permanece "pendente" para revisão.
                await supabase.from("historico_alertas_enviados").insert({
                  coordenacao_id: cfg.coordenacao_id,
                  tipo_alerta: cfg.tipo_tarefa,
                  canal: "email",
                  destinatario: d.email,
                  conteudo: corpoTexto.slice(0, 2000),
                  referencia_id: refKey,
                  status: "pendente",
                  erro: "Envio de e-mail requer configuração de provider",
                });
              }
            } catch (e) {
              console.error("email err", e);
              totalFalhas++;
            }
          }
        }

        detalhes.push({ config: cfg.id, tipo: cfg.tipo_tarefa, dias_antes: nDias, itens: itens.length });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, totalEnviados, totalFalhas, detalhes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("Falha geral:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
