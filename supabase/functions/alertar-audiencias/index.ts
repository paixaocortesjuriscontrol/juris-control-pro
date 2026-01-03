import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Buscar audiências pendentes nos próximos 3 dias
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);

    console.log(`Verificando audiências entre ${hoje.toISOString()} e ${em3Dias.toISOString()}`);

    const { data: audiencias, error: audienciasError } = await supabase
      .from("audiencias_detectadas")
      .select("id, data_audiencia, processo_numero, cliente, advogado, hora_brasilia, comarca, alerta_enviado, criado_por")
      .eq("status", "pendente")
      .gte("data_audiencia", hoje.toISOString().split("T")[0])
      .lte("data_audiencia", em3Dias.toISOString().split("T")[0]);

    if (audienciasError) {
      console.error("Erro ao buscar audiências:", audienciasError);
      throw audienciasError;
    }

    console.log(`Encontradas ${audiencias?.length || 0} audiências próximas`);

    let alertasCriados = 0;
    let notificacoesCriadas = 0;

    for (const audiencia of audiencias || []) {
      if (audiencia.alerta_enviado) {
        console.log(`Audiência ${audiencia.id} já teve alerta enviado, pulando...`);
        continue;
      }

      const dataAudiencia = new Date(audiencia.data_audiencia);
      dataAudiencia.setHours(0, 0, 0, 0);
      
      const diffTime = dataAudiencia.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let tipo = "proximidade";
      if (diasRestantes === 0) tipo = "hoje";
      else if (diasRestantes === 1) tipo = "amanha";

      // Criar alerta de audiência
      const { error: alertaError } = await supabase
        .from("alertas_audiencias")
        .insert({
          audiencia_id: audiencia.id,
          tipo,
          dias_restantes: diasRestantes,
        });

      if (alertaError) {
        console.error(`Erro ao criar alerta para audiência ${audiencia.id}:`, alertaError);
        continue;
      }

      alertasCriados++;

      // Buscar advogados associados a esta audiência
      const { data: advogadosAudiencia } = await supabase
        .from("audiencias_advogados")
        .select("advogado_id")
        .eq("audiencia_id", audiencia.id);

      const usuariosParaNotificar: string[] = [];

      // Adicionar advogados associados
      if (advogadosAudiencia && advogadosAudiencia.length > 0) {
        advogadosAudiencia.forEach((aa: { advogado_id: string }) => {
          if (!usuariosParaNotificar.includes(aa.advogado_id)) {
            usuariosParaNotificar.push(aa.advogado_id);
          }
        });
      }

      // Adicionar criador
      if (audiencia.criado_por && !usuariosParaNotificar.includes(audiencia.criado_por)) {
        usuariosParaNotificar.push(audiencia.criado_por);
      }

      // Buscar processo e notificar responsável e coordenação
      if (audiencia.processo_numero) {
        const { data: processo } = await supabase
          .from("processos")
          .select("advogado_responsavel_id, coordenacao_id")
          .eq("numero", audiencia.processo_numero)
          .maybeSingle();

        if (processo) {
          if (processo.advogado_responsavel_id && !usuariosParaNotificar.includes(processo.advogado_responsavel_id)) {
            usuariosParaNotificar.push(processo.advogado_responsavel_id);
          }

          if (processo.coordenacao_id) {
            const { data: membros } = await supabase
              .from("membros_coordenacao")
              .select("usuario_id")
              .eq("coordenacao_id", processo.coordenacao_id);

            membros?.forEach((m: { usuario_id: string }) => {
              if (!usuariosParaNotificar.includes(m.usuario_id)) {
                usuariosParaNotificar.push(m.usuario_id);
              }
            });
          }
        }
      }

      // Criar notificações
      for (const usuarioId of usuariosParaNotificar) {
        let titulo = "";
        let mensagem = "";
        const dataFormatada = new Date(audiencia.data_audiencia).toLocaleDateString("pt-BR");
        const hora = audiencia.hora_brasilia || "";

        if (tipo === "hoje") {
          titulo = "⚠️ Audiência HOJE!";
          mensagem = `Audiência ${audiencia.processo_numero || "sem número"} às ${hora} - ${audiencia.cliente || audiencia.comarca || ""}`;
        } else if (tipo === "amanha") {
          titulo = "📅 Audiência AMANHÃ";
          mensagem = `Audiência ${audiencia.processo_numero || "sem número"} em ${dataFormatada} às ${hora}`;
        } else {
          titulo = `📅 Audiência em ${diasRestantes} dias`;
          mensagem = `${audiencia.processo_numero || "Processo"} - ${dataFormatada} às ${hora}`;
        }

        const { error: notifError } = await supabase
          .from("notificacoes")
          .insert({
            usuario_id: usuarioId,
            titulo,
            mensagem,
            tipo: diasRestantes === 0 ? "warning" : "info",
            link: "/painel-audiencias",
            dados: {
              audiencia_id: audiencia.id,
              dias_restantes: diasRestantes,
            },
          });

        if (!notifError) {
          notificacoesCriadas++;
        } else {
          console.error(`Erro ao criar notificação:`, notifError);
        }
      }

      // Marcar audiência como alerta enviado
      await supabase
        .from("audiencias_detectadas")
        .update({ alerta_enviado: true })
        .eq("id", audiencia.id);
    }

    console.log(`Processo concluído: ${alertasCriados} alertas criados, ${notificacoesCriadas} notificações enviadas`);

    return new Response(
      JSON.stringify({
        success: true,
        audienciasVerificadas: audiencias?.length || 0,
        alertasCriados,
        notificacoesCriadas,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro na função alertar-audiencias:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
