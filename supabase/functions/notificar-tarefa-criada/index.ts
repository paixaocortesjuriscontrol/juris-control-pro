import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { botaoPainelAlertasHtml } from "../_shared/app-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TarefaCriadaPayload {
  tarefa_id: string;
  titulo: string;
  descricao?: string;
  data_vencimento?: string;
  prioridade: string;
  processo_id?: string;
  responsavel_id: string;
}

// ---------------- formatting helpers ----------------
const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtData = (d?: string | null) => {
  if (!d) return null;
  const s = String(d);
  // yyyy-mm-dd
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString("pt-BR");
};

const fmtHora = (h?: string | null) => {
  if (!h) return null;
  const m = String(h).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : String(h);
};

const has = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "null";

const prioridadeLabel = (p: string) => {
  const map: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    média: "Média",
    alta: "Alta",
    urgente: "Urgente",
  };
  return map[(p || "").toLowerCase()] ?? (p ? p : "—");
};

const prioridadeCor = (p: string) => {
  switch ((p || "").toLowerCase()) {
    case "urgente":
      return "#DC2626";
    case "alta":
      return "#EA580C";
    case "media":
    case "média":
      return "#0EA5E9";
    default:
      return "#16A34A";
  }
};

const prioridadeEmoji = (p: string) => {
  switch ((p || "").toLowerCase()) {
    case "urgente":
      return "🚨";
    case "alta":
      return "⚠️";
    case "media":
    case "média":
      return "🔔";
    default:
      return "✅";
  }
};

function renderRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;color:#374151;font-size:13px;font-weight:600;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;background:#FFFFFF;border:1px solid #E5E7EB;color:#111827;font-size:14px;vertical-align:top;">${value}</td>
    </tr>`;
}

function renderSection(title: string, rows: string[]) {
  if (!rows.length) return "";
  return `
    <h3 style="margin:24px 0 8px 0;color:#1F2937;font-size:15px;border-bottom:2px solid #E5E7EB;padding-bottom:6px;">${escapeHtml(title)}</h3>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      ${rows.join("")}
    </table>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TarefaCriadaPayload = await req.json();
    const { tarefa_id, responsavel_id } = payload;

    if (!tarefa_id || !responsavel_id) {
      return new Response(
        JSON.stringify({ error: "tarefa_id e responsavel_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notificando tarefa criada: ${tarefa_id} para responsável ${responsavel_id}`);

    // Buscar dados COMPLETOS da tarefa (todos os campos)
    const { data: tarefa } = await supabase
      .from("tarefas")
      .select("*")
      .eq("id", tarefa_id)
      .maybeSingle();

    if (!tarefa) {
      console.log("Tarefa não encontrada");
      return new Response(
        JSON.stringify({ message: "Tarefa não encontrada", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do responsável
    const { data: responsavel } = await supabase
      .from('profiles')
      .select('id, nome, email, telefone')
      .eq('id', responsavel_id)
      .maybeSingle();

    if (!responsavel) {
      console.log("Responsável não encontrado");
      return new Response(
        JSON.stringify({ message: "Responsável não encontrado", enviados: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do processo, coordenação, criador, responsáveis extras, envolvidos
    let coordenacaoId: string | null = null;
    let processoNumero: string | null = null;
    let processoAssunto: string | null = null;
    let clienteNome: string | null = null;
    let coordenacaoNome: string | null = null;
    let reclamanteNome: string | null = null;
    let reclamadaNome: string | null = null;

    if (tarefa.processo_id) {
      const { data: processo } = await supabase
        .from('processos')
        .select('numero, assunto, coordenacao_id, cliente_id, reclamante, reclamados, polo_ativo, polo_passivo')
        .eq('id', tarefa.processo_id)
        .maybeSingle();

      if (processo) {
        coordenacaoId = processo.coordenacao_id;
        processoNumero = processo.numero ?? null;
        processoAssunto = (processo as any).assunto ?? null;
        reclamanteNome = (processo as any).reclamante ?? (processo as any).polo_ativo ?? null;
        reclamadaNome = (processo as any).reclamados ?? (processo as any).polo_passivo ?? null;
        if ((processo as any).cliente_id) {
          const { data: cli } = await supabase
            .from("clientes")
            .select("nome")
            .eq("id", (processo as any).cliente_id)
            .maybeSingle();
          clienteNome = cli?.nome ?? null;
        }
      }
    }

    if (coordenacaoId) {
      const { data: coord } = await supabase
        .from("coordenacoes")
        .select("nome")
        .eq("id", coordenacaoId)
        .maybeSingle();
      coordenacaoNome = coord?.nome ?? null;
    }

    // Criador
    let criadorNome: string | null = tarefa.criado_por_nome ?? null;
    if (!criadorNome && tarefa.criado_por) {
      const { data: c } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", tarefa.criado_por)
        .maybeSingle();
      criadorNome = c?.nome ?? null;
    }

    // Responsáveis extras (multi)
    const { data: respRows } = await supabase
      .from("tarefa_responsaveis")
      .select("usuario_id, profiles:profiles!inner(nome)")
      .eq("tarefa_id", tarefa_id);
    const responsaveisNomes = (respRows ?? [])
      .map((r: any) => r.profiles?.nome)
      .filter(Boolean);

    // Envolvidos
    const { data: envRows } = await supabase
      .from("tarefa_envolvidos")
      .select("usuario_id, profiles:profiles!inner(nome)")
      .eq("tarefa_id", tarefa_id);
    const envolvidosNomes = (envRows ?? [])
      .map((r: any) => r.profiles?.nome)
      .filter(Boolean);

    // Enviar alerta direto para o responsável (independente de coordenação)
    const resultados = { emails: 0, whatsapp: 0, erros: [] as string[] };
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // ---- construir seções do e-mail ----
    const titulo = tarefa.titulo ?? "Tarefa";
    const prioridade = String(tarefa.prioridade ?? "media");
    const emoji = prioridadeEmoji(prioridade);
    const corPrioridade = prioridadeCor(prioridade);

    const secGeral: string[] = [];
    secGeral.push(renderRow("Título", escapeHtml(titulo)));
    if (has(tarefa.tipo_tarefa)) secGeral.push(renderRow("Tipo", escapeHtml(tarefa.tipo_tarefa)));
    secGeral.push(
      renderRow(
        "Prioridade",
        `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${corPrioridade};color:#fff;font-size:12px;font-weight:600;">${escapeHtml(prioridadeLabel(prioridade))}</span>`
      )
    );
    if (has(tarefa.status)) secGeral.push(renderRow("Status", escapeHtml(String(tarefa.status))));
    if (has(tarefa.modulo)) secGeral.push(renderRow("Módulo", escapeHtml(tarefa.modulo)));
    if (has(tarefa.quadro_kanban)) secGeral.push(renderRow("Quadro Kanban", escapeHtml(tarefa.quadro_kanban)));
    if (has(tarefa.marcadores)) secGeral.push(renderRow("Marcadores", escapeHtml(tarefa.marcadores)));
    if (has(tarefa.grupos_trabalho)) secGeral.push(renderRow("Grupos de Trabalho", escapeHtml(tarefa.grupos_trabalho)));

    const secPrazos: string[] = [];
    const dv = fmtData(tarefa.data_vencimento) ?? fmtData(tarefa.data_prevista);
    if (dv) secPrazos.push(renderRow("Data Prevista", escapeHtml(dv)));
    if (has(tarefa.hora_prevista)) secPrazos.push(renderRow("Hora Prevista", escapeHtml(fmtHora(tarefa.hora_prevista)!)));
    const df = fmtData(tarefa.data_fatal);
    if (df) secPrazos.push(renderRow("Data Fatal", escapeHtml(df)));
    if (has(tarefa.hora_fatal)) secPrazos.push(renderRow("Hora Fatal", escapeHtml(fmtHora(tarefa.hora_fatal)!)));
    if (has(tarefa.data_base)) secPrazos.push(renderRow("Data Base", escapeHtml(fmtData(tarefa.data_base)!)));
    if (has(tarefa.prazo_dias))
      secPrazos.push(renderRow("Prazo", `${escapeHtml(String(tarefa.prazo_dias))} ${escapeHtml(tarefa.prazo_unidade ?? "dias")}`));
    if (has(tarefa.alerta_dias))
      secPrazos.push(renderRow("Alerta", `${escapeHtml(String(tarefa.alerta_dias))} ${escapeHtml(tarefa.alerta_unidade ?? "dias")}`));

    const secPessoas: string[] = [];
    secPessoas.push(
      renderRow(
        "Responsável Principal",
        `${escapeHtml(responsavel.nome ?? "—")}${responsavel.email ? ` <span style="color:#6B7280;">&lt;${escapeHtml(responsavel.email)}&gt;</span>` : ""}`
      )
    );
    if (responsaveisNomes.length > 0)
      secPessoas.push(renderRow("Responsáveis", escapeHtml(responsaveisNomes.join(", "))));
    if (envolvidosNomes.length > 0)
      secPessoas.push(renderRow("Envolvidos (acompanham)", escapeHtml(envolvidosNomes.join(", "))));
    if (criadorNome) secPessoas.push(renderRow("Criado por", escapeHtml(criadorNome)));

    const secProcesso: string[] = [];
    if (processoNumero) secProcesso.push(renderRow("Nº Processo", escapeHtml(processoNumero)));
    if (processoAssunto) secProcesso.push(renderRow("Assunto", escapeHtml(processoAssunto)));
    if (clienteNome) secProcesso.push(renderRow("Cliente", escapeHtml(clienteNome)));
    if (coordenacaoNome) secProcesso.push(renderRow("Coordenação", escapeHtml(coordenacaoNome)));
    if (has(tarefa.orgao)) secProcesso.push(renderRow("Órgão", escapeHtml(tarefa.orgao)));
    if (has(tarefa.orgao_julgador)) secProcesso.push(renderRow("Órgão Julgador", escapeHtml(tarefa.orgao_julgador)));
    if (has(tarefa.instancia)) secProcesso.push(renderRow("Instância", escapeHtml(tarefa.instancia)));
    if (has(tarefa.situacao_processo)) secProcesso.push(renderRow("Situação do Processo", escapeHtml(tarefa.situacao_processo)));
    const reclamanteFinal = reclamanteNome ?? (has(tarefa.partes_ativas) ? tarefa.partes_ativas : null);
    const reclamadaFinal = reclamadaNome ?? (has(tarefa.partes_passivas) ? tarefa.partes_passivas : null);
    if (has(reclamanteFinal)) secProcesso.push(renderRow("Reclamante", escapeHtml(reclamanteFinal)));
    if (has(reclamadaFinal)) secProcesso.push(renderRow("Reclamada", escapeHtml(reclamadaFinal)));
    if (has(tarefa.outras_partes)) secProcesso.push(renderRow("Outras Partes", escapeHtml(tarefa.outras_partes)));
    if (has(tarefa.envolvimento_clientes)) secProcesso.push(renderRow("Clientes Envolvidos", escapeHtml(tarefa.envolvimento_clientes)));
    if (has(tarefa.envolvimento_contrarios)) secProcesso.push(renderRow("Contrários", escapeHtml(tarefa.envolvimento_contrarios)));
    if (has(tarefa.link_local)) secProcesso.push(renderRow("Link/Local", `<a href="${escapeHtml(tarefa.link_local)}" style="color:#2563EB;">${escapeHtml(tarefa.link_local)}</a>`));

    const secDescricao =
      has(tarefa.descricao) || has(tarefa.observacoes) || has(tarefa.descricao_ultimo_andamento)
        ? `
          <h3 style="margin:24px 0 8px 0;color:#1F2937;font-size:15px;border-bottom:2px solid #E5E7EB;padding-bottom:6px;">Descrição e Observações</h3>
          ${has(tarefa.descricao) ? `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px;color:#111827;font-size:14px;white-space:pre-wrap;margin-bottom:8px;"><strong style="display:block;color:#6B7280;font-size:12px;margin-bottom:4px;">DESCRIÇÃO</strong>${escapeHtml(tarefa.descricao)}</div>` : ""}
          ${has(tarefa.observacoes) ? `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px;color:#111827;font-size:14px;white-space:pre-wrap;margin-bottom:8px;"><strong style="display:block;color:#6B7280;font-size:12px;margin-bottom:4px;">OBSERVAÇÕES</strong>${escapeHtml(tarefa.observacoes)}</div>` : ""}
          ${has(tarefa.descricao_ultimo_andamento) ? `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px;color:#111827;font-size:14px;white-space:pre-wrap;"><strong style="display:block;color:#6B7280;font-size:12px;margin-bottom:4px;">ÚLTIMO ANDAMENTO</strong>${escapeHtml(tarefa.descricao_ultimo_andamento)}</div>` : ""}
        `
        : "";

    // Enviar e-mail direto para o responsável
    if (resendApiKey && responsavel.email) {
      try {
        const emailHtml = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#FFFFFF;">
            <div style="background:linear-gradient(135deg,#16A34A 0%,#15803D 100%);color:#fff;padding:22px 24px;border-radius:8px 8px 0 0;">
              <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.5px;">${emoji} Nova Tarefa Atribuída</div>
              <h2 style="margin:6px 0 0 0;font-size:22px;line-height:1.3;">${escapeHtml(titulo)}</h2>
              ${processoNumero ? `<div style="margin-top:6px;font-size:13px;opacity:.9;">Processo ${escapeHtml(processoNumero)}${coordenacaoNome ? ` • ${escapeHtml(coordenacaoNome)}` : ""}</div>` : coordenacaoNome ? `<div style="margin-top:6px;font-size:13px;opacity:.9;">${escapeHtml(coordenacaoNome)}</div>` : ""}
            </div>
            <div style="padding:24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;">
              ${renderSection("Informações Gerais", secGeral)}
              ${renderSection("Prazos", secPrazos)}
              ${renderSection("Pessoas", secPessoas)}
              ${secProcesso.length ? renderSection("Processo", secProcesso) : ""}
              ${secDescricao}
              ${botaoPainelAlertasHtml(tarefa_id)}
              <div style="margin-top:28px;padding-top:16px;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:12px;text-align:center;">
                Este alerta foi enviado automaticamente pelo Juris Control Pro.
              </div>
            </div>
          </div>
        `;

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Juris Control <alerta@juriscontrol.adv.br>",
            to: [responsavel.email],
            subject: `${emoji} Nova Tarefa: ${titulo}`,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          resultados.emails++;
          console.log(`Email enviado para ${responsavel.email}`);
        } else {
          const errorText = await response.text();
          console.error(`Erro ao enviar email: ${errorText}`);
          resultados.erros.push(`Email: ${errorText}`);
        }
      } catch (error: any) {
        console.error("Erro ao enviar email:", error);
        resultados.erros.push(`Email: ${error?.message}`);
      }
    }

    // Enviar WhatsApp direto para o responsável
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (zapiInstanceId && zapiToken && responsavel.telefone) {
      try {
        let phoneFormatted = responsavel.telefone.replace(/\D/g, '');
        if (!phoneFormatted.startsWith('55')) {
          phoneFormatted = '55' + phoneFormatted;
        }
        if (phoneFormatted.length === 12 && phoneFormatted.startsWith('55')) {
          const ddd = phoneFormatted.slice(2, 4);
          const numero = phoneFormatted.slice(4);
          phoneFormatted = `55${ddd}9${numero}`;
        }

        const linhas: string[] = [];
        linhas.push(`${emoji} *Nova Tarefa Atribuída*`);
        linhas.push("");
        linhas.push(`📋 *${titulo}*`);
        if (has(tarefa.tipo_tarefa)) linhas.push(`🏷️ Tipo: ${tarefa.tipo_tarefa}`);
        linhas.push(`⚡ Prioridade: ${prioridadeLabel(prioridade)}`);
        if (dv) linhas.push(`📅 Prevista: ${dv}${has(tarefa.hora_prevista) ? " " + fmtHora(tarefa.hora_prevista) : ""}`);
        if (df) linhas.push(`⏰ Fatal: ${df}${has(tarefa.hora_fatal) ? " " + fmtHora(tarefa.hora_fatal) : ""}`);
        if (processoNumero) linhas.push(`📁 Processo: ${processoNumero}`);
        if (has(reclamanteFinal)) linhas.push(`⚖️ Reclamante: ${reclamanteFinal}`);
        if (has(reclamadaFinal)) linhas.push(`🏛️ Reclamada: ${reclamadaFinal}`);
        if (clienteNome) linhas.push(`👤 Cliente: ${clienteNome}`);
        if (coordenacaoNome) linhas.push(`🏢 Coordenação: ${coordenacaoNome}`);
        if (responsaveisNomes.length) linhas.push(`👥 Responsáveis: ${responsaveisNomes.join(", ")}`);
        if (envolvidosNomes.length) linhas.push(`👀 Envolvidos: ${envolvidosNomes.join(", ")}`);
        if (criadorNome) linhas.push(`✍️ Criado por: ${criadorNome}`);
        if (has(tarefa.descricao)) {
          linhas.push("");
          linhas.push(`📝 ${tarefa.descricao}`);
        }
        linhas.push("");
        linhas.push("_Juris Control Pro_");
        const whatsappMensagem = linhas.join("\n");

        const response = await fetch(
          `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": zapiClientToken || "",
            },
            body: JSON.stringify({
              phone: phoneFormatted,
              message: whatsappMensagem,
            }),
          }
        );

        if (response.ok) {
          resultados.whatsapp++;
          console.log(`WhatsApp enviado para ${responsavel.telefone}`);
        } else {
          const errorText = await response.text();
          console.error(`Erro ao enviar WhatsApp: ${errorText}`);
          resultados.erros.push(`WhatsApp: ${errorText}`);
        }
      } catch (error: any) {
        console.error("Erro ao enviar WhatsApp:", error);
        resultados.erros.push(`WhatsApp: ${error?.message}`);
      }
    }

    // Se tem coordenação, enviar alerta via sistema de coordenação também
    if (coordenacaoId) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/enviar-alerta-coordenacao`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            tipo_alerta: "tarefas",
            coordenacao_id: coordenacaoId,
            titulo: `✅ Nova Tarefa: ${titulo}`,
            mensagem: `Tarefa atribuída a ${responsavel.nome}. ${dv ? "Prevista: " + dv : ""}${df ? " | Fatal: " + df : ""}`,
            prioridade: prioridade,
            referencia_id: tarefa_id,
            processo_numero: processoNumero,
          }),
        });
        console.log(`Alerta de coordenação enviado para ${coordenacaoId}`);
      } catch (error) {
        console.error("Erro ao enviar alerta de coordenação:", error);
      }
    }

    console.log(`Resultados: ${resultados.emails} emails, ${resultados.whatsapp} whatsapp`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados: resultados.emails + resultados.whatsapp,
        detalhes: resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
