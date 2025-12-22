import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const { publicacoes, monitoramentoId } = await req.json();

    if (!publicacoes || publicacoes.length === 0) {
      return new Response(
        JSON.stringify({ resumo: 'Nenhuma publicação para resumir.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!monitoramentoId) {
      throw new Error('ID do monitoramento é obrigatório');
    }

    // Prepare content for summarization
    const publicacoesText = publicacoes.map((pub: any, index: number) => {
      return `Publicação ${index + 1}:
- Data: ${pub.data || pub.dataDisponibilizacao || 'N/A'}
- Processo: ${pub.numeroProcesso || pub.processo || 'N/A'}
- Conteúdo: ${pub.texto || pub.conteudo || pub.teor || 'N/A'}
`;
    }).join('\n---\n');

    console.log('Resumindo', publicacoes.length, 'publicações para monitoramento:', monitoramentoId);

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
- Prazo encontrado (ex: 15 dias, 5 dias úteis, etc.)
- Tipo de prazo (recurso, contestação, manifestação, etc.)
- Data de vencimento se mencionada

## 📊 RESUMO GERAL
1. Total de publicações analisadas
2. Tipos de movimentações encontradas (intimações, citações, sentenças, despachos, etc.)
3. Processos que requerem ação URGENTE (destacar em negrito)

## ⚠️ ALERTAS
- Liste qualquer situação que demande atenção imediata

Seja preciso ao extrair números de processos e prazos. Use formatação markdown para facilitar a leitura.`
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

    console.log('Resumo gerado com sucesso');

    // Salvar resumo na nova tabela
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const publicacaoIds = publicacoes.map((p: any) => p.id).filter(Boolean);

    const { error: insertError } = await supabaseClient
      .from('resumos_monitoramento_djen')
      .insert({
        monitoramento_id: monitoramentoId,
        resumo: resumo,
        data_busca: new Date().toISOString(),
        publicacoes_incluidas: publicacaoIds,
      });

    if (insertError) {
      console.error('Erro ao salvar resumo:', insertError);
      throw new Error('Erro ao salvar resumo no banco');
    }

    console.log('Resumo salvo na tabela resumos_monitoramento_djen');

    return new Response(
      JSON.stringify({ resumo, totalPublicacoes: publicacoes.length }),
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
