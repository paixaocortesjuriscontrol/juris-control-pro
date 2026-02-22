import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT_INDIVIDUAL = `Você é um advogado sênior que prepara o "Conteúdo Integral" de publicações do DJE para a Dra. Renata. Ela não lê o texto na íntegra; você deve TRANSCREVER os trechos mais importantes da publicação, como um advogado faria ao destacar o que importa.

REGRAS OBRIGATÓRIAS:
1. Comece pelo TIPO do ato, em maiúsculas, como no original: A C Ó R D Ã O, DESPACHO, INTIMAÇÃO, CERTIDÃO, TERMO DE AUDIÊNCIA, etc.
2. Em seguida, CITE trechos literais da publicação: transcreva as frases ou parágrafos que contêm o núcleo da decisão, a fundamentação relevante e o dispositivo. Não parafraseie — use as palavras do texto quando forem decisivas.
3. Inclua sempre que existir:
   - O trecho que explica o entendimento do órgão (ex.: "Nesse contexto, não se constata omissão...")
   - O dispositivo na íntegra (ex.: "Ante o exposto, NEGO PROVIMENTO aos embargos de declaração.")
   - O fechamento formal se houver (ex.: "ISTO POSTO / ACORDAM os Ministros da Terceira Turma...")
4. Uma linha em branco entre blocos de citação. Texto puro, sem markdown (sem ###, **, listas).
5. Não invente texto. Só transcrever ou resumir com base no conteúdo fornecido. Não repita processo, órgão ou data (já constam nos metadados).
6. Se a publicação for curta (certidão, intimação simples), pode transcrever os trechos principais quase na íntegra. Se for longa, selecione os trechos que um advogado sublinharia para a cliente.`;

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
    const { publicacoes, publicacao, monitoramentoId, resumoIndividual } = body;

    // ── Modo INDIVIDUAL: resumir UMA publicação ──
    if (resumoIndividual) {
      // Aceitar tanto `publicacao` (objeto único) quanto `publicacoes` com 1 item
      const pub = publicacao || (publicacoes && publicacoes[0]);
      if (!pub) {
        return new Response(
          JSON.stringify({ id: null, resumo: 'Nenhuma publicação para resumir.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const conteudo = (pub.conteudo || pub.texto || pub.teor || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!conteudo || conteudo.length < 20) {
        return new Response(
          JSON.stringify({ id: pub.id, resumo: 'Publicação sem conteúdo suficiente para resumir.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const truncated = conteudo.substring(0, 4000);
      const userMsg = `Analise e resuma esta publicação jurídica:\n\nProcesso: ${pub.processo || pub.numeroProcesso || 'N/A'}\nData: ${pub.data || pub.dataDisponibilizacao || 'N/A'}\n\nConteúdo da publicação:\n${truncated}`;

      let resumo = 'Não foi possível gerar resumo.';
      try {
        let aiResponse: any;

        const summaryModel = Deno.env.get('OPENAI_SUMMARY_MODEL') || 'gpt-4o';
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
                { role: 'system', content: SYSTEM_PROMPT_INDIVIDUAL },
                { role: 'user', content: userMsg },
              ],
              max_tokens: 1200,
              temperature: 0.2,
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
              model: summaryModel,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT_INDIVIDUAL },
                { role: 'user', content: userMsg },
              ],
              max_tokens: 1200,
              temperature: 0.2,
            }),
          });
          if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
          aiResponse = await resp.json();
        }

        resumo = aiResponse.choices?.[0]?.message?.content?.trim() || resumo;
      } catch (e) {
        console.error(`Erro ao resumir pub ${pub.id}:`, e);
        resumo = 'Erro ao gerar resumo desta publicação.';
      }

      return new Response(
        JSON.stringify({ id: pub.id, resumo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Modo CONSOLIDADO (original) ──
    if (!publicacoes || publicacoes.length === 0) {
      return new Response(
        JSON.stringify({ resumo: 'Nenhuma publicação para resumir.', resumos: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      return `Publicação ${index + 1}:\n- Data: ${pub.data || pub.dataDisponibilizacao || 'N/A'}\n- Processo: ${pub.numeroProcesso || pub.processo || 'N/A'}\n- Conteúdo: ${conteudo}\n`;
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
