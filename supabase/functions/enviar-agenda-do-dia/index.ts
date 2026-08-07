import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "JurisControl <alertas@juriscontrol.adv.br>";
const APP_URL = "https://juriscontrol.adv.br";

function brtNow() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}
function ymdBRT(): string {
  const d = brtNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
const dataBR = (v?: string | null) => String(v ?? "").slice(0, 10).split("-").reverse().join("/");
const hora = (v?: string | null) => {
  const s = String(v ?? "");
  const m = s.match(/T(\d{2}:\d{2})/) ?? s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : null;
};
const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (v?: string | null) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

type Item = {
  tipo: string;
  cor: string;
  titulo: string;
  hora?: string | null;
  detalhes: Array<[string, string | null | undefined]>;
};

async function enviarEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!resp.ok) return { ok: false, erro: `resend ${resp.status}: ${await resp.text()}` };
  await resp.json().catch(() => null);
  return { ok: true };
}

function renderEmail(nome: string, dia: string, itens: Item[]) {
  const blocos = itens
    .map((i) => {
      const linhas = i.detalhes
        .filter(([, v]) => clean(v))
        .map(
          ([k, v]) =>
            `<div style="font-size:13px;color:#374151"><b>${esc(k)}:</b> ${esc(String(v).replace(/\s+/g, " ").slice(0, 800))}</div>`,
        )
        .join("");
      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.5px;color:${i.cor};text-transform:uppercase">${esc(i.tipo)}</div>
        <div style="font-size:15px;font-weight:600;color:#111827;margin:2px 0 6px">${esc(i.titulo)}${i.hora ? ` — ${esc(i.hora)}` : ""}</div>
        ${linhas}
      </div>`;
    })
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f9fafb;padding:16px">
    <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:10px;padding:20px">
      <h2 style="margin:0 0 4px;color:#111827;font-size:18px">Sua agenda de hoje — ${esc(dia)}</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Olá ${esc(nome)}, você tem ${itens.length} atividade(s) para hoje.</p>
      ${blocos || '<p style="color:#6b7280;font-size:13px">Nenhuma atividade para hoje.</p>'}
      <p style="margin-top:16px;font-size:13px"><a href="${APP_URL}" style="color:#2563EB">Abrir o JurisControl</a></p>
    </div>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const hoje = ymdBRT();
  const horaAtual = brtNow().getUTCHours();

  let forcarUsuario: string | null = null;
  let ignorarHora = false;
  try {
    const body = await req.json();
    forcarUsuario = typeof body?.usuario_id === "string" ? body.usuario_id : null;
    ignorarHora = body?.ignorar_hora === true || !!forcarUsuario;
  } catch { /* sem body */ }

  try {
    // 1) Usuários com resumo diário ativo nesta hora
    let q = supabase
      .from("config_notificacoes_usuario")
      .select("usuario_id, canal_email, resumo_diario_ativo, resumo_diario_hora")
      .eq("resumo_diario_ativo", true);
    if (forcarUsuario) q = q.eq("usuario_id", forcarUsuario);
    else q = q.eq("resumo_diario_hora", horaAtual);
    const { data: configs, error: cfgErr } = await q;
    if (cfgErr) throw cfgErr;

    const alvos = (configs ?? []).filter((c: any) => c.canal_email !== false);
    if (alvos.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: "nenhum usuário nesta hora" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileCache = new Map<string, string>();
    async function nomes(ids: Iterable<string>): Promise<string> {
      const lista = [...new Set([...ids].filter(Boolean))];
      const faltam = lista.filter((i) => !profileCache.has(i));
      if (faltam.length) {
        const { data } = await supabase.from("profiles").select("id, nome").in("id", faltam);
        (data ?? []).forEach((p: any) => profileCache.set(p.id, p.nome ?? ""));
      }
      return lista.map((i) => profileCache.get(i) ?? "").filter(Boolean).join(", ");
    }

    const porUsuario = new Map<string, Item[]>();
    const relevantes = new Set(alvos.map((a: any) => a.usuario_id));
    const push = (uids: Iterable<string>, item: Item) => {
      for (const uid of uids) {
        if (!uid || !relevantes.has(uid)) continue;
        if (!porUsuario.has(uid)) porUsuario.set(uid, []);
        porUsuario.get(uid)!.push(item);
      }
    };

    const procSelect =
      "numero, assunto, polo_ativo, polo_passivo, reclamante, reclamados, valor_causa, orgao_julgador, tribunal, cliente:clientes!processos_cliente_id_fkey(nome)";
    const procDetalhes = (p: any): Array<[string, string | null | undefined]> => [
      ["Processo", p?.numero],
      ["Assunto", p?.assunto],
      ["Reclamante", p?.reclamante ?? p?.polo_ativo],
      ["Reclamada", p?.reclamados ?? p?.polo_passivo],
      ["Cliente", p?.cliente?.nome],
      ["Órgão", p?.orgao_julgador ?? p?.tribunal],
      ["Valor da causa", p?.valor_causa ? `R$ ${p.valor_causa}` : null],
    ];

    // Tarefas / prazos do dia (data_fatal ou vencimento = hoje)
    const { data: tarefas } = await supabase
      .from("tarefas")
      .select(
        `id, titulo, descricao, observacoes, tipo_tarefa, status, prioridade, hora_fatal, data_fatal, data_vencimento, link_local, orgao, responsavel_id, criado_por, tarefa_responsaveis(usuario_id), tarefa_envolvidos(usuario_id), processo:processos(${procSelect})`,
      )
      .or(`data_fatal.eq.${hoje},and(data_fatal.is.null,data_vencimento.eq.${hoje})`)
      .limit(2000);
    for (const t of (tarefas ?? []) as any[]) {
      const resp = new Set<string>();
      const env = new Set<string>();
      if (t.responsavel_id) resp.add(t.responsavel_id);
      for (const r of t.tarefa_responsaveis ?? []) if (r.usuario_id) resp.add(r.usuario_id);
      for (const r of t.tarefa_envolvidos ?? []) if (r.usuario_id) env.add(r.usuario_id);
      const ids = new Set([...resp, ...env, ...(t.criado_por ? [t.criado_por] : [])]);
      const ePrazo = !!t.data_fatal;
      push(ids, {
        tipo: ePrazo ? "Prazo" : String(t.tipo_tarefa || "Tarefa"),
        cor: ePrazo ? "#dc2626" : "#2563eb",
        titulo: t.titulo ?? "(sem título)",
        hora: t.hora_fatal ? String(t.hora_fatal).slice(0, 5) : null,
        detalhes: [
          ["Situação", t.status],
          ["Prioridade", t.prioridade],
          ["Prazo fatal", t.data_fatal ? dataBR(t.data_fatal) : null],
          ["Vencimento", t.data_vencimento ? dataBR(t.data_vencimento) : null],
          ["Tipo", t.tipo_tarefa],
          ["Responsáveis", await nomes(resp)],
          ["Envolvidos", await nomes(env)],
          ["Local/Link", t.link_local],
          ["Órgão", t.orgao],
          ...procDetalhes(t.processo),
          ["Descrição", t.descricao],
          ["Observações", t.observacoes],
        ],
      });
    }

    // Audiências do dia
    const { data: audiencias } = await supabase
      .from("audiencias_detectadas")
      .select(
        "id, titulo, tipo_audiencia, processo_numero, cliente, polo_ativo, polo_passivo, data_audiencia, hora, hora_fim, status, modalidade, local_audiencia, forum, sala_forum, observacoes, criado_por, audiencias_advogados(advogado_id), audiencia_envolvidos(usuario_id)",
      )
      .gte("data_audiencia", `${hoje}T00:00:00`)
      .lte("data_audiencia", `${hoje}T23:59:59`)
      .limit(2000);
    for (const a of (audiencias ?? []) as any[]) {
      const resp = new Set<string>();
      const env = new Set<string>();
      if (a.criado_por) resp.add(a.criado_por);
      for (const r of a.audiencias_advogados ?? []) if (r.advogado_id) resp.add(r.advogado_id);
      for (const r of a.audiencia_envolvidos ?? []) if (r.usuario_id) env.add(r.usuario_id);
      push(new Set([...resp, ...env]), {
        tipo: "Audiência",
        cor: "#b45309",
        titulo: a.titulo || a.tipo_audiencia || `Audiência ${a.processo_numero ?? ""}`.trim(),
        hora: a.hora ? String(a.hora).slice(0, 5) : hora(a.data_audiencia),
        detalhes: [
          ["Situação", a.status],
          ["Tipo", a.tipo_audiencia],
          ["Horário", [a.hora, a.hora_fim].filter(Boolean).map((h: string) => String(h).slice(0, 5)).join(" às ")],
          ["Modalidade", a.modalidade],
          ["Local", a.local_audiencia],
          ["Fórum", [a.forum, a.sala_forum].filter(Boolean).join(" — ")],
          ["Processo", a.processo_numero],
          ["Cliente", a.cliente],
          ["Polo ativo", a.polo_ativo],
          ["Polo passivo", a.polo_passivo],
          ["Responsáveis", await nomes(resp)],
          ["Envolvidos", await nomes(env)],
          ["Observações", a.observacoes],
        ],
      });
    }

    // Eventos do dia
    const { data: eventos } = await supabase
      .from("eventos_agenda")
      .select(
        `id, titulo, descricao, tipo_evento, status, data_inicio, data_fim, local, link, criado_por, evento_responsaveis(usuario_id), evento_envolvidos(usuario_id), participantes_evento(usuario_id), processo:processos(${procSelect})`,
      )
      .gte("data_inicio", `${hoje}T00:00:00`)
      .lte("data_inicio", `${hoje}T23:59:59`)
      .limit(2000);
    for (const e of (eventos ?? []) as any[]) {
      const resp = new Set<string>();
      const env = new Set<string>();
      if (e.criado_por) resp.add(e.criado_por);
      for (const r of e.evento_responsaveis ?? []) if (r.usuario_id) resp.add(r.usuario_id);
      for (const r of e.evento_envolvidos ?? []) if (r.usuario_id) env.add(r.usuario_id);
      for (const r of e.participantes_evento ?? []) if (r.usuario_id) env.add(r.usuario_id);
      push(new Set([...resp, ...env]), {
        tipo: String(e.tipo_evento || "Evento"),
        cor: "#7c3aed",
        titulo: e.titulo ?? "(sem título)",
        hora: hora(e.data_inicio),
        detalhes: [
          ["Situação", e.status],
          ["Início", hora(e.data_inicio)],
          ["Fim", hora(e.data_fim)],
          ["Local", e.local],
          ["Link", e.link],
          ["Responsáveis", await nomes(resp)],
          ["Envolvidos", await nomes(env)],
          ...procDetalhes(e.processo),
          ["Descrição", e.descricao],
        ],
      });
    }

    // Parcelas com vencimento hoje
    const { data: parcelas } = await supabase
      .from("parcelas_evento")
      .select(
        `id, numero, valor, data_vencimento, status, observacoes, pago_em, evento:eventos_agenda(id, titulo, status, criado_por, evento_responsaveis(usuario_id), evento_envolvidos(usuario_id), participantes_evento(usuario_id), processo:processos(${procSelect}))`,
      )
      .eq("data_vencimento", hoje)
      .limit(2000);
    for (const p of (parcelas ?? []) as any[]) {
      const ev = p.evento ?? {};
      const resp = new Set<string>();
      const env = new Set<string>();
      if (ev.criado_por) resp.add(ev.criado_por);
      for (const r of ev.evento_responsaveis ?? []) if (r.usuario_id) resp.add(r.usuario_id);
      for (const r of ev.evento_envolvidos ?? []) if (r.usuario_id) env.add(r.usuario_id);
      for (const r of ev.participantes_evento ?? []) if (r.usuario_id) env.add(r.usuario_id);
      push(new Set([...resp, ...env]), {
        tipo: "Parcela",
        cor: "#059669",
        titulo: `Parcela ${p.numero ?? ""} — ${ev.titulo ?? ""}`.trim(),
        hora: null,
        detalhes: [
          ["Situação", p.pago_em ? "Paga" : p.status],
          ["Valor", p.valor != null ? `R$ ${p.valor}` : null],
          ["Vencimento", dataBR(p.data_vencimento)],
          ["Responsáveis", await nomes(resp)],
          ["Envolvidos", await nomes(env)],
          ...procDetalhes(ev.processo),
          ["Observações", p.observacoes],
        ],
      });
    }

    // 2) Envio
    let enviados = 0;
    const erros: string[] = [];
    for (const cfg of alvos as any[]) {
      const uid = cfg.usuario_id;

      if (!ignorarHora) {
        const { data: ja } = await supabase
          .from("historico_alertas_enviados")
          .select("id")
          .eq("tipo_alerta", "resumo_diario_agenda")
          .eq("destinatario", uid)
          .gte("enviado_em", `${hoje}T00:00:00Z`)
          .limit(1);
        if ((ja ?? []).length > 0) continue;
      }

      const { data: profile } = await supabase
        .from("profiles").select("id, nome, email, ativo").eq("id", uid).maybeSingle();
      if (!profile?.email || (profile as any).ativo === false) continue;

      const itens = (porUsuario.get(uid) ?? []).sort((a, b) =>
        String(a.hora ?? "99:99").localeCompare(String(b.hora ?? "99:99")),
      );
      if (itens.length === 0) continue;

      const html = renderEmail(profile.nome ?? "", dataBR(hoje), itens);
      const r = await enviarEmail(
        profile.email,
        `📅 Sua agenda de hoje (${dataBR(hoje)}) — ${itens.length} atividade(s)`,
        html,
      );
      if (r.ok) enviados++;
      else erros.push(`${profile.email}: ${r.erro}`);

      await supabase.from("historico_alertas_enviados").insert({
        tipo_alerta: "resumo_diario_agenda",
        canal: "email",
        destinatario: uid,
        conteudo: `Resumo diário com ${itens.length} atividade(s)`,
        status: r.ok ? "enviado" : "erro",
        erro: r.erro ?? null,
      });
    }

    return new Response(JSON.stringify({ ok: true, hora_brt: horaAtual, enviados, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("enviar-agenda-do-dia:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
