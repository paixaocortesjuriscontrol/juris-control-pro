import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, conversaId, tipo } = await req.json();

    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar documentos do repositório para contexto
    const { data: documentos, error: docsError } = await supabaseAdmin
      .from('repositorio_documentos')
      .select('id, nome, categoria, descricao, tipo_documento, tags')
      .order('created_at', { ascending: false })
      .limit(50);

    if (docsError) {
      console.error('Erro ao buscar documentos:', docsError);
    }

    // Construir contexto dos documentos
    let documentosContexto = '';
    if (documentos && documentos.length > 0) {
      documentosContexto = '\n\nDocumentos disponíveis no repositório:\n';
      documentos.forEach((doc, index) => {
        documentosContexto += `${index + 1}. ${doc.nome} (${doc.categoria})`;
        if (doc.descricao) documentosContexto += ` - ${doc.descricao}`;
        if (doc.tipo_documento) documentosContexto += ` [${doc.tipo_documento}]`;
        if (doc.tags && doc.tags.length > 0) documentosContexto += ` Tags: ${doc.tags.join(', ')}`;
        documentosContexto += '\n';
      });
    }

    const systemPrompt = `Você é um assistente jurídico especializado do escritório. Você tem acesso ao repositório de documentos do escritório e pode ajudar os advogados com:

1. PESQUISAS: Buscar informações em documentos, jurisprudências, modelos e peças processuais
2. GERAÇÃO DE DOCUMENTOS: Criar novos documentos baseados em modelos existentes no repositório
3. ANÁLISE: Analisar documentos e fornecer insights jurídicos
4. ORIENTAÇÃO: Responder dúvidas sobre procedimentos e práticas jurídicas

${tipo === 'pesquisa' ? 'O usuário está fazendo uma PESQUISA no repositório.' : ''}
${tipo === 'geracao' ? 'O usuário está solicitando a GERAÇÃO de um novo documento.' : ''}

${documentosContexto}

Responda de forma profissional, precisa e útil. Quando referenciar documentos do repositório, mencione-os pelo nome.
Se for solicitada a geração de um documento, forneça um modelo completo e bem estruturado.
Use formatação markdown quando apropriado.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro OpenAI:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Erro ao comunicar com IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Salvar mensagens se tiver conversaId
    if (conversaId) {
      // Salvar mensagem do usuário
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        await supabaseAdmin
          .from('repositorio_mensagens')
          .insert({
            conversa_id: conversaId,
            role: 'user',
            content: lastUserMessage.content
          });
      }

      // Salvar resposta do assistente
      await supabaseAdmin
        .from('repositorio_mensagens')
        .insert({
          conversa_id: conversaId,
          role: 'assistant',
          content: assistantMessage
        });

      // Atualizar título da conversa se for a primeira mensagem
      const { data: conversa } = await supabaseAdmin
        .from('repositorio_conversas')
        .select('titulo')
        .eq('id', conversaId)
        .single();

      if (conversa && !conversa.titulo) {
        // Gerar título baseado na primeira mensagem
        const titulo = messages[0]?.content?.substring(0, 50) + (messages[0]?.content?.length > 50 ? '...' : '');
        await supabaseAdmin
          .from('repositorio_conversas')
          .update({ titulo })
          .eq('id', conversaId);
      }
    }

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      conversaId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Erro na função repositorio-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
