import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { linhaPainelAlertasTexto } from "../_shared/app-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "JurisControl <alertas@juriscontrol.adv.br>";

function ymdBRT(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function enviarEmail(to: string, subject: string, texto: string) {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  const escapado = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const comLinks = escapado.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563EB">$1</a>');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap">${comLinks}</div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!resp.ok) return { ok: false, erro: `resend ${resp.status}` };
  await resp.json().catch(() => null);
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const hoje = ymdBRT();

  try {
    type Item = {
      tipo: string;
      titulo: string;
      data: string;
      processo?: string | null;
      responsaveis?: string[];
      envolvidos?: string[];
      observacao?: string | null;
      cliente?: string | null;
      reclamante?: string | null;
      reclamada?: string | null;
    };
    const porUsuario = new Map<string, Item[]>();
    const push = (uids: Iterable<string>, item: Item) => {
      for (const uid of uids) {
        if (!uid) continue;
        if (!porUsuario.has(uid)) porUsuario.set(uid, []);
        porUsuario.get(uid)!.push(item);
      }
    };

    // Cache de nomes de usuários
    const profileCache = new Map<string, string>();
    async function nomes(ids: Iterable<string>): Promise<string[]> {
      const lista = [...new Set([...ids].filter(Boolean))];
      const faltantes = lista.filter((i) => !profileCache.has(i));
      if (faltantes.length) {
        const { data } = await supabase.from("profiles").select("id, nome").in("id", faltantes);
        (data ?? []).forEach((p: any) => profileCache.set(p.id, p.nome ?? ""));
      }
      return lista.map((i) => profileCache.get(i) ?? "").filter(Boolean);
    }

    const clean = (v?: string | null) => {
      const s = String(v ?? "").trim();
      return s ? s : null;
    };

    function formatarItem(i: Item): string {
      const linhas: string[] = [`• [${i.tipo}] ${i.titulo} — venceu em ${String(i.data ?? "").slice(0, 10).split("-").reverse().join("/")}`];
      if (clean(i.processo)) linhas.push(`   Processo: ${i.processo}`);
      if (clean(i.reclamante)) linhas.push(`   Reclamante: ${i.reclamante}`);
      if (clean(i.reclamada)) linhas.push(`   Reclamada: ${i.reclamada}`);
      if (clean(i.cliente)) linhas.push(`   Cliente: ${i.cliente}`);
      if (i.responsaveis?.length) linhas.push(`   Responsáveis: ${i.responsaveis.join(", ")}`);
      if (i.envolvidos?.length) linhas.push(`   Envolvidos: ${i.envolvidos.join(", ")}`);
      if (clean(i.observacao)) linhas.push(`   Observação: ${String(i.observacao).replace(/\s+/g, " ").slice(0, 500)}`);
      return linhas.join("\n");
    }

    // 1) Tarefas: COALESCE(data_fatal, data_vencimento) < hoje
    const { data: tarefas } = await supabase
      .from("tarefas")
      .select("id, titulo, data_fatal, data_vencimento, status, observacoes, descricao, partes_ativas, partes_passivas, responsavel_id, criado_por, tarefa_responsaveis(usuario_id), tarefa_envolvidos(usuario_id), processo:processos(numero, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome))")
      .or(`and(data_fatal.lt.${hoje}),and(data_fatal.is.null,data_vencimento.lt.${hoje})`)
      .not("status", "in", "(concluida,cancelada,arquivada,tratada)")
      .limit(1000);
    for (const t of (tarefas ?? []) as any[]) {
      const ids = new Set<string>();
      const respIds = new Set<string>();
      const envIds = new Set<string>();
      if (t.responsavel_id) respIds.add(t.responsavel_id);
      for (const r of (t.tarefa_responsaveis ?? [])) if (r.usuario_id) respIds.add(r.usuario_id);
      for (const r of (t.tarefa_envolvidos ?? [])) if (r.usuario_id) envIds.add(r.usuario_id);
      respIds.forEach((i) => ids.add(i));
      envIds.forEach((i) => ids.add(i));
      if (t.criado_por) ids.add(t.criado_por);
      push(ids, {
        tipo: "Tarefa",
        titulo: t.titulo ?? "(sem título)",
        data: t.data_fatal ?? t.data_vencimento,
        processo: t.processo?.numero ?? null,
        responsaveis: await nomes(respIds),
        envolvidos: await nomes(envIds),
        observacao: t.observacoes ?? t.descricao ?? null,
        cliente: t.processo?.cliente?.nome ?? null,
        reclamante: t.processo?.reclamante ?? t.processo?.polo_ativo ?? t.partes_ativas ?? null,
            reclamada: t.processo?.reclamados ?? t.processo?.polo_passivo ?? t.partes_passivas ?? null,
      });
    }

    // 2) Eventos: data_inicio < hoje
    const { data: eventos } = await supabase
      .from("eventos_agenda")
      .select("id, titulo, data_inicio, descricao, status, criado_por, evento_responsaveis(usuario_id), evento_envolvidos(usuario_id), participantes_evento(usuario_id), processo:processos(numero, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome))")
      .lt("data_inicio", `${hoje}T00:00:00Z`)
      .not("status", "in", "(concluido,cancelado,tratado)")
      .limit(1000);
    for (const e of (eventos ?? []) as any[]) {
      const ids = new Set<string>();
      const respIds = new Set<string>();
      const envIds = new Set<string>();
      if (e.criado_por) respIds.add(e.criado_por);
      for (const r of (e.evento_responsaveis ?? [])) if (r.usuario_id) respIds.add(r.usuario_id);
      for (const r of (e.evento_envolvidos ?? [])) if (r.usuario_id) envIds.add(r.usuario_id);
      for (const r of (e.participantes_evento ?? [])) if (r.usuario_id) envIds.add(r.usuario_id);
      respIds.forEach((i) => ids.add(i));
      envIds.forEach((i) => ids.add(i));
      push(ids, {
        tipo: "Evento",
        titulo: e.titulo ?? "(sem título)",
        data: (e.data_inicio ?? "").slice(0, 10),
        processo: e.processo?.numero ?? null,
        responsaveis: await nomes(respIds),
        envolvidos: await nomes(envIds),
        observacao: e.descricao ?? null,
        cliente: e.processo?.cliente?.nome ?? null,
        reclamante: e.processo?.reclamante ?? e.processo?.polo_ativo ?? null,
              reclamada: e.processo?.reclamados ?? e.processo?.polo_passivo ?? null,
      });
    }

    // 3) Audiências: data_audiencia < hoje
    const { data: audiencias } = await supabase
      .from("audiencias_detectadas")
      .select("id, processo_numero, cliente, polo_ativo, observacoes, data_audiencia, status, criado_por, audiencias_advogados(advogado_id), audiencia_envolvidos(usuario_id)")
      .lt("data_audiencia", `${hoje}T00:00:00Z`)
      .not("status", "in", "(tratado,ignorado,cancelado,realizada)")
      .limit(1000);
    for (const a of (audiencias ?? []) as any[]) {
      const ids = new Set<string>();
      const respIds = new Set<string>();
      const envIds = new Set<string>();
      if (a.criado_por) respIds.add(a.criado_por);
      for (const r of (a.audiencias_advogados ?? [])) if (r.advogado_id) respIds.add(r.advogado_id);
      for (const r of (a.audiencia_envolvidos ?? [])) if (r.usuario_id) envIds.add(r.usuario_id);
      respIds.forEach((i) => ids.add(i));
      envIds.forEach((i) => ids.add(i));
      push(ids, {
        tipo: "Audiência",
        titulo: `Audiência ${a.cliente ?? a.processo_numero ?? ""}`.trim(),
        data: (a.data_audiencia ?? "").slice(0, 10),
        processo: a.processo_numero ?? null,
        responsaveis: await nomes(respIds),
        envolvidos: await nomes(envIds),
        observacao: a.observacoes ?? null,
        cliente: a.cliente ?? null,
        reclamante: a.polo_ativo ?? null,
      });
    }

    // 4) Parcelas: data_vencimento < hoje e não pagas
    const { data: parcelas } = await supabase
      .from("parcelas_evento")
      .select("id, numero, valor, data_vencimento, observacoes, status, pago_em, evento:eventos_agenda(id, titulo, status, descricao, criado_por, evento_responsaveis(usuario_id), evento_envolvidos(usuario_id), participantes_evento(usuario_id), processo:processos(numero, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome)))")
      .lt("data_vencimento", hoje)
      .is("pago_em", null)
      .not("status", "in", "(pago,paga,cancelado,cancelada)")
      .limit(1000);
    for (const p of (parcelas ?? []) as any[]) {
      const ev = p.evento ?? {};
      // Ignora parcelas cujo evento (parcelamento) foi cancelado/concluído
      if (["cancelado", "cancelada", "concluido", "tratado"].includes(String(ev.status ?? "").toLowerCase())) continue;
      const ids = new Set<string>();
      const respIds = new Set<string>();
      const envIds = new Set<string>();
      if (ev.criado_por) respIds.add(ev.criado_por);
      for (const r of (ev.evento_responsaveis ?? [])) if (r.usuario_id) respIds.add(r.usuario_id);
      for (const r of (ev.evento_envolvidos ?? [])) if (r.usuario_id) envIds.add(r.usuario_id);
      for (const r of (ev.participantes_evento ?? [])) if (r.usuario_id) envIds.add(r.usuario_id);
      respIds.forEach((i) => ids.add(i));
      envIds.forEach((i) => ids.add(i));
      push(ids, {
        tipo: "Parcela",
        titulo: `Parcela ${p.numero ?? ""} — ${ev.titulo ?? ""}`.trim(),
        data: p.data_vencimento,
        processo: ev.processo?.numero ?? null,
        responsaveis: await nomes(respIds),
        envolvidos: await nomes(envIds),
        observacao: p.observacoes ?? ev.descricao ?? null,
        cliente: ev.processo?.cliente?.nome ?? null,
        reclamante: ev.processo?.reclamante ?? ev.processo?.polo_ativo ?? null,
              reclamada: ev.processo?.reclamados ?? ev.processo?.polo_passivo ?? null,
      });
    }

    let enviados = 0;
    for (const [uid, itens] of porUsuario) {
      // Já enviou hoje?
      const { data: jaEnviado } = await supabase
        .from("historico_alertas_enviados")
        .select("id")
        .eq("tipo_alerta", "prazo_perdido")
        .eq("destinatario", uid)
        .gte("enviado_em", `${hoje}T00:00:00Z`)
        .limit(1);
      if ((jaEnviado ?? []).length > 0) continue;

      const { data: profile } = await supabase
        .from("profiles").select("id, nome, email, telefone").eq("id", uid).maybeSingle();
      if (!profile) continue;

      const { data: cfg } = await supabase
        .from("config_notificacoes_usuario").select("*").eq("usuario_id", uid).maybeSingle();
      const c = cfg ?? { canal_email: true, canal_whatsapp: true, evento_prazo_perdido: true };
      if (c.evento_prazo_perdido === false) continue;

      const linhas = itens.slice(0, 30).map((i) => formatarItem(i)).join("\n\n");
      const corpo = `Olá ${profile.nome ?? ""},\n\nVocê tem ${itens.length} pendência(s) com prazo vencido:\n\n${linhas}${itens.length > 30 ? `\n... e mais ${itens.length - 30}` : ""}\n\n${linhaPainelAlertasTexto(null)}`;
      const assunto = `⚠️ Você tem ${itens.length} item(ns) com prazo perdido`;

      if (c.canal_email && profile.email) {
        const r = await enviarEmail(profile.email, assunto, corpo);
        await supabase.from("historico_alertas_enviados").insert({
          tipo_alerta: "prazo_perdido", canal: "email", destinatario: uid, conteudo: corpo, status: r.ok ? "enviado" : "erro", erro: r.erro,
        });
      }
      if (c.canal_whatsapp && profile.telefone) {
        const { error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
          body: { telefones: [profile.telefone], mensagem: corpo, tipo: "lembrete" },
        });
        await supabase.from("historico_alertas_enviados").insert({
          tipo_alerta: "prazo_perdido", canal: "whatsapp", destinatario: uid, conteudo: corpo,
          status: error ? "erro" : "enviado", erro: error ? String(error.message ?? error) : null,
        });
      }
      // Marca o destinatario=uid para dedup por dia
      enviados++;
    }

    return new Response(JSON.stringify({ ok: true, usuarios_notificados: enviados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});