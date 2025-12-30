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

    // Buscar documentos do repositório para contexto - aumentar limite para listar todos
    const { data: documentos, error: docsError } = await supabaseAdmin
      .from('repositorio_documentos')
      .select('id, nome, nome_original, categoria, descricao, tipo_documento, tags, created_at, tamanho_bytes')
      .order('created_at', { ascending: false })
      .limit(500);

    if (docsError) {
      console.error('Erro ao buscar documentos:', docsError);
    }

    console.log(`Documentos encontrados no repositório: ${documentos?.length || 0}`);

    // Construir contexto dos documentos de forma mais detalhada
    let documentosContexto = '';
    const categoriasMap: Record<string, string> = {
      'modelo': 'Modelo de Documento',
      'peca_processual': 'Peça Processual',
      'jurisprudencia': 'Jurisprudência',
      'legislacao': 'Legislação',
      'parecer': 'Parecer',
      'contrato': 'Contrato',
      'procuracao': 'Procuração',
      'outros': 'Outros',
      'geral': 'Geral'
    };

    const tiposMap: Record<string, string> = {
      'peticao_inicial': 'Petição Inicial',
      'contestacao': 'Contestação',
      'recurso': 'Recurso',
      'agravo': 'Agravo',
      'embargos': 'Embargos',
      'manifestacao': 'Manifestação',
      'acordo': 'Acordo',
      'contrato_prestacao': 'Contrato de Prestação de Serviços',
      'contrato_trabalho': 'Contrato de Trabalho',
      'contrato_locacao': 'Contrato de Locação',
      'contrato_compra_venda': 'Contrato de Compra e Venda',
      'contrato_honorarios': 'Contrato de Honorários',
      'procuracao_ad_judicia': 'Procuração Ad Judicia',
      'substabelecimento': 'Substabelecimento',
      'notificacao_extrajudicial': 'Notificação Extrajudicial',
      'declaracao': 'Declaração',
      'requerimento': 'Requerimento',
      'certidao': 'Certidão',
      'formulario': 'Formulário',
      'relatorio': 'Relatório',
    };

    if (documentos && documentos.length > 0) {
      // Agrupar por categoria para facilitar listagem
      const porCategoria: Record<string, typeof documentos> = {};
      documentos.forEach(doc => {
        const cat = doc.categoria || 'geral';
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(doc);
      });

      documentosContexto = `\n\n=== REPOSITÓRIO DE DOCUMENTOS DO ESCRITÓRIO ===\n`;
      documentosContexto += `📊 Total: ${documentos.length} documento(s) cadastrado(s)\n\n`;
      
      // Resumo por categoria
      documentosContexto += `📁 RESUMO POR CATEGORIA:\n`;
      Object.entries(porCategoria).forEach(([cat, docs]) => {
        const catLabel = categoriasMap[cat] || cat;
        documentosContexto += `  • ${catLabel}: ${docs.length} documento(s)\n`;
      });
      documentosContexto += '\n';

      // Lista completa de documentos
      documentosContexto += `📄 LISTA COMPLETA DE DOCUMENTOS:\n\n`;
      documentos.forEach((doc, index) => {
        const categoriaLabel = categoriasMap[doc.categoria] || doc.categoria;
        const tipoLabel = doc.tipo_documento ? (tiposMap[doc.tipo_documento] || doc.tipo_documento) : null;
        const dataUpload = doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : '';

        documentosContexto += `[${index + 1}] "${doc.nome}" (ID: ${doc.id})\n`;
        documentosContexto += `    📁 Categoria: ${categoriaLabel}`;
        if (tipoLabel) documentosContexto += ` | Tipo: ${tipoLabel}`;
        documentosContexto += `\n`;
        documentosContexto += `    📎 Arquivo: ${doc.nome_original || doc.nome}\n`;
        if (doc.descricao) documentosContexto += `    📝 Descrição: ${doc.descricao}\n`;
        if (doc.tags && doc.tags.length > 0) documentosContexto += `    🏷️ Tags: ${doc.tags.join(', ')}\n`;
        if (dataUpload) documentosContexto += `    📅 Data: ${dataUpload}\n`;
        documentosContexto += '\n';
      });
    } else {
      documentosContexto = '\n\n=== REPOSITÓRIO DE DOCUMENTOS ===\nNenhum documento cadastrado no repositório ainda.\n';
    }

    const systemPrompt = `Você é um assistente jurídico especializado do escritório de advocacia. Você tem acesso COMPLETO ao repositório de documentos do escritório.

SUAS CAPACIDADES:
1. PESQUISAS: Buscar e encontrar documentos, jurisprudências, modelos e peças processuais no repositório
2. LISTAR DOCUMENTOS: Quando solicitado, liste TODOS os documentos disponíveis no repositório de forma organizada
3. GERAÇÃO DE DOCUMENTOS: Criar novos documentos baseados em modelos existentes
4. ANÁLISE: Analisar documentos e fornecer insights jurídicos
5. ORIENTAÇÃO: Responder dúvidas sobre procedimentos e práticas jurídicas

INSTRUÇÕES IMPORTANTES:
- Você DEVE consultar a lista de documentos abaixo para responder sobre o que existe no repositório
- Quando pedirem para "listar documentos" ou "mostrar todos os documentos", apresente TODOS os documentos disponíveis
- Formate a listagem de forma clara usando markdown (tabelas, listas, etc.)
- Ao listar documentos, inclua: nome, categoria, tipo (se houver), e uma breve descrição
- Mencione o ID do documento entre parênteses para que o usuário possa baixá-lo
- Um documento pode ser de categoria "contrato" e ter diferentes tipos (locação, prestação de serviços, trabalho, etc.)
- O nome do arquivo original pode conter pistas sobre o tipo real do documento
- Seja preciso e mencione os documentos pelo nome quando relevante
- Se não houver documentos de um tipo específico, informe claramente

FORMATO PARA LISTAR DOCUMENTOS:
Quando pedirem para listar, use este formato:

### 📁 [Nome da Categoria]
| Documento | Tipo | Descrição |
|-----------|------|-----------|
| Nome do doc (ID: xxx...) | Tipo | Breve descrição |

${tipo === 'pesquisa' ? '>>> O usuário está fazendo uma PESQUISA no repositório.' : ''}
${tipo === 'geracao' ? '>>> O usuário está solicitando a GERAÇÃO de um novo documento.' : ''}

${documentosContexto}

Responda de forma profissional, precisa e útil. Use formatação markdown quando apropriado.`;

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
