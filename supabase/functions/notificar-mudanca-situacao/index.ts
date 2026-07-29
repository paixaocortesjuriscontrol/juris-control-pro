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

function labelEntidade(e: string): string {
  return { tarefa: "Tarefa", evento: "Evento", audiencia: "Audiência", parcela: "Parcela" }[e] ?? e;
}

function fmtBRT(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  } catch { return String(iso); }
}
function fmtData(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return String(iso); }
}
function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function buscarDetalhesEntidade(supabase: any, entidade: string, id: string): Promise<Record<string, string>> {
  const det: Record<string, string> = {};
  try {
    if (entidade === "tarefa") {
      const { data } = await supabase.from("tarefas")
        .select("titulo, tipo_tarefa, prioridade, data_vencimento, data_fatal, processo_id, orgao_julgador, descricao")
        .eq("id", id).maybeSingle();
      if (data) {
        if (data.tipo_tarefa) det["Tipo"] = data.tipo_tarefa;
        if (data.prioridade) det["Prioridade"] = data.prioridade;
        if (data.data_vencimento) det["Vencimento"] = fmtData(data.data_vencimento);
        if (data.data_fatal) det["Data fatal"] = fmtData(data.data_fatal);
        if (data.orgao_julgador) det["Órgão"] = data.orgao_julgador;
      }
    } else if (entidade === "audiencia") {
      const { data } = await supabase.from("audiencias_detectadas")
        .select("tipo_audiencia, modalidade, data_audiencia, hora, local_audiencia, comarca, vara_camara, processo_numero, cliente, polo_ativo")
        .eq("id", id).maybeSingle();
      if (data) {
        if (data.tipo_audiencia) det["Tipo"] = data.tipo_audiencia;
        if (data.modalidade) det["Modalidade"] = data.modalidade;
        if (data.data_audiencia) det["Data"] = fmtData(data.data_audiencia) + (data.hora ? ` ${data.hora}` : "");
        if (data.local_audiencia) det["Local"] = data.local_audiencia;
        if (data.vara_camara) det["Vara/Câmara"] = data.vara_camara;
        if (data.comarca) det["Comarca"] = data.comarca;
        if (data.processo_numero) det["Processo"] = data.processo_numero;
        if (data.cliente) det["Cliente"] = data.cliente;
      }
    } else if (entidade === "evento") {
      const { data } = await supabase.from("eventos_agenda")
        .select("titulo, tipo, data_inicio, data_fim, local, descricao")
        .eq("id", id).maybeSingle();
      if (data) {
        if (data.tipo) det["Tipo"] = data.tipo;
        if (data.data_inicio) det["Início"] = fmtBRT(data.data_inicio);
        if (data.data_fim) det["Fim"] = fmtBRT(data.data_fim);
        if (data.local) det["Local"] = data.local;
      }
    } else if (entidade === "parcela") {
      const { data } = await supabase.from("parcelas_evento")
        .select("numero, data_vencimento, valor, evento_id, observacoes")
        .eq("id", id).maybeSingle();
      if (data) {
        if (data.numero != null) det["Parcela"] = String(data.numero);
        if (data.data_vencimento) det["Vencimento"] = fmtData(data.data_vencimento);
        if (data.valor != null) det["Valor"] = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(data.valor));
      }
    }
  } catch (_e) { /* best-effort */ }
  return det;
}

function dentroDaJanela(inicio: number, fim: number): boolean {
  const brtMs = Date.now() - 3 * 60 * 60 * 1000;
  const h = new Date(brtMs).getUTCHours();
  if (inicio <= fim) return h >= inicio && h < fim;
  return h >= inicio || h < fim; // janela cruza meia-noite
}

async function enviarEmail(to: string, subject: string, texto: string, html?: string): Promise<{ ok: boolean; erro?: string }> {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  const finalHtml = html ?? `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap">${esc(texto)}</div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html: finalHtml, text: texto }),
  });
  if (!resp.ok) return { ok: false, erro: `resend ${resp.status}: ${(await resp.text()).slice(0, 200)}` };
  await resp.json().catch(() => null);
  return { ok: true };
}

async function enviarWhatsApp(supabase: any, telefone: string, mensagem: string) {
  const { data, error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
    body: { telefones: [telefone], mensagem, tipo: "lembrete" },
  });
  if (error) return { ok: false, erro: String(error.message ?? error) };
  return { ok: true, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 25);

    const { data: pendentes, error } = await supabase
      .from("notificacoes_fila")
      .select("*")
      .eq("processado", false)
      .lt("tentativas", 5)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    let enviados = 0;
    const erros: string[] = [];

    for (const item of pendentes ?? []) {
      try {
        let responsaveis: string[] = item.responsaveis ?? [];
        const isComentario = item.tipo_evento === "comentario";

        if (isComentario && item.coordenacao_id) {
          const { data: cfgC } = await supabase
            .from("config_alertas_coordenacao")
            .select("tipos_alerta")
            .eq("coordenacao_id", item.coordenacao_id)
            .maybeSingle();
          const tipos: string[] = (cfgC?.tipos_alerta ?? []) as string[];
          // "Comentários" é padrão: só ignora se existir config e o tipo tiver sido desmarcado
          if (cfgC && Array.isArray(tipos) && !tipos.includes("comentario")) {
            await supabase.from("notificacoes_fila")
              .update({ processado: true, processado_em: new Date().toISOString() })
              .eq("id", item.id);
            continue;
          }
        }

        // Regra "Qualquer alteração realizada": se a coordenação tiver esta opção
        // marcada em config_alertas_coordenacao.tipos_alerta, o alerta vai
        // SOMENTE para os coordenadores dessa coordenação (substitui responsáveis).
        let apenasCoordenadores = false;
        if (!isComentario && item.coordenacao_id) {
          const { data: cfgCoord } = await supabase
            .from("config_alertas_coordenacao")
            .select("tipos_alerta")
            .eq("coordenacao_id", item.coordenacao_id)
            .maybeSingle();
          const tipos: string[] = (cfgCoord?.tipos_alerta ?? []) as string[];
          if (Array.isArray(tipos) && tipos.includes("qualquer_alteracao")) {
            apenasCoordenadores = true;
            const coordSet = new Set<string>();
            // 1) coordenador titular da coordenação
            const { data: coordRow } = await supabase
              .from("coordenacoes")
              .select("coordenador_id")
              .eq("id", item.coordenacao_id)
              .maybeSingle();
            if (coordRow?.coordenador_id) coordSet.add(coordRow.coordenador_id);
            // 2) membros da coordenação com role 'coordenador'
            const { data: membros } = await supabase
              .from("membros_coordenacao")
              .select("user_id")
              .eq("coordenacao_id", item.coordenacao_id);
            const memberIds = (membros ?? []).map((m: any) => m.user_id).filter(Boolean);
            if (memberIds.length > 0) {
              const { data: roles } = await supabase
                .from("user_roles")
                .select("user_id, role")
                .in("role", ["coordenador", "assistente_coordenador"])
                .in("user_id", memberIds);
              for (const r of roles ?? []) coordSet.add((r as any).user_id);
            }
            responsaveis = Array.from(coordSet);
          }
        }

        if (responsaveis.length === 0) {
          await supabase.from("notificacoes_fila").update({ processado: true, processado_em: new Date().toISOString() }).eq("id", item.id);
          continue;
        }

        // Perfis + configs
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email, telefone")
          .in("id", responsaveis);
        const { data: configs } = await supabase
          .from("config_notificacoes_usuario")
          .select("*")
          .in("usuario_id", responsaveis);
        const cfgMap = new Map((configs ?? []).map((c: any) => [c.usuario_id, c]));

        // Ator (quem alterou)
        const ctx = (item.contexto ?? {}) as Record<string, any>;
        const atorId: string | null = ctx.alterado_por ?? null;
        let atorNome = "Sistema";
        let atorEmail: string | null = null;
        if (atorId) {
          const { data: ator } = await supabase.from("profiles").select("nome, email").eq("id", atorId).maybeSingle();
          if (ator) { atorNome = ator.nome ?? ator.email ?? "Usuário"; atorEmail = ator.email ?? null; }
        }
        const quandoIso = ctx.alterado_em ?? item.created_at;
        const quando = fmtBRT(quandoIso);

        // Coordenação (nome)
        let coordNome: string | null = null;
        if (item.coordenacao_id) {
          const { data: c } = await supabase.from("coordenacoes").select("nome").eq("id", item.coordenacao_id).maybeSingle();
          coordNome = c?.nome ?? null;
        }

        // Detalhes específicos da entidade
        const detalhes = await buscarDetalhesEntidade(supabase, item.entidade, item.entidade_id);

        const tituloItem = item.titulo ?? labelEntidade(item.entidade);
        const assunto = `[${labelEntidade(item.entidade)}] ${tituloItem} — ${item.status_anterior ?? "?"} → ${item.status_novo ?? "?"}`;

        const linhas: string[] = [
          `${labelEntidade(item.entidade)}: ${tituloItem}`,
          ``,
          `Situação anterior: ${item.status_anterior ?? "-"}`,
          `Nova situação: ${item.status_novo ?? "-"}`,
          `Alterado por: ${atorNome}${atorEmail ? ` <${atorEmail}>` : ""}`,
          `Data/hora: ${quando} (BRT)`,
        ];
        if (coordNome) linhas.push(`Coordenação: ${coordNome}`);
        for (const [k, v] of Object.entries(detalhes)) linhas.push(`${k}: ${v}`);
        linhas.push(``, `Acesse o sistema para conferir.`);
        const corpo = linhas.join("\n");

        // HTML rico
        const rows: string[] = [
          ["Situação anterior", esc(item.status_anterior ?? "-")],
          ["Nova situação", `<strong>${esc(item.status_novo ?? "-")}</strong>`],
          ["Alterado por", esc(atorNome) + (atorEmail ? ` <span style="color:#666">&lt;${esc(atorEmail)}&gt;</span>` : "")],
          ["Data/hora", `${esc(quando)} <span style="color:#666">(BRT)</span>`],
          ...(coordNome ? [["Coordenação", esc(coordNome)] as [string, string]] : []),
          ...Object.entries(detalhes).map(([k, v]) => [esc(k), esc(v)] as [string, string]),
        ].map(([k, v]) => `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 12px;color:#111">${v}</td></tr>`).join("");

        const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:640px">
  <div style="padding:16px 20px;background:#0f172a;color:#fff;border-radius:8px 8px 0 0">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:0.8">${esc(labelEntidade(item.entidade))} · situação alterada</div>
    <div style="font-size:18px;font-weight:600;margin-top:4px">${esc(tituloItem)}</div>
  </div>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
    ${rows}
  </table>
  <p style="color:#666;font-size:12px;margin-top:12px">Acesse o JurisControl para conferir os detalhes.</p>
</div>`;

        // In-app: cria notificação para cada responsável
        const notifRows = responsaveis.map((uid) => {
          const cfg = cfgMap.get(uid);
          if (cfg && cfg.canal_in_app === false) return null;
          if (cfg && cfg.evento_mudanca_situacao === false) return null;
          return {
            usuario_id: uid,
            tipo: "mudanca_situacao",
            titulo: assunto,
            mensagem: corpo,
            lida: false,
            dados: {
              entidade: item.entidade,
              entidade_id: item.entidade_id,
              status_anterior: item.status_anterior,
              status_novo: item.status_novo,
              alterado_por: atorId,
              alterado_por_nome: atorNome,
              alterado_em: quandoIso,
              detalhes,
            },
          };
        }).filter(Boolean);
        if (notifRows.length > 0) {
          await supabase.from("notificacoes").insert(notifRows as any);
        }

        for (const p of profiles ?? []) {
          const cfg: any = cfgMap.get(p.id) ?? {
            canal_email: true, canal_whatsapp: true, evento_mudanca_situacao: true,
            janela_hora_inicio: 8, janela_hora_fim: 20,
          };
          if (cfg.evento_mudanca_situacao === false) continue;
          if (!dentroDaJanela(cfg.janela_hora_inicio, cfg.janela_hora_fim)) continue;

          if (cfg.canal_email && p.email) {
            const r = await enviarEmail(p.email, assunto, corpo, html);
            await supabase.from("historico_alertas_enviados").insert({
              tipo_alerta: "mudanca_situacao", canal: "email", destinatario: p.email,
              conteudo: corpo, referencia_id: item.entidade_id, status: r.ok ? "enviado" : "erro", erro: r.erro,
            });
          }
          if (cfg.canal_whatsapp && p.telefone) {
            const r = await enviarWhatsApp(supabase, p.telefone, corpo);
            await supabase.from("historico_alertas_enviados").insert({
              tipo_alerta: "mudanca_situacao", canal: "whatsapp", destinatario: p.telefone,
              conteudo: corpo, referencia_id: item.entidade_id, status: r.ok ? "enviado" : "erro", erro: r.erro,
            });
          }
        }

        await supabase.from("notificacoes_fila").update({
          processado: true, processado_em: new Date().toISOString(),
        }).eq("id", item.id);
        enviados++;
      } catch (e: any) {
        erros.push(`${item.id}: ${e?.message ?? e}`);
        await supabase.from("notificacoes_fila").update({
          tentativas: (item.tentativas ?? 0) + 1, ultimo_erro: String(e?.message ?? e),
        }).eq("id", item.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, processados: enviados, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});