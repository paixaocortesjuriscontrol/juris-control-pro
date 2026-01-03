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

serve(async (req) => {
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
      throw new Error("Credenciais da Z-API não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const now = new Date();
    console.log(`[processar-lembretes-audiencia] Início ${now.toISOString()}`);

    // Buscar lembretes pendentes com audiências
    const { data: lembretes, error: lembretesError } = await supabase
      .from("lembretes_audiencia")
      .select(`
        id, audiencia_id, minutos_antes, enviado,
        audiencia:audiencias_detectadas!inner(
          id, processo_numero, data_audiencia, hora_brasilia, hora,
          tipo_audiencia, cliente, advogado, comarca, status, criado_por
        )
      `)
      .eq("enviado", false)
      .limit(50);

    if (lembretesError) throw lembretesError;

    const lista = (lembretes ?? []) as unknown as Array<any>;
    console.log(`[processar-lembretes-audiencia] Lembretes pendentes: ${lista.length}`);

    const results: Array<{
      lembrete_id: string;
      audiencia_id: string;
      status: "enviado" | "nao_devido" | "ignorado" | "sem_telefone" | "erro";
      erro?: string;
    }> = [];

    for (const lembreteRaw of lista) {
      const lembrete: any = lembreteRaw;
      const audienciaRaw = lembrete?.audiencia;
      const audiencia = Array.isArray(audienciaRaw) ? audienciaRaw[0] : audienciaRaw;
      const lembreteId: string = lembrete?.id;

      if (!lembreteId || !audiencia) {
        results.push({ lembrete_id: lembreteId || "(sem-id)", audiencia_id: lembrete?.audiencia_id, status: "erro", erro: "Dados inválidos" });
        continue;
      }

      try {
        // Verificar se audiência ainda está pendente
        if (audiencia.status !== "pendente" && audiencia.status !== "confirmado") {
          await supabase
            .from("lembretes_audiencia")
            .update({ enviado: true, enviado_em: now.toISOString() })
            .eq("id", lembreteId);
          
          results.push({ lembrete_id: lembreteId, audiencia_id: audiencia.id, status: "ignorado" });
          continue;
        }

        // Calcular horário de disparo
        const dataAudiencia = new Date(audiencia.data_audiencia);
        const dueAt = new Date(dataAudiencia.getTime() - lembrete.minutos_antes * 60_000);

        // Se ainda não chegou no horário de disparo
        if (now.getTime() < dueAt.getTime()) {
          results.push({ lembrete_id: lembreteId, audiencia_id: audiencia.id, status: "nao_devido" });
          continue;
        }

        // Evitar envio para audiências muito no passado (mais de 1 hora depois)
        if (now.getTime() > dataAudiencia.getTime() + 60 * 60_000) {
          await supabase
            .from("lembretes_audiencia")
            .update({ enviado: true, enviado_em: now.toISOString() })
            .eq("id", lembreteId);
          
          results.push({ lembrete_id: lembreteId, audiencia_id: audiencia.id, status: "ignorado" });
          continue;
        }

        // Buscar telefone do criador da audiência
        const telefones: string[] = [];
        if (audiencia.criado_por) {
          const { data: perfil } = await supabase
            .from("profiles")
            .select("telefone")
            .eq("id", audiencia.criado_por)
            .single();

          if (perfil?.telefone) {
            telefones.push(perfil.telefone);
          }
        }

        if (telefones.length === 0) {
          results.push({ lembrete_id: lembreteId, audiencia_id: audiencia.id, status: "sem_telefone" });
          continue;
        }

        // Montar mensagem
        const { data: dataFormatada, hora: horaFormatada } = formatarDataHoraBR(audiencia.data_audiencia);
        const horaExibicao = audiencia.hora_brasilia || audiencia.hora || horaFormatada;
        
        let tempoRestante = "";
        if (lembrete.minutos_antes >= 1440) {
          const dias = Math.floor(lembrete.minutos_antes / 1440);
          tempoRestante = `${dias} dia${dias > 1 ? 's' : ''}`;
        } else if (lembrete.minutos_antes >= 60) {
          const horas = Math.floor(lembrete.minutos_antes / 60);
          tempoRestante = `${horas} hora${horas > 1 ? 's' : ''}`;
        } else {
          tempoRestante = `${lembrete.minutos_antes} minutos`;
        }

        const mensagem = `⏰ *LEMBRETE DE AUDIÊNCIA*\n\n` +
          `Faltam *${tempoRestante}* para a audiência:\n\n` +
          `📄 Processo: ${audiencia.processo_numero || 'Não informado'}\n` +
          `📅 Data: ${dataFormatada}\n` +
          `🕐 Horário: ${horaExibicao}\n` +
          (audiencia.tipo_audiencia ? `📌 Tipo: ${audiencia.tipo_audiencia}\n` : '') +
          (audiencia.cliente ? `🏢 Cliente: ${audiencia.cliente}\n` : '') +
          (audiencia.comarca ? `📍 Comarca: ${audiencia.comarca}\n` : '') +
          `\n_JurisControl - Sistema de Gestão Jurídica_`;

        // Enviar via Z-API
        const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        let enviados = 0;

        for (const tel of telefones) {
          const telFmt = formatarTelefone(tel);
          if (!telFmt) continue;

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
            console.log(`[processar-lembretes-audiencia] Falha Z-API tel=${telFmt}`, respJson);
          }
        }

        // Marcar como enviado
        await supabase
          .from("lembretes_audiencia")
          .update({ enviado: true, enviado_em: now.toISOString() })
          .eq("id", lembreteId);

        results.push({ 
          lembrete_id: lembreteId, 
          audiencia_id: audiencia.id, 
          status: enviados > 0 ? "enviado" : "erro",
          erro: enviados === 0 ? "Falha no envio" : undefined
        });

      } catch (err: any) {
        console.error(`[processar-lembretes-audiencia] Erro lembrete_id=${lembreteId}`, err);
        results.push({
          lembrete_id: lembreteId,
          audiencia_id: lembrete.audiencia_id,
          status: "erro",
          erro: err?.message ?? "Erro desconhecido",
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`[processar-lembretes-audiencia] Fim | elapsed=${elapsedMs}ms`);

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
    console.error("[processar-lembretes-audiencia] Erro geral:", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
