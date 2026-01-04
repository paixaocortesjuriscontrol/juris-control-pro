import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertaEventoRow = {
  id: string;
  evento_id: string;
  minutos_antes: number;
  enviado: boolean | null;
  enviado_em: string | null;
  eventos_agenda: {
    id: string;
    titulo: string;
    descricao: string | null;
    data_inicio: string;
    dia_inteiro: boolean | null;
    local: string | null;
    status: string;
    enviar_whatsapp: boolean | null;
  };
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

function formatarDataHoraBR(dateIso: string) {
  const d = new Date(dateIso);
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);

  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

  return { data, hora };
}

function montarMensagemLembrete(params: {
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  dia_inteiro?: boolean;
  local?: string | null;
  minutos_antes: number;
}) {
  const { data, hora } = formatarDataHoraBR(params.data_inicio);
  const diaInteiro = !!params.dia_inteiro;

  let msg = `⏰ *LEMBRETE DE EVENTO*\n\n`;
  msg += `Faltam *${params.minutos_antes} minutos* para o seu compromisso:\n\n`;
  msg += `📌 *${params.titulo}*\n`;
  msg += `📆 Data: ${data}\n`;
  if (!diaInteiro) msg += `🕐 Horário: ${hora}\n`;
  if (params.local) msg += `📍 Local: ${params.local}\n`;
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
    console.log(`[processar-alertas-evento] Início ${now.toISOString()} | limit=${limit}`);

    const { data: alertas, error: alertasError } = await supabase
      .from("alertas_evento")
      .select(
        `id, evento_id, minutos_antes, enviado, enviado_em,
         eventos_agenda!inner(id, titulo, descricao, data_inicio, dia_inteiro, local, status, enviar_whatsapp)`
      )
      .or("enviado.is.null,enviado.eq.false")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (alertasError) throw alertasError;

    const lista = (alertas ?? []) as unknown as Array<any>;
    console.log(`[processar-alertas-evento] Alertas pendentes encontrados: ${lista.length}`);

    const results: Array<{
      alerta_id: string;
      evento_id: string;
      status: "enviado" | "nao_devido" | "sem_participantes" | "sem_telefones" | "ignorado" | "erro";
      enviados?: number;
      falhas?: number;
      erro?: string;
    }> = [];

    for (const alertaRaw of lista) {
      const alerta: any = alertaRaw;
      const eventoRaw = alerta?.eventos_agenda;
      const evento = Array.isArray(eventoRaw) ? eventoRaw[0] : eventoRaw;
      const alertaId: string = alerta?.id;

      if (!alertaId) {
        results.push({ alerta_id: "(sem-id)", evento_id: alerta?.evento_id ?? "(sem-evento)", status: "erro", erro: "Alerta sem id" });
        continue;
      }

      if (!evento) {
        results.push({ alerta_id: alertaId, evento_id: alerta?.evento_id ?? "(sem-evento)", status: "erro", erro: "Evento não encontrado no join" });
        continue;
      }

      try {
        // Regras de elegibilidade
        if (evento.status !== "pendente") {
          results.push({ alerta_id: alertaId, evento_id: evento.id, status: "ignorado" });
          continue;
        }
        if (evento.enviar_whatsapp === false) {
          results.push({ alerta_id: alertaId, evento_id: evento.id, status: "ignorado" });
          continue;
        }

        const startAt = new Date(evento.data_inicio);
        const dueAt = new Date(startAt.getTime() - alerta.minutos_antes * 60_000);

        // Se ainda não chegou no horário de disparo, deixa pendente
        if (now.getTime() < dueAt.getTime()) {
          results.push({ alerta_id: alertaId, evento_id: evento.id, status: "nao_devido" });
          continue;
        }

        // Evitar envio para eventos muito no passado (mais de 15 min depois do início)
        if (now.getTime() > startAt.getTime() + 15 * 60_000) {
          await supabase
            .from("alertas_evento")
            .update({ enviado: true, enviado_em: now.toISOString() })
            .eq("id", alertaId);

          results.push({ alerta_id: alertaId, evento_id: evento.id, status: "ignorado" });
          continue;
        }

        // Buscar participantes
        const { data: participantes, error: partError } = await supabase
          .from("participantes_evento")
          .select("usuario_id")
          .eq("evento_id", evento.id);

        if (partError) throw partError;

        const userIds = (participantes || []).map((p: any) => p.usuario_id).filter(Boolean);
        console.log(`[processar-alertas-evento] Evento ${evento.id} - Participantes: ${userIds.length}`, userIds);
        
        if (userIds.length === 0) {
          // Mantém o alerta pendente para permitir que participantes sejam adicionados depois
          results.push({ alerta_id: alertaId, evento_id: evento.id, status: "sem_participantes" });
          continue;
        }

        // Buscar telefones
        const { data: perfis, error: perfisError } = await supabase
          .from("profiles")
          .select("id, nome, telefone")
          .in("id", userIds);

        if (perfisError) throw perfisError;

        console.log(`[processar-alertas-evento] Perfis encontrados:`, perfis?.map((p: any) => ({ nome: p.nome, telefone: p.telefone })));

        const telefones = (perfis || [])
          .map((p: any) => p.telefone as string | null)
          .filter((t: string | null) => !!t) as string[];

        console.log(`[processar-alertas-evento] Telefones válidos: ${telefones.length}`, telefones);

        if (telefones.length === 0) {
          // Mantém o alerta pendente para permitir que os usuários preencham o telefone depois
          results.push({ alerta_id: alertaId, evento_id: evento.id, status: "sem_telefones" });
          continue;
        }

        const mensagem = montarMensagemLembrete({
          titulo: evento.titulo,
          descricao: evento.descricao,
          data_inicio: evento.data_inicio,
          dia_inteiro: !!evento.dia_inteiro,
          local: evento.local,
          minutos_antes: alerta.minutos_antes,
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
            console.log(`[processar-alertas-evento] Falha Z-API tel=${telFmt}`, respJson);
          }
        }

        await supabase
          .from("alertas_evento")
          .update({ enviado: true, enviado_em: now.toISOString() })
          .eq("id", alertaId);

        results.push({ alerta_id: alertaId, evento_id: evento.id, status: "enviado", enviados, falhas });
      } catch (err: any) {
        console.error(`[processar-alertas-evento] Erro alerta_id=${alertaId}`, err);
        results.push({
          alerta_id: alertaId,
          evento_id: alerta.evento_id,
          status: "erro",
          erro: err?.message ?? "Erro desconhecido",
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`[processar-alertas-evento] Fim | elapsed=${elapsedMs}ms`);

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
    console.error("[processar-alertas-evento] Erro geral:", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
