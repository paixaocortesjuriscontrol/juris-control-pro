// Alerta de diferença entre execuções do DJEN Termos (somente motor Termos).
// Compara cada execução concluída de Termos do dia (BRT) com a execução de
// Termos imediatamente anterior do mesmo dia, por coordenação. Quando houver
// publicações novas, envia e-mail aos coordenadores da coordenação e um
// consolidado aos administradores. Idempotente via
// public.alertas_diferenca_execucoes_djen.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://juriscontrol.adv.br";
const FROM = "Juris Control <alerta@juriscontrol.adv.br>";

/** "YYYY-MM-DD" do dia atual em BRT (America/Sao_Paulo, UTC-3). */
function hojeBrtYmd(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Janela UTC de um dia BRT: [ymd 03:00Z, ymd+1 03:00Z). */
function janelaBrt(ymd: string): { startUtc: string; endUtc: string } {
  const start = `${ymd}T03:00:00`;
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const next = d.toISOString().slice(0, 10);
  return { startUtc: start, endUtc: `${next}T03:00:00` };
}

function horaBrt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "--:--";
  }
}

function dataBr(ymd: string): string {
  return ymd.split("-").reverse().join("/");
}

type Exec = {
  id: string;
  iniciado_em: string;
  tipo: string;
  fonte: "servidor" | "local";
};

type LinhaCoord = {
  coordenacaoId: string;
  nome: string;
  /** Publicações novas efetivamente gravadas na janela da execução. */
  diferenca: number;
  /** Total do dia da coordenação (mesma base da tela Análise DJEN). */
  totalDia: number;
};

function isTermos(tipo: string): boolean {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("pauta") || t.includes("stf") || t.includes("kurier")) return false;
  if (t.includes("processo")) return false;
  return t.includes("paralela");
}

function emailBase(titulo: string, subtitulo: string, corpo: string): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
    <div style="background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0; font-size: 18px;">${titulo}</h2>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 13px;">${subtitulo}</p>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      ${corpo}
      <p style="margin: 20px 0 0 0;">
        <a href="${APP_URL}/analise-djen" style="display:inline-block;background:#1E40AF;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:13px;">Abrir Análise DJEN</a>
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Enviado automaticamente pelo Juris Control Pro · horários em BRT (Brasília).
      </p>
    </div>
  </div>`;
}

function tabelaLinhas(linhas: LinhaCoord[], mostrarCoordenacao: boolean): string {
  const cabecalho = `
    <tr style="background:#F3F4F6;">
      ${mostrarCoordenacao ? '<th align="left" style="padding:8px;font-size:13px;">Coordenação</th>' : ""}
      <th align="center" style="padding:8px;font-size:13px;">Novas publicações</th>
      <th align="center" style="padding:8px;font-size:13px;">Total do dia</th>
    </tr>`;
  const corpo = linhas
    .map(
      (l) => `
      <tr>
        ${mostrarCoordenacao ? `<td style="padding:8px;border-top:1px solid #e5e7eb;font-size:13px;">${l.nome}</td>` : ""}
        <td align="center" style="padding:8px;border-top:1px solid #e5e7eb;font-size:13px;color:#047857;font-weight:bold;">+${l.diferenca}</td>
        <td align="center" style="padding:8px;border-top:1px solid #e5e7eb;font-size:13px;">${l.totalDia}</td>
      </tr>`,
    )
    .join("");
  return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;">${cabecalho}${corpo}</table>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dryRun = body?.dryRun === true;
  const ymd: string = typeof body?.dataYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dataYmd)
    ? body.dataYmd
    : hojeBrtYmd();

  const { startUtc, endUtc } = janelaBrt(ymd);
  const log = (msg: string, extra: unknown = "") =>
    console.log(`[alertar-diferenca-djen-termos] ${msg}`, extra ?? "");

  try {
    // 1) Execuções de Termos concluídas do dia (BRT), em ordem cronológica.
    const [servRes, locaisRes] = await Promise.all([
      supabase
        .from("execucoes_servidor")
        .select("id, tipo, iniciado_em, resultado, status")
        .gte("iniciado_em", startUtc)
        .lt("iniciado_em", endUtc)
        .eq("status", "concluido")
        .order("iniciado_em", { ascending: true }),
      supabase
        .from("execucoes_agendadas")
        .select("id, tipo, iniciado_em")
        .gte("iniciado_em", startUtc)
        .lt("iniciado_em", endUtc)
        .order("iniciado_em", { ascending: true }),
    ]);

    const execsServidor: Exec[] = (servRes.data || [])
      .filter((e: any) => isTermos(e.tipo))
      .filter((e: any) => {
        const di = e?.resultado?.dataInicio as string | undefined;
        return !di || di === ymd;
      })
      .map((e: any) => ({ id: e.id, iniciado_em: e.iniciado_em, tipo: e.tipo, fonte: "servidor" as const }));

    const execsLocais: Exec[] = (locaisRes.data || [])
      .filter((e: any) => isTermos(e.tipo))
      .map((e: any) => ({ id: e.id, iniciado_em: e.iniciado_em, tipo: e.tipo, fonte: "local" as const }));

    const execucoes = [...execsServidor, ...execsLocais]
      .filter((e) => !!e.iniciado_em)
      .sort((a, b) => (a.iniciado_em < b.iniciado_em ? -1 : a.iniciado_em > b.iniciado_em ? 1 : 0));

    log(`dia ${ymd} | execuções Termos: ${execucoes.length}`);

    if (execucoes.length < 2) {
      return new Response(
        JSON.stringify({ success: true, dia: ymd, execucoes: execucoes.length, status: "sem_comparacao" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Publicações do dia efetivamente gravadas (mesma base da tela Análise DJEN:
    //    publicacoes_djen; as descartadas vivem em outra tabela e já ficam de fora).
    //    Guardamos created_at + coordenação para contar somente o que é NOVO em cada
    //    janela de execução — revínculos de publicações antigas não contam mais.
    type PubDia = { createdAt: string; coordId: string };
    const pubsDia: PubDia[] = [];
    const coordIds = new Set<string>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("publicacoes_djen")
        .select("id, created_at, monitoramento:monitoramentos_djen!inner(coordenacao_id)")
        .gte("created_at", startUtc)
        .lt("created_at", endUtc)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        log("erro ao carregar publicacoes_djen", error);
        break;
      }
      for (const r of data || []) {
        const coordId = (r as any)?.monitoramento?.coordenacao_id as string | null | undefined;
        if (!coordId || !r.created_at) continue;
        coordIds.add(coordId);
        pubsDia.push({ createdAt: r.created_at as string, coordId });
      }
      if (!data || data.length < PAGE) break;
    }

    // Total do dia por coordenação
    const totalDiaPorCoord = new Map<string, number>();
    for (const p of pubsDia) {
      totalDiaPorCoord.set(p.coordId, (totalDiaPorCoord.get(p.coordId) || 0) + 1);
    }

    /** Novas publicações por coordenação na janela [inicio, fim). */
    const novasNaJanela = (inicio: string, fim: string): Map<string, number> => {
      const m = new Map<string, number>();
      const ini = new Date(inicio).getTime();
      const end = new Date(fim).getTime();
      for (const p of pubsDia) {
        const t = new Date(p.createdAt).getTime();
        if (t >= ini && t < end) m.set(p.coordId, (m.get(p.coordId) || 0) + 1);
      }
      return m;
    };

    log(`publicações do dia carregadas: ${pubsDia.length}`);

    // Nomes das coordenações
    const nomes = new Map<string, string>();
    if (coordIds.size > 0) {
      const { data: coords } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .in("id", Array.from(coordIds));
      for (const c of coords || []) nomes.set(c.id as string, (c.nome as string) || "(sem nome)");
    }

    // 3) Já notificados
    const { data: jaEnviados } = await supabase
      .from("alertas_diferenca_execucoes_djen")
      .select("execucao_id, coordenacao_id")
      .in("execucao_id", execucoes.map((e) => e.id));
    const enviadoKey = new Set(
      (jaEnviados || []).map((r: any) => `${r.execucao_id}|${r.coordenacao_id ?? "__admin__"}`),
    );

    // 4) Admins (destinatários fixos)
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (adminRoles || []).map((r: any) => r.user_id).filter(Boolean);
    let adminEmails: string[] = [];
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", adminIds);
      adminEmails = (adminProfiles || []).map((p: any) => p.email).filter(Boolean);
    }

    const enviarEmail = async (to: string[], subject: string, html: string) => {
      const destinatarios = Array.from(new Set(to.filter(Boolean)));
      if (destinatarios.length === 0) return 0;
      if (dryRun || !RESEND_API_KEY) {
        log(`dryRun/no-key: e-mail não enviado (${destinatarios.length} destinatários) | ${subject}`);
        return 0;
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: FROM, to: destinatarios, subject, html }),
      });
      if (!res.ok) {
        log(`erro Resend [${res.status}]`, await res.text());
        return 0;
      }
      return destinatarios.length;
    };

    const resultados: any[] = [];

    // 5) Para cada execução (a partir da 2ª), compara com a anterior de Termos
    for (let i = 1; i < execucoes.length; i++) {
      const atual = execucoes[i];
      const anterior = execucoes[i - 1];
      const horaAtual = horaBrt(atual.iniciado_em);
      const horaAnterior = horaBrt(anterior.iniciado_em);

      // Janela da execução atual: do seu próprio início até o início da próxima
      // execução (ou fim do dia BRT, se for a última). Assim contamos apenas as
      // publicações gravadas por ESTA execução.
      const fimJanela = i + 1 < execucoes.length ? execucoes[i + 1].iniciado_em : endUtc;
      const mapNovas = novasNaJanela(atual.iniciado_em, fimJanela);

      const linhas: LinhaCoord[] = [];
      for (const [coordId, novas] of mapNovas) {
        if (novas <= 0) continue;
        linhas.push({
          coordenacaoId: coordId,
          nome: nomes.get(coordId) || "(sem nome)",
          diferenca: novas,
          totalDia: totalDiaPorCoord.get(coordId) || novas,
        });
      }
      linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

      if (linhas.length === 0) {
        resultados.push({ execucao: atual.id, hora: horaAtual, status: "sem_diferenca" });
        continue;
      }

      // 5a) E-mail por coordenação
      for (const linha of linhas) {
        if (enviadoKey.has(`${atual.id}|${linha.coordenacaoId}`)) {
          resultados.push({ execucao: atual.id, coordenacao: linha.nome, status: "ja_enviado" });
          continue;
        }

        // Todos os membros da coordenação (titular + membros alocados)
        const destinoIds = new Set<string>();
        const { data: coordRow } = await supabase
          .from("coordenacoes")
          .select("coordenador_id")
          .eq("id", linha.coordenacaoId)
          .maybeSingle();
        if (coordRow?.coordenador_id) destinoIds.add(coordRow.coordenador_id as string);

        const { data: membros } = await supabase
          .from("membros_coordenacao")
          .select("usuario_id")
          .eq("coordenacao_id", linha.coordenacaoId);
        for (const m of membros || []) {
          if ((m as any).usuario_id) destinoIds.add((m as any).usuario_id as string);
        }

        let emails: string[] = [];
        if (destinoIds.size > 0) {
          const { data: perfis } = await supabase
            .from("profiles")
            .select("id, email, ativo")
            .eq("ativo", true)
            .in("id", Array.from(destinoIds));
          emails = (perfis || []).map((p: any) => p.email).filter(Boolean);
        }

        const corpo = `
          <div style="background-color:#EFF6FF;padding:14px;border-radius:8px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;">
              A execução do <strong>DJEN Termos</strong> das <strong>${horaAtual}</strong> gravou
              <strong style="color:#047857;">+${linha.diferenca}</strong>
              ${linha.diferenca === 1 ? "nova publicação" : "novas publicações"} desde a execução das
              <strong>${horaAnterior}</strong>. Total do dia da coordenação:
              <strong>${linha.totalDia}</strong>.
            </p>
          </div>
          <p style="margin:0 0 8px 0;font-size:13px;color:#374151;">
            Coordenação: <strong>${linha.nome}</strong> · Dia: <strong>${dataBr(ymd)}</strong>
          </p>
          ${tabelaLinhas([linha], false)}
          <p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;">
            O "Total do dia" é o número de publicações gravadas hoje para a coordenação. Na tela
            Análise DJEN o número exibido pode ser menor, pois lá as publicações idênticas são
            agrupadas (deduplicação) e as descartadas não aparecem.
          </p>`;

        const enviados = await enviarEmail(
          emails,
          "Publicações DJEN - Alerta - Diferença entre execuções",
          emailBase(
            "DJEN Termos — diferença entre execuções",
            `${linha.nome} · ${dataBr(ymd)} · execução das ${horaAtual} (BRT)`,
            corpo,
          ),
        );

        if (!dryRun) {
          await supabase.from("alertas_diferenca_execucoes_djen").insert({
            execucao_id: atual.id,
            fonte: atual.fonte,
            coordenacao_id: linha.coordenacaoId,
            diferenca: linha.diferenca,
            total_anterior: Math.max(linha.totalDia - linha.diferenca, 0),
            total_atual: linha.totalDia,
            destinatarios: enviados,
            dia_ymd: ymd,
          });
          enviadoKey.add(`${atual.id}|${linha.coordenacaoId}`);
        }

        resultados.push({
          execucao: atual.id,
          hora: horaAtual,
          coordenacao: linha.nome,
          diferenca: linha.diferenca,
          emails: enviados,
          status: "enviado",
        });
      }

      // 5b) Consolidado para administradores
      if (!enviadoKey.has(`${atual.id}|__admin__`)) {
        const totalDif = linhas.reduce((a, l) => a + l.diferenca, 0);
        const corpoAdmin = `
          <div style="background-color:#EFF6FF;padding:14px;border-radius:8px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;">
              A execução do <strong>DJEN Termos</strong> das <strong>${horaAtual}</strong> gravou
              <strong style="color:#047857;">+${totalDif}</strong>
              ${totalDif === 1 ? "nova publicação" : "novas publicações"} desde a execução das
              <strong>${horaAnterior}</strong>, em ${linhas.length}
              ${linhas.length === 1 ? "coordenação" : "coordenações"}.
            </p>
          </div>
          ${tabelaLinhas(linhas, true)}`;

        const enviadosAdmin = await enviarEmail(
          adminEmails,
          `DJEN Termos — diferença na execução das ${horaAtual} — ${dataBr(ymd)} (visão administrativa)`,
          emailBase(
            "DJEN Termos — diferença entre execuções (Administração)",
            `${dataBr(ymd)} · execução das ${horaAtual} vs ${horaAnterior} (BRT)`,
            corpoAdmin,
          ),
        );

        if (!dryRun) {
          await supabase.from("alertas_diferenca_execucoes_djen").insert({
            execucao_id: atual.id,
            fonte: atual.fonte,
            coordenacao_id: null,
            diferenca: totalDif,
            total_anterior: linhas.reduce((a, l) => a + Math.max(l.totalDia - l.diferenca, 0), 0),
            total_atual: linhas.reduce((a, l) => a + l.totalDia, 0),
            destinatarios: enviadosAdmin,
            dia_ymd: ymd,
          });
          enviadoKey.add(`${atual.id}|__admin__`);
        }

        resultados.push({
          execucao: atual.id,
          hora: horaAtual,
          destino: "admins",
          diferenca: totalDif,
          emails: enviadosAdmin,
          status: "enviado",
        });
      }
    }

    log("fim", JSON.stringify(resultados));
    return new Response(
      JSON.stringify({ success: true, dia: ymd, execucoes: execucoes.length, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[alertar-diferenca-djen-termos] erro", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});