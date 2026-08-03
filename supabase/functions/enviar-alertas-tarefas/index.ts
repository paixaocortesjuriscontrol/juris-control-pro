import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { linhaPainelAlertasTexto } from "../_shared/app-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "JurisControl <alertas@juriscontrol.adv.br>";

async function enviarEmailResend(to: string, subject: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  try {
    const escapado = texto.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    // Transforma URLs em links clicáveis (ex.: link do Painel de Controle)
    const comLinks = escapado.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563EB">$1</a>');
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap">${comLinks}</div>`;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, erro: `resend ${resp.status}: ${t.slice(0,300)}` };
    }
    await resp.json().catch(() => null);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message ?? e) };
  }
}

interface Config {
  id: string;
  coordenacao_id: string;
  tipo_tarefa: string;
  canal_email: boolean;
  canal_whatsapp: boolean;
  dias_antes: number[];
  destinatarios_ids: string[];
  ativo: boolean;
  dias_semana?: number[] | null;
  pos_vencimento_habilitado?: boolean | null;
  pos_vencimento_horario?: string | null;
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

    // Dia da semana em BRT (0=Dom .. 6=Sáb)
    const diaSemanaBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCDay();

    const { data: configsData, error: cfgErr } = await supabase
      .from("config_envio_alertas_tarefas")
      .select("*")
      .eq("ativo", true);
    if (cfgErr) throw cfgErr;
    const configs = (configsData ?? []) as Config[];

    let totalEnviados = 0;
    let totalFalhas = 0;
    const detalhes: any[] = [];

    // Cache de nomes de coordenações
    const coordCache = new Map<string, string>();
    async function nomeCoord(id: string): Promise<string> {
      if (coordCache.has(id)) return coordCache.get(id)!;
      const { data } = await supabase.from("coordenacoes").select("nome").eq("id", id).maybeSingle();
      const nome = (data as any)?.nome ?? "";
      coordCache.set(id, nome);
      return nome;
    }

    // Cache de nomes de usuários (profiles)
    const profileCache = new Map<string, string>();
    async function nomesProfiles(ids: string[]): Promise<string[]> {
      const faltantes = ids.filter((i) => i && !profileCache.has(i));
      if (faltantes.length) {
        const { data } = await supabase.from("profiles").select("id, nome").in("id", faltantes);
        (data ?? []).forEach((p: any) => profileCache.set(p.id, p.nome ?? ""));
      }
      return ids.map((i) => profileCache.get(i) ?? "").filter(Boolean);
    }

    type ItemDetalhado = {
      id: string;
      titulo: string;
      data: string;
      hora?: string | null;
      processo?: string | null;
      origem: string;
      responsaveis: string[];
      envolvidos?: string[];
      observacao?: string | null;
      cliente?: string | null;
      reclamante?: string | null;
      reclamada?: string | null;
    };

    const clean = (v?: string | null) => {
      const s = String(v ?? "").trim();
      return s ? s : null;
    };

    function formatarItem(i: ItemDetalhado, prefixoData?: string): string {
      const h = i.hora ? ` às ${i.hora}` : "";
      const linhas: string[] = [`• ${i.titulo}${h}${prefixoData ? ` ${prefixoData}` : ""}`];
      if (clean(i.processo)) linhas.push(`   Processo: ${i.processo}`);
      if (clean(i.reclamante)) linhas.push(`   Reclamante: ${i.reclamante}`);
      if (clean(i.reclamada)) linhas.push(`   Reclamada: ${i.reclamada}`);
      if (clean(i.cliente)) linhas.push(`   Cliente: ${i.cliente}`);
      if (i.responsaveis?.length) linhas.push(`   Responsáveis: ${i.responsaveis.join(", ")}`);
      if (i.envolvidos?.length) linhas.push(`   Envolvidos: ${i.envolvidos.join(", ")}`);
      if (clean(i.observacao)) linhas.push(`   Observação: ${String(i.observacao).replace(/\s+/g, " ").slice(0, 500)}`);
      return linhas.join("\n");
    }

    for (const cfg of configs) {
      if (!cfg.canal_email && !cfg.canal_whatsapp) continue;
      // Respeitar dias da semana configurados (default: dias úteis)
      const diasSemana = Array.isArray(cfg.dias_semana) && cfg.dias_semana.length
        ? cfg.dias_semana
        : [1, 2, 3, 4, 5];
      if (!diasSemana.includes(diaSemanaBRT)) {
        console.log(`[alertas-tarefas] Pulando cfg ${cfg.id} — dia ${diaSemanaBRT} fora de [${diasSemana.join(",")}]`);
        continue;
      }
      const coordNome = await nomeCoord(cfg.coordenacao_id);

      for (const nDias of cfg.dias_antes) {
        const alvoInfo = alvoBRT(nDias);
        const alvo = alvoInfo.ymd;
        const alvoIni = alvoInfo.rangeUtcInicio;
        const alvoFim = alvoInfo.rangeUtcFim;

        const itens: ItemDetalhado[] = [];
        // Regra: destinatários finais = config + responsáveis + envolvidos + criador de cada item
        const idsExtras = new Set<string>();

        // 1) Tarefas (data_vencimento é date — comparação direta em BRT)
        const { data: tarefas } = await supabase
          .from("tarefas")
          .select("id, titulo, data_vencimento, hora_prevista, observacoes, descricao, partes_ativas, partes_passivas, responsavel_id, criado_por, tarefa_responsaveis(usuario_id), tarefa_envolvidos(usuario_id), processo:processos!inner(numero, coordenacao_id, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome))")
          .eq("tipo_tarefa", cfg.tipo_tarefa)
          .eq("processo.coordenacao_id", cfg.coordenacao_id)
          .eq("data_vencimento", alvo)
          .neq("status", "concluida");
        for (const t of (tarefas ?? []) as any[]) {
          const respIds = new Set<string>();
          if (t.responsavel_id) respIds.add(t.responsavel_id);
          (t.tarefa_responsaveis ?? []).forEach((r: any) => r.usuario_id && respIds.add(r.usuario_id));
          const responsaveis = await nomesProfiles([...respIds]);
          respIds.forEach((id) => idsExtras.add(id));
          const envIds = (t.tarefa_envolvidos ?? []).map((e: any) => e.usuario_id).filter(Boolean);
          const envolvidos = await nomesProfiles(envIds);
          envIds.forEach((id: string) => idsExtras.add(id));
          if (t.criado_por) idsExtras.add(t.criado_por);
          itens.push({
            id: t.id, titulo: t.titulo, data: t.data_vencimento, hora: t.hora_prevista,
            processo: t.processo?.numero, origem: "tarefa", responsaveis,
            envolvidos,
            observacao: t.observacoes ?? t.descricao ?? null,
            cliente: t.processo?.cliente?.nome ?? null,
            reclamante: t.processo?.reclamante ?? t.processo?.polo_ativo ?? t.partes_ativas ?? null,
            reclamada: t.processo?.reclamados ?? t.processo?.polo_passivo ?? t.partes_passivas ?? null,
          });
        }

        // 2) Audiências detectadas — data_audiencia é timestamptz, filtrar por range BRT
        if (cfg.tipo_tarefa === "AUDIÊNCIA" || cfg.tipo_tarefa === "AUDIENCIA") {
          const { data: audiencias } = await supabase
            .from("audiencias_detectadas")
            .select("id, processo_numero, data_audiencia, hora, cliente, polo_ativo, observacoes, status, criado_por, audiencias_advogados(advogado_id), audiencia_envolvidos(usuario_id)")
            .eq("coordenacao_id", cfg.coordenacao_id)
            .gte("data_audiencia", alvoIni)
            .lte("data_audiencia", alvoFim)
            .not("status", "in", "(tratado,ignorado,cancelado)");
          for (const a of (audiencias ?? []) as any[]) {
            const respIds = (a.audiencias_advogados ?? []).map((x: any) => x.advogado_id).filter(Boolean);
            const responsaveis = await nomesProfiles(respIds);
            respIds.forEach((id: string) => idsExtras.add(id));
            const envIdsA = (a.audiencia_envolvidos ?? []).map((e: any) => e.usuario_id).filter(Boolean);
            const envolvidos = await nomesProfiles(envIdsA);
            envIdsA.forEach((id: string) => idsExtras.add(id));
            if (a.criado_por) idsExtras.add(a.criado_por);
            itens.push({
              id: a.id, titulo: `Audiência ${a.cliente ?? a.processo_numero ?? ""}`.trim(),
              data: a.data_audiencia, hora: a.hora, processo: a.processo_numero, origem: "audiencia",
              responsaveis,
              envolvidos,
              observacao: a.observacoes ?? null,
              cliente: a.cliente ?? null,
              reclamante: a.polo_ativo ?? null,
            });
          }
        }

        // 3) Eventos — data_inicio timestamptz, range BRT
        if (cfg.tipo_tarefa === "OUTROS" || cfg.tipo_tarefa === "EVENTO") {
          const { data: eventos } = await supabase
            .from("eventos_agenda")
            .select("id, titulo, data_inicio, descricao, status, criado_por, evento_responsaveis(usuario_id), evento_envolvidos(usuario_id), participantes_evento(usuario_id), processo:processos!inner(numero, coordenacao_id, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome))")
            .eq("processo.coordenacao_id", cfg.coordenacao_id)
            .gte("data_inicio", alvoIni)
            .lte("data_inicio", alvoFim)
            .not("status", "in", "(concluido,cancelado,tratado)");
          for (const e of (eventos ?? []) as any[]) {
            const respIds = new Set<string>();
            if (e.criado_por) respIds.add(e.criado_por);
            (e.evento_responsaveis ?? []).forEach((r: any) => r.usuario_id && respIds.add(r.usuario_id));
            const responsaveis = await nomesProfiles([...respIds]);
            respIds.forEach((id) => idsExtras.add(id));
            const envIdsE = [
              ...(e.evento_envolvidos ?? []).map((x: any) => x.usuario_id),
              ...(e.participantes_evento ?? []).map((x: any) => x.usuario_id),
            ].filter(Boolean);
            const envolvidos = await nomesProfiles([...new Set<string>(envIdsE)]);
            envIdsE.forEach((id: string) => idsExtras.add(id));
            itens.push({
              id: e.id, titulo: e.titulo, data: (e.data_inicio ?? "").slice(0, 10), origem: "evento",
              responsaveis,
              envolvidos,
              processo: e.processo?.numero ?? null,
              observacao: e.descricao ?? null,
              cliente: e.processo?.cliente?.nome ?? null,
              reclamante: e.processo?.reclamante ?? e.processo?.polo_ativo ?? null,
              reclamada: e.processo?.reclamados ?? e.processo?.polo_passivo ?? null,
            });
          }
        }

        // 4) Parcelamentos recorrentes — parcelas_evento.data_vencimento é date
        if (cfg.tipo_tarefa === "PARCELAMENTO" || cfg.tipo_tarefa === "PARCELA") {
          const { data: parcelas } = await supabase
            .from("parcelas_evento")
            .select("id, numero, valor, data_vencimento, observacoes, status, pago_em, evento:eventos_agenda!inner(id, titulo, status, descricao, criado_por, coordenacao_id, evento_responsaveis(usuario_id), evento_envolvidos(usuario_id), participantes_evento(usuario_id), processo:processos(numero, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome)))")
            .eq("evento.coordenacao_id", cfg.coordenacao_id)
            .eq("data_vencimento", alvo)
            .is("pago_em", null)
            .not("status", "in", "(pago,paga,cancelado,cancelada)")
            .not("evento.status", "in", "(cancelado,concluido,tratado)");
          for (const p of (parcelas ?? []) as any[]) {
            const ev = p.evento ?? {};
            // Segurança extra: ignora parcelas de eventos cancelados/concluídos
            if (["cancelado", "cancelada", "concluido", "tratado"].includes(String(ev.status ?? "").toLowerCase())) continue;
            const respIds = new Set<string>();
            if (ev.criado_por) respIds.add(ev.criado_por);
            (ev.evento_responsaveis ?? []).forEach((r: any) => r.usuario_id && respIds.add(r.usuario_id));
            const responsaveis = await nomesProfiles([...respIds]);
            respIds.forEach((id) => idsExtras.add(id));
            const envIdsP = [
              ...(ev.evento_envolvidos ?? []).map((x: any) => x.usuario_id),
              ...(ev.participantes_evento ?? []).map((x: any) => x.usuario_id),
            ].filter(Boolean);
            const envolvidos = await nomesProfiles([...new Set<string>(envIdsP)]);
            envIdsP.forEach((id: string) => idsExtras.add(id));
            itens.push({
              id: p.id,
              titulo: `Parcela ${p.numero ?? ""} — ${ev.titulo ?? ""}`.trim(),
              data: p.data_vencimento,
              origem: "parcela",
              responsaveis,
              envolvidos,
              processo: ev.processo?.numero ?? null,
              observacao: p.observacoes ?? ev.descricao ?? null,
              cliente: ev.processo?.cliente?.nome ?? null,
              reclamante: ev.processo?.reclamante ?? ev.processo?.polo_ativo ?? null,
              reclamada: ev.processo?.reclamados ?? ev.processo?.polo_passivo ?? null,
            });
          }
        }

        if (itens.length === 0) continue;

        // Destinatários finais = destinatários da config ∪ responsáveis ∪ envolvidos ∪ criador (dedup)
        const finalIds = new Set<string>([...(cfg.destinatarios_ids ?? []), ...idsExtras]);
        if (finalIds.size === 0) continue;
        const { data: dests } = await supabase
          .from("profiles")
          .select("id, nome, email, telefone")
          .in("id", [...finalIds]);
        if (!dests?.length) continue;

        // Montar mensagem (data BRT dd/MM/yyyy)
        const dataStr = alvoInfo.dataStrBR;
        const linhas = itens.slice(0, 30).map((i) => formatarItem(i)).join("\n\n");
        const cabecalho = nDias === 0
          ? `📅 Alertas para HOJE (${dataStr}) — ${cfg.tipo_tarefa}`
          : `⏰ Alertas para ${dataStr} (em ${nDias} dia${nDias > 1 ? "s" : ""}) — ${cfg.tipo_tarefa}`;
        const linhaCoord = coordNome ? `Coordenação: ${coordNome}\n` : "";
        const corpoTexto = `${cabecalho}\n\n${linhaCoord}${linhaCoord ? "\n" : ""}${linhas}\n\nTotal: ${itens.length} item(ns)\n\n${linhaPainelAlertasTexto(itens.length === 1 ? itens[0].id : null)}`;

        // Dedupe key: mesmo dia BRT + destinatário + canal + tipo (rota "referencia_id" é uuid → não serve; usamos janela por dia)
        const inicioDiaBrtUtc = new Date(Date.now() - 3 * 60 * 60 * 1000);
        inicioDiaBrtUtc.setUTCHours(0, 0, 0, 0);
        const inicioJanelaUtc = new Date(inicioDiaBrtUtc.getTime() + 3 * 60 * 60 * 1000).toISOString();
        const tag = `[${cfg.id.slice(0,8)}|${alvo}|d${nDias}]`;
        const subject = `${cabecalho}`;
        const refs = itens.slice(0, 30).map((i) => ({ id: i.id, titulo: i.titulo, origem: i.origem }));
        const refUnico = itens.length === 1 ? itens[0].id : null;

        for (const d of dests) {
          if (cfg.canal_whatsapp && d.telefone) {
            const { data: jaEnviado } = await supabase
              .from("historico_alertas_enviados")
              .select("id")
              .eq("coordenacao_id", cfg.coordenacao_id)
              .eq("canal", "whatsapp")
              .eq("destinatario", d.telefone)
              .eq("tipo_alerta", cfg.tipo_tarefa)
              .gte("enviado_em", inicioJanelaUtc)
              .ilike("conteudo", `%${tag}%`)
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
                conteudo: `${tag}\n${corpoTexto}`.slice(0, 2000),
                referencia_id: refUnico,
                itens_referencias: refs,
                status: ok ? "enviado" : "falha",
                erro: ok ? null : String(resp.error?.message ?? "erro"),
              });
              if (ok) totalEnviados++; else totalFalhas++;
            }
          }

          if (cfg.canal_email && d.email) {
            const { data: jaEnviado } = await supabase
              .from("historico_alertas_enviados")
              .select("id")
              .eq("coordenacao_id", cfg.coordenacao_id)
              .eq("canal", "email")
              .eq("destinatario", d.email)
              .eq("tipo_alerta", cfg.tipo_tarefa)
              .gte("enviado_em", inicioJanelaUtc)
              .ilike("conteudo", `%${tag}%`)
              .maybeSingle();
            if (!jaEnviado) {
              const r = await enviarEmailResend(d.email, subject, corpoTexto);
              await supabase.from("historico_alertas_enviados").insert({
                coordenacao_id: cfg.coordenacao_id,
                tipo_alerta: cfg.tipo_tarefa,
                canal: "email",
                destinatario: d.email,
                conteudo: `${tag}\n${corpoTexto}`.slice(0, 2000),
                referencia_id: refUnico,
                itens_referencias: refs,
                status: r.ok ? "enviado" : "falha",
                erro: r.ok ? null : (r.erro ?? "erro"),
              });
              if (r.ok) totalEnviados++; else totalFalhas++;
            }
          }
        }

        detalhes.push({ config: cfg.id, tipo: cfg.tipo_tarefa, dias_antes: nDias, itens: itens.length });
      }

      // ============ Alertas Pós-Vencimento (itens vencidos não tratados) ============
      if (cfg.pos_vencimento_habilitado) {
        // Só envia se estivermos no horário configurado (janela de 1 hora)
        const horaBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours();
        const horaCfg = parseInt(String(cfg.pos_vencimento_horario ?? "09:00").slice(0, 2), 10);
        if (Number.isFinite(horaCfg) && horaBRT === horaCfg) {
          const hojeYmd = hoje.ymd;
          const itensVenc: ItemDetalhado[] = [];
          const idsExtrasVenc = new Set<string>();

          // Tarefas vencidas (data_vencimento < hoje) e ainda não concluídas/tratadas
          const { data: tarefasVenc } = await supabase
            .from("tarefas")
            .select("id, titulo, data_vencimento, data_cumprimento, observacoes, descricao, partes_ativas, partes_passivas, responsavel_id, criado_por, tarefa_responsaveis(usuario_id), tarefa_envolvidos(usuario_id), processo:processos!inner(numero, coordenacao_id, polo_ativo, polo_passivo, reclamante, reclamados, cliente:clientes!processos_cliente_id_fkey(nome))")
            .eq("tipo_tarefa", cfg.tipo_tarefa)
            .eq("processo.coordenacao_id", cfg.coordenacao_id)
            .lt("data_vencimento", hojeYmd)
            .neq("status", "concluida")
            .is("data_cumprimento", null);
          for (const t of (tarefasVenc ?? []) as any[]) {
            const respIds = new Set<string>();
            if (t.responsavel_id) respIds.add(t.responsavel_id);
            (t.tarefa_responsaveis ?? []).forEach((r: any) => r.usuario_id && respIds.add(r.usuario_id));
            const responsaveis = await nomesProfiles([...respIds]);
            respIds.forEach((id) => idsExtrasVenc.add(id));
            const envIdsV = (t.tarefa_envolvidos ?? []).map((e: any) => e.usuario_id).filter(Boolean);
            const envolvidos = await nomesProfiles(envIdsV);
            envIdsV.forEach((id: string) => idsExtrasVenc.add(id));
            if (t.criado_por) idsExtrasVenc.add(t.criado_por);
            itensVenc.push({
              id: t.id, titulo: t.titulo, data: t.data_vencimento,
              processo: t.processo?.numero, origem: "tarefa", responsaveis, envolvidos,
              observacao: t.observacoes ?? t.descricao ?? null,
              cliente: t.processo?.cliente?.nome ?? null,
              reclamante: t.processo?.reclamante ?? t.processo?.polo_ativo ?? t.partes_ativas ?? null,
            reclamada: t.processo?.reclamados ?? t.processo?.polo_passivo ?? t.partes_passivas ?? null,
            });
          }

          if (itensVenc.length > 0) {
            const finalIdsVenc = new Set<string>([...(cfg.destinatarios_ids ?? []), ...idsExtrasVenc]);
            const { data: destsVenc } = finalIdsVenc.size > 0
              ? await supabase.from("profiles").select("id, nome, email, telefone").in("id", [...finalIdsVenc])
              : { data: [] as any[] };
            const linhas = itensVenc.slice(0, 40)
              .map((i) => formatarItem(i, `(venceu em ${String(i.data).slice(0, 10).split("-").reverse().join("/")})`))
              .join("\n\n");
            const cabecalho = `🚨 Itens VENCIDOS não tratados — ${cfg.tipo_tarefa}`;
            const linhaCoord = coordNome ? `Coordenação: ${coordNome}\n\n` : "";
            const corpoTexto = `${cabecalho}\n\n${linhaCoord}${linhas}\n\nTotal: ${itensVenc.length} item(ns) pendente(s)\n\n${linhaPainelAlertasTexto(itensVenc.length === 1 ? itensVenc[0].id : null)}`;
            const tag = `[${cfg.id.slice(0,8)}|posvenc|${hojeYmd}]`;
            const refsVenc = itensVenc.slice(0, 40).map((i) => ({ id: i.id, titulo: i.titulo, origem: i.origem }));
            const refUnicoVenc = itensVenc.length === 1 ? itensVenc[0].id : null;

            const inicioDiaBrtUtc = new Date(Date.now() - 3 * 60 * 60 * 1000);
            inicioDiaBrtUtc.setUTCHours(0, 0, 0, 0);
            const inicioJanelaUtc = new Date(inicioDiaBrtUtc.getTime() + 3 * 60 * 60 * 1000).toISOString();

            for (const d of (destsVenc ?? [])) {
              if (cfg.canal_email && d.email) {
                const { data: ja } = await supabase
                  .from("historico_alertas_enviados")
                  .select("id").eq("coordenacao_id", cfg.coordenacao_id)
                  .eq("canal", "email").eq("destinatario", d.email)
                  .eq("tipo_alerta", cfg.tipo_tarefa)
                  .gte("enviado_em", inicioJanelaUtc)
                  .ilike("conteudo", `%${tag}%`).maybeSingle();
                if (!ja) {
                  const r = await enviarEmailResend(d.email, cabecalho, corpoTexto);
                  await supabase.from("historico_alertas_enviados").insert({
                    coordenacao_id: cfg.coordenacao_id, tipo_alerta: cfg.tipo_tarefa,
                    canal: "email", destinatario: d.email,
                    conteudo: `${tag}\n${corpoTexto}`.slice(0, 2000),
                    referencia_id: refUnicoVenc, itens_referencias: refsVenc,
                    status: r.ok ? "enviado" : "falha", erro: r.ok ? null : (r.erro ?? "erro"),
                  });
                  if (r.ok) totalEnviados++; else totalFalhas++;
                }
              }
              if (cfg.canal_whatsapp && d.telefone) {
                const { data: ja } = await supabase
                  .from("historico_alertas_enviados")
                  .select("id").eq("coordenacao_id", cfg.coordenacao_id)
                  .eq("canal", "whatsapp").eq("destinatario", d.telefone)
                  .eq("tipo_alerta", cfg.tipo_tarefa)
                  .gte("enviado_em", inicioJanelaUtc)
                  .ilike("conteudo", `%${tag}%`).maybeSingle();
                if (!ja) {
                  const resp = await supabase.functions.invoke("enviar-whatsapp-zapi", {
                    body: { telefones: [d.telefone], mensagem: corpoTexto, tipo: "lembrete" },
                  });
                  const ok = !resp.error;
                  await supabase.from("historico_alertas_enviados").insert({
                    coordenacao_id: cfg.coordenacao_id, tipo_alerta: cfg.tipo_tarefa,
                    canal: "whatsapp", destinatario: d.telefone,
                    conteudo: `${tag}\n${corpoTexto}`.slice(0, 2000),
                    referencia_id: refUnicoVenc, itens_referencias: refsVenc,
                    status: ok ? "enviado" : "falha",
                    erro: ok ? null : String(resp.error?.message ?? "erro"),
                  });
                  if (ok) totalEnviados++; else totalFalhas++;
                }
              }
            }
            detalhes.push({ config: cfg.id, tipo: cfg.tipo_tarefa, pos_vencimento: itensVenc.length });
          }
        }
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
