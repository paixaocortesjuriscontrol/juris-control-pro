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

const PROCESSO_REGEX = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d[-.]?\d{2}[-.]?\d{4}/g;

function normalizeProcessoNumber(numero: string): string {
  return numero.replace(/[^\d]/g, '');
}

async function findProcessoByNumero(supabase: any, numeroProcesso: string): Promise<{ id: string; numero: string } | null> {
  const normalizedInput = normalizeProcessoNumber(numeroProcesso);
  
  const { data, error } = await supabase
    .from('processos')
    .select('id, numero')
    .limit(100);
  
  if (error || !data) {
    console.error('Erro ao buscar processos:', error);
    return null;
  }
  
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
    const { fileName, fileContent, mimeType, processoAtual } = await req.json();
    
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const truncatedContent = fileContent.substring(0, 60000);

    // Build context about current processo fields that are empty
    let camposFaltantes = '';
    if (processoAtual) {
      const campos: Record<string, string> = {
        polo_ativo: 'Reclamante / Polo Ativo',
        polo_passivo: 'Reclamado / Polo Passivo',
        advogado_parte_contraria: 'Advogado da Parte Contrária',
        vara: 'Vara / Câmara',
        comarca: 'Comarca',
        tribunal: 'Tribunal',
        assunto: 'Assunto',
        valor_causa: 'Valor da Causa',
        data_distribuicao: 'Data de Distribuição',
        juiz: 'Juiz',
        classe_judicial: 'Classe Judicial',
      };
      const faltando = Object.entries(campos)
        .filter(([key]) => !processoAtual[key])
        .map(([, label]) => label);
      if (faltando.length > 0) {
        camposFaltantes = `\n\nCAMPOS FALTANTES NO PROCESSO ATUAL (tente extrair do documento):\n${faltando.join(', ')}`;
      }
    }
    
    const systemPrompt = `Você é um assistente jurídico especializado em analisar documentos legais brasileiros.
Analise o conteúdo E O NOME DO ARQUIVO do documento para extrair o MÁXIMO de informações possíveis:

1. Categoria do documento
2. Tipo específico
3. Breve descrição (máximo 100 caracteres)
4. Tags relevantes (máximo 5)
5. Número(s) de processo (formato CNJ)
6. PARTES ENVOLVIDAS: reclamante/polo ativo, reclamado/polo passivo, com nomes completos
7. ADVOGADOS: nomes dos advogados mencionados, com OAB se disponível
8. INFORMAÇÕES PROCESSUAIS: vara, comarca, tribunal, juiz, classe judicial, assunto, valor da causa, data de distribuição
${camposFaltantes}

Categorias: ${CATEGORIAS.map(c => `${c.value} (${c.label})`).join(", ")}
Tipos: ${TIPOS.map(t => `${t.value} (${t.label})`).join(", ")}

Responda APENAS em JSON válido:
{
  "categoria": "valor",
  "tipo_documento": "valor ou null",
  "novo_tipo": "snake_case (opcional)",
  "novo_tipo_label": "Rótulo (opcional)",
  "descricao": "breve descrição",
  "tags": ["tag1", "tag2"],
  "confianca": "alta|media|baixa",
  "numeros_processo": ["1234567-89.2024.5.01.0001"],
  "partes": {
    "polo_ativo": "Nome completo do reclamante/autor",
    "polo_passivo": "Nome completo do reclamado/réu",
    "outros_envolvidos": ["Nome - Papel"]
  },
  "advogados": [
    {"nome": "Dr. Fulano", "oab": "OAB/UF 12345", "parte": "reclamante|reclamado|outro"}
  ],
  "info_processual": {
    "vara": "1ª Vara do Trabalho",
    "comarca": "São Paulo",
    "tribunal": "TRT-2",
    "juiz": "Nome do Juiz",
    "classe_judicial": "Reclamação Trabalhista",
    "assunto": "Verbas Rescisórias",
    "valor_causa": 50000.00,
    "data_distribuicao": "2024-01-15"
  },
  "campos_extraidos": {
    "campo_supabase": "valor extraído"
  }
}

IMPORTANTE: 
- Extraia TODOS os nomes de partes e advogados que conseguir.
- Se não encontrar alguma informação, use null.
- Em "campos_extraidos", mapeie para nomes de colunas do banco: polo_ativo, polo_passivo, advogado_parte_contraria, vara, comarca, tribunal, assunto, valor_causa, data_distribuicao, juiz, classe_judicial.`;

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
        max_tokens: 1200,
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

    let analysis;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Erro ao parsear resposta:', content);
      analysis = {
        categoria: "outros",
        tipo_documento: null,
        descricao: `Documento: ${fileName}`,
        tags: [],
        confianca: "baixa",
        numeros_processo: [],
        partes: { polo_ativo: null, polo_passivo: null, outros_envolvidos: [] },
        advogados: [],
        info_processual: {},
        campos_extraidos: {}
      };
    }

    if (!CATEGORIAS.find(c => c.value === analysis.categoria)) {
      analysis.categoria = "outros";
    }

    if (analysis.tipo_documento && !TIPOS.find(t => t.value === analysis.tipo_documento)) {
      if (analysis.novo_tipo) {
        analysis.tipo_documento = analysis.novo_tipo;
      }
    }

    if (analysis.novo_tipo && !analysis.tipo_documento) {
      analysis.tipo_documento = analysis.novo_tipo;
    }

    const regexMatches = truncatedContent.match(PROCESSO_REGEX) || [];
    const allNumeros = [...new Set([
      ...(analysis.numeros_processo || []),
      ...regexMatches
    ])];
    
    analysis.numeros_processo = allNumeros;

    let processoEncontrado = null;
    let numeroProcessoExtraido = null;

    if (allNumeros.length > 0) {
      numeroProcessoExtraido = allNumeros[0];
      
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

    analysis.numero_processo_extraido = numeroProcessoExtraido;
    analysis.processo_id = processoEncontrado?.id || null;
    analysis.processo_numero = processoEncontrado?.numero || null;

    // Ensure new fields have defaults
    analysis.partes = analysis.partes || { polo_ativo: null, polo_passivo: null, outros_envolvidos: [] };
    analysis.advogados = analysis.advogados || [];
    analysis.info_processual = analysis.info_processual || {};
    analysis.campos_extraidos = analysis.campos_extraidos || {};

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
        categoria: "outros",
        tipo_documento: null,
        descricao: "",
        tags: [],
        confianca: "baixa",
        numeros_processo: [],
        numero_processo_extraido: null,
        processo_id: null,
        processo_numero: null,
        partes: { polo_ativo: null, polo_passivo: null, outros_envolvidos: [] },
        advogados: [],
        info_processual: {},
        campos_extraidos: {}
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});