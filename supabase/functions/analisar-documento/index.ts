import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIAS = [
  { value: "modelo", label: "Modelo de Documento" },
  { value: "peca_processual", label: "Peça Processual" },
  { value: "jurisprudencia", label: "Jurisprudência" },
  { value: "legislacao", label: "Legislação" },
  { value: "parecer", label: "Parecer" },
  { value: "contrato", label: "Contrato" },
  { value: "procuracao", label: "Procuração" },
  { value: "outros", label: "Outros" },
];

const TIPOS = [
  { value: "peticao_inicial", label: "Petição Inicial" },
  { value: "contestacao", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "agravo", label: "Agravo" },
  { value: "embargos", label: "Embargos" },
  { value: "manifestacao", label: "Manifestação" },
  { value: "acordo", label: "Acordo" },
  { value: "contrato_prestacao", label: "Contrato de Prestação de Serviços" },
  { value: "contrato_trabalho", label: "Contrato de Trabalho" },
  { value: "contrato_locacao", label: "Contrato de Locação" },
  { value: "contrato_compra_venda", label: "Contrato de Compra e Venda" },
  { value: "contrato_honorarios", label: "Contrato de Honorários" },
  { value: "procuracao_ad_judicia", label: "Procuração Ad Judicia" },
  { value: "substabelecimento", label: "Substabelecimento" },
  { value: "notificacao_extrajudicial", label: "Notificação Extrajudicial" },
  { value: "declaracao", label: "Declaração" },
  { value: "requerimento", label: "Requerimento" },
  { value: "certidao", label: "Certidão" },
  { value: "formulario", label: "Formulário" },
  { value: "relatorio", label: "Relatório" },
  { value: "outro", label: "Outro" },
];

// Regex para identificar números de processo no padrão CNJ
const PROCESSO_REGEX = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d[-.]?\d{2}[-.]?\d{4}/g;

// Função para normalizar número de processo (remover pontos e traços)
function normalizeProcessoNumber(numero: string): string {
  return numero.replace(/[^\d]/g, '');
}

// Função para buscar processo no banco de dados
async function findProcessoByNumero(supabase: any, numeroProcesso: string): Promise<{ id: string; numero: string } | null> {
  const normalizedInput = normalizeProcessoNumber(numeroProcesso);
  
  // Buscar processo pelo número (normalizado)
  const { data, error } = await supabase
    .from('processos')
    .select('id, numero')
    .limit(100);
  
  if (error || !data) {
    console.error('Erro ao buscar processos:', error);
    return null;
  }
  
  // Comparar normalizando ambos os lados
  for (const processo of data) {
    if (normalizeProcessoNumber(processo.numero) === normalizedInput) {
      return processo;
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileContent, mimeType } = await req.json();
    
    if (!fileName || !fileContent) {
      return new Response(
        JSON.stringify({ error: "fileName e fileContent são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Limitar conteúdo a ~8000 caracteres para não exceder limites
    const truncatedContent = fileContent.substring(0, 8000);
    
    const systemPrompt = `Você é um assistente jurídico especializado em classificar documentos legais brasileiros.
Analise o conteúdo E O NOME DO ARQUIVO do documento para identificar corretamente:

1. A categoria mais adequada (obrigatório)
2. O tipo específico de documento (MUITO IMPORTANTE - seja preciso!)
3. Uma breve descrição do documento (máximo 100 caracteres)
4. Tags relevantes (máximo 5)
5. Número(s) de processo mencionado(s) no documento (formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO)

DICAS PARA CLASSIFICAÇÃO:
- Se o nome ou conteúdo mencionar "locação", "aluguel", "inquilino", "locador", "APTO", "apartamento", "imóvel" → tipo é "contrato_locacao"
- Se mencionar "prestação de serviços", "contratada", "contratante" para serviços → tipo é "contrato_prestacao"
- Se mencionar "honorários advocatícios", "advogado" → tipo é "contrato_honorarios"
- Se mencionar "compra e venda", "vendedor", "comprador" → tipo é "contrato_compra_venda"
- Se for um formulário/modelo para preenchimento → tipo é "formulario"
- Se for uma declaração formal → tipo é "declaracao"
- Se for notificação para terceiros → tipo é "notificacao_extrajudicial"

IMPORTANTE: Procure atentamente por números de processo judicial no formato CNJ (ex: 0001234-56.2024.5.01.0001).

Categorias disponíveis: ${CATEGORIAS.map(c => `${c.value} (${c.label})`).join(", ")}

Tipos disponíveis: ${TIPOS.map(t => `${t.value} (${t.label})`).join(", ")}

Se o tipo do documento NÃO se encaixar em nenhum dos tipos acima, você pode sugerir um novo tipo no formato snake_case.
Neste caso, adicione um campo "novo_tipo" com o valor sugerido e "novo_tipo_label" com o rótulo legível.

Responda APENAS em JSON válido no formato:
{
  "categoria": "valor_da_categoria",
  "tipo_documento": "valor_do_tipo ou null",
  "novo_tipo": "novo_tipo_snake_case (opcional, apenas se criar novo)",
  "novo_tipo_label": "Rótulo do Novo Tipo (opcional)",
  "descricao": "breve descrição do documento",
  "tags": ["tag1", "tag2"],
  "confianca": "alta|media|baixa",
  "numeros_processo": ["1234567-89.2024.5.01.0001"] // array de números encontrados, ou vazio se nenhum
}`;

    const userPrompt = `Nome do arquivo: ${fileName}
Tipo MIME: ${mimeType || "desconhecido"}

Conteúdo do documento:
${truncatedContent}

${fileContent.length > 8000 ? "\n[Conteúdo truncado - documento muito grande]" : ""}`;

    console.log(`Analisando documento: ${fileName}`);

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("Resposta vazia da OpenAI");
    }

    // Tentar extrair JSON da resposta
    let analysis;
    try {
      // Remove possíveis markdown code blocks
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Erro ao parsear resposta:', content);
      // Fallback com valores padrão
      analysis = {
        categoria: "outros",
        tipo_documento: null,
        descricao: `Documento: ${fileName}`,
        tags: [],
        confianca: "baixa",
        numeros_processo: []
      };
    }

    // Validar categoria
    if (!CATEGORIAS.find(c => c.value === analysis.categoria)) {
      analysis.categoria = "outros";
    }

    // Validar tipo - se não existir e tiver novo_tipo, usar o novo tipo
    if (analysis.tipo_documento && !TIPOS.find(t => t.value === analysis.tipo_documento)) {
      // Verificar se é um novo tipo sugerido pela IA
      if (analysis.novo_tipo) {
        analysis.tipo_documento = analysis.novo_tipo;
      }
    }

    // Se tiver novo_tipo mas não tiver tipo_documento, usar o novo tipo
    if (analysis.novo_tipo && !analysis.tipo_documento) {
      analysis.tipo_documento = analysis.novo_tipo;
    }

    // Também tentar extrair números de processo via regex como fallback
    const regexMatches = truncatedContent.match(PROCESSO_REGEX) || [];
    const allNumeros = [...new Set([
      ...(analysis.numeros_processo || []),
      ...regexMatches
    ])];
    
    analysis.numeros_processo = allNumeros;

    // Buscar se algum dos processos existe no banco de dados
    let processoEncontrado = null;
    let numeroProcessoExtraido = null;

    if (allNumeros.length > 0) {
      numeroProcessoExtraido = allNumeros[0]; // Primeiro número encontrado
      
      for (const numero of allNumeros) {
        const processo = await findProcessoByNumero(supabase, numero);
        if (processo) {
          processoEncontrado = processo;
          numeroProcessoExtraido = numero;
          console.log(`Processo encontrado: ${processo.numero} (ID: ${processo.id})`);
          break;
        }
      }
    }

    // Adicionar informações do processo ao resultado
    analysis.numero_processo_extraido = numeroProcessoExtraido;
    analysis.processo_id = processoEncontrado?.id || null;
    analysis.processo_numero = processoEncontrado?.numero || null;

    console.log(`Análise concluída: ${JSON.stringify(analysis)}`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na análise:', error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        // Retornar valores padrão em caso de erro
        categoria: "outros",
        tipo_documento: null,
        descricao: "",
        tags: [],
        confianca: "baixa",
        numeros_processo: [],
        numero_processo_extraido: null,
        processo_id: null,
        processo_numero: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
