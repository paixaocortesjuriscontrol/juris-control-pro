import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatarTelefone(telefone: string): string | null {
  if (!telefone) return null;
  let numeros = telefone.replace(/\D/g, "");
  if (numeros.startsWith("0")) numeros = numeros.substring(1);
  if (numeros.length === 10 || numeros.length === 11) numeros = "55" + numeros;
  if (numeros.length < 12 || numeros.length > 13) {
    console.log(`Telefone inválido após formatação: ${telefone} -> ${numeros}`);
    return null;
  }
  return numeros;
}

function formatarDataBR(dateStr: string) {
  // dateStr está no formato "YYYY-MM-DD"
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatarValor(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "Valor não informado";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function montarMensagemLembreteParcela(params: {
  titulo: string;
  descricao?: string | null;
  data_vencimento: string;
  valor?: number | null;
  numero_parcela: number;
  total_parcelas: number;
  minutos_antes: number;
  hora_base: string;
}) {
  const dataBR = formatarDataBR(params.data_vencimento);

  let msg = `⏰ *LEMBRETE DE PARCELA*\n\n`;
  msg += `Faltam *${params.minutos_antes} minutos* para o vencimento:\n\n`;
  msg += `📌 *${params.titulo}*\n`;
  msg += `💰 Parcela: ${params.numero_parcela}/${params.total_parcelas}\n`;
  msg += `📆 Vencimento: ${dataBR}\n`;
  msg += `💵 Valor: ${formatarValor(params.valor)}\n`;
  if (params.descricao) {
    msg += `\n📝 *Descrição:*\n${params.descricao}\n`;
  }
  msg += `\n_JurisControl - Sistema de Gestão Jurídica_`;
  return msg;
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
    }

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error("Credenciais da Z-API não configuradas (INSTANCE_ID, TOKEN ou CLIENT_TOKEN)");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let limit = 25;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.limit === "number" && body.limit > 0) limit = Math.min(body.limit, 50);
    } catch {
      // ignore
    }

    const now = new Date();
    console.log(`[processar-alertas-parcela] Início ${now.toISOString()} | limit=${limit}`);

    // Buscar alertas de parcelas pendentes
    const { data: alertas, error: alertasError } = await supabase
      .from("alertas_parcela")
      .select(`
        id, parcela_id, minutos_antes, enviado, enviado_em,
        parcelas_evento!inner(
          id, numero, data_vencimento, valor, status,
          eventos_agenda!inner(
            id, titulo, descricao, data_inicio, enviar_whatsapp, status, total_parcelas
          )
        )
      `)
      .or("enviado.is.null,enviado.eq.false")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (alertasError) throw alertasError;

    const lista = (alertas ?? []) as unknown as Array<any>;
    console.log(`[processar-alertas-parcela] Alertas pendentes encontrados: ${lista.length}`);

    const results: Array<{
      alerta_id: string;
      parcela_id: string;
      status: "enviado" | "nao_devido" | "sem_participantes" | "sem_telefones" | "ignorado" | "erro";
      enviados?: number;
      falhas?: number;
      erro?: string;
    }> = [];

    for (const alertaRaw of lista) {
      const alerta: any = alertaRaw;
      const parcelaRaw = alerta?.parcelas_evento;
      const parcela = Array.isArray(parcelaRaw) ? parcelaRaw[0] : parcelaRaw;
      const eventoRaw = parcela?.eventos_agenda;
      const evento = Array.isArray(eventoRaw) ? eventoRaw[0] : eventoRaw;
      const alertaId: string = alerta?.id;

      if (!alertaId) {
        results.push({ alerta_id: "(sem-id)", parcela_id: alerta?.parcela_id ?? "(sem-parcela)", status: "erro", erro: "Alerta sem id" });
        continue;
      }

      if (!parcela || !evento) {
        results.push({ alerta_id: alertaId, parcela_id: alerta?.parcela_id ?? "(sem-parcela)", status: "erro", erro: "Parcela ou evento não encontrado no join" });
        continue;
      }

      try {
        // Regras de elegibilidade
        if (parcela.status !== "pendente") {
          // Parcela já foi paga ou está atrasada - marca como enviado para não processar novamente
          await supabase
            .from("alertas_parcela")
            .update({ enviado: true, enviado_em: now.toISOString() })
            .eq("id", alertaId);
          results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "ignorado" });
          continue;
        }
        
        if (evento.enviar_whatsapp === false) {
          results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "ignorado" });
          continue;
        }

        // Para parcelas, a data base é a data de vencimento + hora base do evento
        const dataVencimento = parcela.data_vencimento; // "YYYY-MM-DD"
        const horaBase = new Date(evento.data_inicio).toTimeString().slice(0, 5); // "HH:MM"
        const dataHoraVencimento = new Date(`${dataVencimento}T${horaBase}:00-03:00`);
        const dueAt = new Date(dataHoraVencimento.getTime() - alerta.minutos_antes * 60_000);

        // Se ainda não chegou no horário de disparo, deixa pendente
        if (now.getTime() < dueAt.getTime()) {
          results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "nao_devido" });
          continue;
        }

        // Evitar envio para parcelas muito no passado (mais de 1 hora depois do vencimento)
        if (now.getTime() > dataHoraVencimento.getTime() + 60 * 60_000) {
          await supabase
            .from("alertas_parcela")
            .update({ enviado: true, enviado_em: now.toISOString() })
            .eq("id", alertaId);

          results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "ignorado" });
          continue;
        }

        // Buscar participantes do evento pai
        const { data: participantes, error: partError } = await supabase
          .from("participantes_evento")
          .select("usuario_id")
          .eq("evento_id", evento.id);

        if (partError) throw partError;

        const userIds = (participantes || []).map((p: any) => p.usuario_id).filter(Boolean);
        console.log(`[processar-alertas-parcela] Parcela ${parcela.id} - Participantes: ${userIds.length}`, userIds);
        
        if (userIds.length === 0) {
          results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "sem_participantes" });
          continue;
        }

        // Buscar telefones
        const { data: perfis, error: perfisError } = await supabase
          .from("profiles")
          .select("id, nome, telefone")
          .in("id", userIds);

        if (perfisError) throw perfisError;

        const telefones = (perfis || [])
          .map((p: any) => p.telefone as string | null)
          .filter((t: string | null) => !!t) as string[];

        console.log(`[processar-alertas-parcela] Telefones válidos: ${telefones.length}`, telefones);

        if (telefones.length === 0) {
          results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "sem_telefones" });
          continue;
        }

        const mensagem = montarMensagemLembreteParcela({
          titulo: evento.titulo,
          descricao: evento.descricao,
          data_vencimento: parcela.data_vencimento,
          valor: parcela.valor,
          numero_parcela: parcela.numero,
          total_parcelas: evento.total_parcelas || 1,
          minutos_antes: alerta.minutos_antes,
          hora_base: horaBase,
        });

        const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

        let enviados = 0;
        let falhas = 0;

        for (const tel of telefones) {
          const telFmt = formatarTelefone(tel);
          if (!telFmt) {
            falhas++;
            continue;
          }

          const resp = await fetch(zapiUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Client-Token": ZAPI_CLIENT_TOKEN,
            },
            body: JSON.stringify({ phone: telFmt, message: mensagem }),
          });

          const respJson = await resp.json().catch(() => ({}));

          if (resp.ok && !respJson?.error) {
            enviados++;
          } else {
            falhas++;
            console.log(`[processar-alertas-parcela] Falha Z-API tel=${telFmt}`, respJson);
          }
        }

        await supabase
          .from("alertas_parcela")
          .update({ enviado: true, enviado_em: now.toISOString() })
          .eq("id", alertaId);

        results.push({ alerta_id: alertaId, parcela_id: parcela.id, status: "enviado", enviados, falhas });
      } catch (err: any) {
        console.error(`[processar-alertas-parcela] Erro alerta_id=${alertaId}`, err);
        results.push({
          alerta_id: alertaId,
          parcela_id: alerta.parcela_id,
          status: "erro",
          erro: err?.message ?? "Erro desconhecido",
        });
      }
    }

    // Verificar se todas as parcelas foram pagas para marcar o evento como concluído
    const eventoIds = [...new Set(lista.map((a: any) => a?.parcelas_evento?.eventos_agenda?.id).filter(Boolean))];
    for (const eventoId of eventoIds) {
      const { data: parcelasPendentes } = await supabase
        .from("parcelas_evento")
        .select("id")
        .eq("evento_id", eventoId)
        .eq("status", "pendente")
        .limit(1);
      
      if (!parcelasPendentes || parcelasPendentes.length === 0) {
        // Todas as parcelas foram pagas - marcar evento como concluído e não recorrente
        await supabase
          .from("eventos_agenda")
          .update({ 
            status: "concluido", 
            recorrente: false,
            concluido_em: now.toISOString(),
          })
          .eq("id", eventoId);
        console.log(`[processar-alertas-parcela] Evento ${eventoId} marcado como concluído (todas parcelas pagas)`);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`[processar-alertas-parcela] Fim | elapsed=${elapsedMs}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        checked: lista.length,
        results,
        elapsedMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[processar-alertas-parcela] Erro geral:", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
