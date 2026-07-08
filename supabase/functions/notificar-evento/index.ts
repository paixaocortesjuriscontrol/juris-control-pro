import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificarEventoRequest {
  evento_id: string;
  participantes_ids: string[];
  tipo_notificacao: 'criacao' | 'lembrete' | 'atualizacao';
}

// ---------- helpers ----------
const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const has = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "null";

const fmtMoeda = (v: number | null | undefined) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

const diasSemanaLabel = (arr: number[] | null | undefined) => {
  if (!arr?.length) return null;
  const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return arr.map((n) => nomes[n] ?? String(n)).join(", ");
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

    const { evento_id, participantes_ids, tipo_notificacao }: NotificarEventoRequest = await req.json();

    // Buscar dados COMPLETOS do evento
    const { data: evento, error: eventoError } = await supabase
      .from('eventos_agenda')
      .select('*')
      .eq('id', evento_id)
      .single();

    if (eventoError || !evento) {
      throw new Error(`Evento não encontrado: ${eventoError?.message}`);
    }

    // Processo vinculado
    let processoNumero: string | null = null;
    let processoAssunto: string | null = null;
    let clienteNome: string | null = null;
    if ((evento as any).processo_id) {
      const { data: proc } = await supabase
        .from("processos")
        .select("numero, assunto, cliente_id")
        .eq("id", (evento as any).processo_id)
        .maybeSingle();
      if (proc) {
        processoNumero = (proc as any).numero ?? null;
        processoAssunto = (proc as any).assunto ?? null;
        if ((proc as any).cliente_id) {
          const { data: cli } = await supabase
            .from("clientes")
            .select("nome")
            .eq("id", (proc as any).cliente_id)
            .maybeSingle();
          clienteNome = cli?.nome ?? null;
        }
      }
    }

    // Criador
    let criadorNome: string | null = null;
    if ((evento as any).criado_por) {
      const { data: c } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", (evento as any).criado_por)
        .maybeSingle();
      criadorNome = c?.nome ?? null;
    }

    // Buscar participantes com email habilitado
    const { data: participantes, error: partError } = await supabase
      .from('profiles')
      .select('id, nome, email, notificacoes_email')
      .in('id', participantes_ids);

    if (partError) {
      throw new Error(`Erro ao buscar participantes: ${partError.message}`);
    }

    // Filtrar apenas quem tem notificações por email ativadas
    const participantesComEmail = participantes?.filter(p => p.notificacoes_email && p.email) || [];
    // Nomes de todos os participantes (para exibir no e-mail, mesmo os sem notificação)
    const participantesNomes = (participantes ?? []).map((p) => p.nome).filter(Boolean);

    if (participantesComEmail.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum participante com notificações por email ativadas",
          emails_enviados: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar data/hora do evento
    const dataEvento = new Date(evento.data_inicio);
    const dataFormatada = dataEvento.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const horaFormatada = (evento as any).dia_inteiro
      ? "Dia inteiro"
      : dataEvento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const dataFimFormatada = (evento as any).data_fim
      ? new Date((evento as any).data_fim).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    // Definir assunto e cor do cabeçalho baseado no tipo
    let assunto = '';
    let mensagemIntro = '';
    let corHeader = "#3B82F6";
    let iconeHeader = "📅";
    switch (tipo_notificacao) {
      case 'criacao':
        assunto = `📅 Novo evento: ${evento.titulo}`;
        mensagemIntro = 'Você foi adicionado(a) a um novo evento:';
        corHeader = "#3B82F6";
        iconeHeader = "📅";
        break;
      case 'lembrete':
        assunto = `⏰ Lembrete: ${evento.titulo}`;
        mensagemIntro = 'Lembrete do seu evento agendado:';
        corHeader = "#F59E0B";
        iconeHeader = "⏰";
        break;
      case 'atualizacao':
        assunto = `🔄 Evento atualizado: ${evento.titulo}`;
        mensagemIntro = 'Um evento do qual você participa foi atualizado:';
        corHeader = "#8B5CF6";
        iconeHeader = "🔄";
        break;
    }

    // Montar seções
    const secGeral: string[] = [];
    if (has((evento as any).tipo)) secGeral.push(renderRow("Tipo", escapeHtml((evento as any).tipo)));
    if (has((evento as any).status)) secGeral.push(renderRow("Status", escapeHtml((evento as any).status)));
    if (has((evento as any).modalidade)) secGeral.push(renderRow("Modalidade", escapeHtml((evento as any).modalidade)));
    if (has((evento as any).local))
      secGeral.push(renderRow("Local", escapeHtml((evento as any).local)));

    const secQuando: string[] = [];
    secQuando.push(renderRow("Início", `${escapeHtml(dataFormatada)} ${escapeHtml(horaFormatada)}`));
    if (dataFimFormatada) secQuando.push(renderRow("Término", escapeHtml(dataFimFormatada)));
    if ((evento as any).dia_inteiro) secQuando.push(renderRow("Duração", "Dia inteiro"));

    if ((evento as any).recorrente) {
      const rec: string[] = [];
      if (has((evento as any).recorrencia_tipo)) rec.push(String((evento as any).recorrencia_tipo));
      if ((evento as any).recorrencia_intervalo)
        rec.push(`a cada ${(evento as any).recorrencia_intervalo}`);
      const ds = diasSemanaLabel((evento as any).recorrencia_dias_semana);
      if (ds) rec.push(`dias: ${ds}`);
      if ((evento as any).recorrencia_ate)
        rec.push(`até ${new Date((evento as any).recorrencia_ate).toLocaleDateString("pt-BR")}`);
      if ((evento as any).recorrencia_fim)
        rec.push(`fim: ${new Date((evento as any).recorrencia_fim).toLocaleDateString("pt-BR")}`);
      secQuando.push(renderRow("Recorrência", escapeHtml(rec.join(" • ") || "Recorrente")));
    }

    const secParcelamento: string[] = [];
    if ((evento as any).total_parcelas) {
      secParcelamento.push(
        renderRow(
          "Parcela",
          escapeHtml(`${(evento as any).numero_parcela ?? "?"} de ${(evento as any).total_parcelas}`)
        )
      );
    }
    if (fmtMoeda((evento as any).valor_parcela))
      secParcelamento.push(renderRow("Valor da Parcela", escapeHtml(fmtMoeda((evento as any).valor_parcela)!)));
    if (has((evento as any).grupo_parcelas))
      secParcelamento.push(renderRow("Grupo", escapeHtml((evento as any).grupo_parcelas)));

    const secProcesso: string[] = [];
    if (processoNumero) secProcesso.push(renderRow("Nº Processo", escapeHtml(processoNumero)));
    if (processoAssunto) secProcesso.push(renderRow("Assunto", escapeHtml(processoAssunto)));
    if (clienteNome) secProcesso.push(renderRow("Cliente", escapeHtml(clienteNome)));

    const secPessoas: string[] = [];
    if (criadorNome) secPessoas.push(renderRow("Criado por", escapeHtml(criadorNome)));
    if (participantesNomes.length)
      secPessoas.push(renderRow("Participantes", escapeHtml(participantesNomes.join(", "))));
    if ((evento as any).enviar_whatsapp)
      secPessoas.push(renderRow("WhatsApp", "Envio automático habilitado"));

    const secDescricao = has((evento as any).descricao)
      ? `
        <h3 style="margin:24px 0 8px 0;color:#1F2937;font-size:15px;border-bottom:2px solid #E5E7EB;padding-bottom:6px;">Descrição</h3>
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:12px;color:#111827;font-size:14px;white-space:pre-wrap;">${escapeHtml((evento as any).descricao)}</div>`
      : "";

    // Enviar emails para cada participante
    const emailsEnviados: string[] = [];
    const erros: string[] = [];

    for (const participante of participantesComEmail) {
      try {
        const html = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="margin:0;padding:20px;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border-radius:8px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,${corHeader} 0%,${corHeader}CC 100%);color:#fff;padding:22px 24px;">
                <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.5px;">${iconeHeader} ${escapeHtml(mensagemIntro)}</div>
                <h2 style="margin:6px 0 0 0;font-size:22px;line-height:1.3;">${escapeHtml(evento.titulo)}</h2>
              </div>
              <div style="padding:24px;">
                ${renderSection("Informações Gerais", secGeral)}
                ${renderSection("Quando", secQuando)}
                ${secParcelamento.length ? renderSection("Parcelamento", secParcelamento) : ""}
                ${secProcesso.length ? renderSection("Processo", secProcesso) : ""}
                ${renderSection("Pessoas", secPessoas)}
                ${secDescricao}
                <div style="margin-top:28px;padding-top:16px;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:12px;text-align:center;">
                  Enviado automaticamente pelo Juris Control Pro.<br>
                  Para desativar notificações por email, acesse suas configurações.
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        const { error: emailError } = await resend.emails.send({
          from: "Juris Control <alerta@juriscontrol.adv.br>",
          to: [participante.email],
          subject: assunto,
          html,
        });

        if (emailError) {
          console.error(`Erro ao enviar email para ${participante.email}:`, emailError);
          erros.push(`${participante.email}: ${emailError.message}`);
        } else {
          console.log(`Email enviado com sucesso para ${participante.email}`);
          emailsEnviados.push(participante.email);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Exceção ao enviar email para ${participante.email}:`, errorMessage);
        erros.push(`${participante.email}: ${errorMessage}`);
      }
    }

    console.log(`Emails enviados: ${emailsEnviados.length}, Erros: ${erros.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        emails_enviados: emailsEnviados.length,
        emails: emailsEnviados,
        erros: erros.length > 0 ? erros : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro na função notificar-evento:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
