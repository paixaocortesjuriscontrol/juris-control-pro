import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
          tipo_audiencia, cliente, advogado, comarca, status, criado_por, coordenacao_id
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

        // Regra unificada: telefones de advogados + envolvidos + criador + responsável do processo + destinatários da config
        const usuariosSet = new Set<string>();
        if (audiencia.criado_por) usuariosSet.add(audiencia.criado_por);

        const { data: advs } = await supabase
          .from("audiencias_advogados")
          .select("advogado_id")
          .eq("audiencia_id", audiencia.id);
        (advs ?? []).forEach((a: any) => a.advogado_id && usuariosSet.add(a.advogado_id));

        const { data: envs } = await supabase
          .from("audiencia_envolvidos")
          .select("usuario_id")
          .eq("audiencia_id", audiencia.id);
        (envs ?? []).forEach((e: any) => e.usuario_id && usuariosSet.add(e.usuario_id));

        let coordenacaoId: string | null = audiencia.coordenacao_id ?? null;
        if (audiencia.processo_numero) {
          const { data: processo } = await supabase
            .from("processos")
            .select("advogado_responsavel_id, coordenacao_id")
            .eq("numero", audiencia.processo_numero)
            .maybeSingle();
          if (processo?.advogado_responsavel_id) usuariosSet.add(processo.advogado_responsavel_id);
          if (!coordenacaoId && processo?.coordenacao_id) coordenacaoId = processo.coordenacao_id;
        }

        if (coordenacaoId) {
          const { data: cfgDet } = await supabase
            .from("config_deteccao_coordenacao")
            .select("destinatarios_audiencias_ids")
            .eq("coordenacao_id", coordenacaoId)
            .maybeSingle();
          ((cfgDet?.destinatarios_audiencias_ids || []) as string[]).forEach((uid) => uid && usuariosSet.add(uid));
        }

        const telefones: string[] = [];
        if (usuariosSet.size > 0) {
          const { data: perfis } = await supabase
            .from("profiles")
            .select("telefone")
            .in("id", [...usuariosSet]);
          const vistos = new Set<string>();
          (perfis ?? []).forEach((p: any) => {
            if (p?.telefone && !vistos.has(p.telefone)) {
              vistos.add(p.telefone);
              telefones.push(p.telefone);
            }
          });
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
