import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!LOVABLE_API_KEY && !openAIApiKey) {
      throw new Error('Nenhuma chave de IA configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)');
    }

    const body = await req.json();
    const { publicacoes, monitoramentoId, resumoIndividual } = body;

    if (!publicacoes || publicacoes.length === 0) {
      return new Response(
        JSON.stringify({ resumo: 'Nenhuma publicação para resumir.', resumos: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Modo INDIVIDUAL: resumir cada publicação separadamente ──
    if (resumoIndividual) {
      const MAX_PUB = 30;
      const pubsLimitadas = publicacoes.slice(0, MAX_PUB);

      const systemPrompt = `Você é um assistente jurídico especializado. Resuma a publicação do Diário de Justiça de forma clara e objetiva em NO MÁXIMO 5 linhas.
Foque em:
1. O que foi decidido/comunicado
2. Prazos mencionados (se houver)
3. Ação necessária pelo advogado
Seja direto e conciso. Não repita o número do processo nem dados de cabeçalho.`;

      const resumos: { id: string; resumo: string }[] = [];

      // Processar em lotes de 5 para não sobrecarregar
      for (let i = 0; i < pubsLimitadas.length; i += 5) {
        const batch = pubsLimitadas.slice(i, i + 5);
        const promises = batch.map(async (pub: any) => {
          const conteudo = (pub.conteudo || pub.texto || pub.teor || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (!conteudo || conteudo.length < 20) {
            return { id: pub.id, resumo: 'Publicação sem conteúdo suficiente para resumir.' };
          }

          const truncated = conteudo.substring(0, 3000);
          const userMsg = `Resuma esta publicação jurídica:\n\nProcesso: ${pub.processo || pub.numeroProcesso || 'N/A'}\nData: ${pub.data || pub.dataDisponibilizacao || 'N/A'}\n\nConteúdo:\n${truncated}`;

          try {
            let aiResponse: any;

            if (LOVABLE_API_KEY) {
              const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-3-flash-preview',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMsg },
                  ],
                  max_tokens: 500,
                  temperature: 0.3,
                }),
              });
              if (!resp.ok) throw new Error(`AI error: ${resp.status}`);
              aiResponse = await resp.json();
            } else {
              const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMsg },
                  ],
                  max_tokens: 500,
                  temperature: 0.3,
                }),
              });
              if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
              aiResponse = await resp.json();
            }

            const resumo = aiResponse.choices?.[0]?.message?.content?.trim() || 'Não foi possível gerar resumo.';
            return { id: pub.id, resumo };
          } catch (e) {
            console.error(`Erro ao resumir pub ${pub.id}:`, e);
            return { id: pub.id, resumo: 'Erro ao gerar resumo desta publicação.' };
          }
        });

        const results = await Promise.all(promises);
        resumos.push(...results);
      }

      console.log(`Resumos individuais gerados: ${resumos.length} de ${publicacoes.length}`);

      return new Response(
        JSON.stringify({ resumos, totalProcessado: resumos.length, totalOriginal: publicacoes.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Modo CONSOLIDADO (original) ──
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não configurada para resumo consolidado');
    }

    const MAX_PUBLICACOES = 50;
    const MAX_CONTEUDO_LENGTH = 2000;
    
    const publicacoesLimitadas = publicacoes.slice(0, MAX_PUBLICACOES);
    const totalOriginal = publicacoes.length;
    
    const publicacoesText = publicacoesLimitadas.map((pub: any, index: number) => {
      let conteudo = pub.texto || pub.conteudo || pub.teor || 'N/A';
      if (conteudo.length > MAX_CONTEUDO_LENGTH) {
        conteudo = conteudo.substring(0, MAX_CONTEUDO_LENGTH) + '... [truncado]';
      }
      return `Publicação ${index + 1}:
- Data: ${pub.data || pub.dataDisponibilizacao || 'N/A'}
- Processo: ${pub.numeroProcesso || pub.processo || 'N/A'}
- Conteúdo: ${conteudo}
`;
    }).join('\n---\n');

    const avisoTruncamento = totalOriginal > MAX_PUBLICACOES 
      ? `\n\n**AVISO:** Foram analisadas ${MAX_PUBLICACOES} de ${totalOriginal} publicações.`
      : '';

    console.log(`Resumindo ${publicacoesLimitadas.length} de ${totalOriginal} publicações para monitoramento:`, monitoramentoId);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente jurídico especializado em análise de publicações do Diário de Justiça Eletrônico (DJE).
            
Sua tarefa é resumir as publicações encontradas de forma clara e objetiva, com a seguinte estrutura OBRIGATÓRIA:

## 📋 NÚMEROS DOS PROCESSOS ENCONTRADOS
- Liste TODOS os números de processos encontrados nas publicações

## ⏰ PRAZOS POR PROCESSO
Para cada processo que mencione prazo, liste:
- Número do processo
- Prazo encontrado
- Tipo de prazo
- Data de vencimento se mencionada

## 📊 RESUMO GERAL
1. Total de publicações analisadas
2. Tipos de movimentações encontradas
3. Processos que requerem ação URGENTE (destacar em negrito)

## ⚠️ ALERTAS
- Liste qualquer situação que demande atenção imediata

Seja preciso ao extrair números de processos e prazos. Use formatação markdown.`
          },
          {
            role: 'user',
            content: `Por favor, analise e resuma as seguintes publicações do DJE:\n\n${publicacoesText}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(errorData.error?.message || 'Erro na API OpenAI');
    }

    const data = await response.json();
    const resumo = data.choices[0].message.content;
    const resumoComAviso = resumo + avisoTruncamento;

    console.log('Resumo gerado com sucesso');

    if (monitoramentoId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      const publicacaoIds = publicacoesLimitadas.map((p: any) => p.id).filter(Boolean);

      const { error: insertError } = await supabaseClient
        .from('resumos_monitoramento_djen')
        .insert({
          monitoramento_id: monitoramentoId,
          resumo: resumoComAviso,
          data_busca: new Date().toISOString(),
          publicacoes_incluidas: publicacaoIds,
        });

      if (insertError) {
        console.error('Erro ao salvar resumo:', insertError);
        throw new Error('Erro ao salvar resumo no banco');
      }
    }

    return new Response(
      JSON.stringify({ resumo: resumoComAviso, totalPublicacoes: publicacoesLimitadas.length, totalOriginal }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao resumir publicações:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
