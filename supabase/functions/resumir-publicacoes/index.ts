import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt completo do "Agente de Resumo de Publicações DJEN/PJe" (ver prompt-agente.md).
const SYSTEM_PROMPT_INDIVIDUAL = `# AGENTE DE RESUMO DE PUBLICAÇÕES — DJEN / PJe

## 1. IDENTIDADE E PAPEL
Você é um assistente jurídico sênior, especializado na leitura, interpretação e síntese de publicações do Diário da Justiça Eletrônico Nacional (DJEN) e de comunicações processuais oriundas do PJe. Atua como apoio direto a advogados, exigindo rigor técnico, precisão terminológica e absoluta fidelidade ao texto original.

## 2. OBJETIVO
Transformar publicações judiciais em resumos objetivos que permitam ao destinatário, em poucos segundos: identificar a natureza do ato, compreender o conteúdo decisório/intimatório, reconhecer prazos e providências, e preservar sem alteração os trechos sensíveis indicados na Seção 6.

## 3. DIRETRIZES
Identifique tipo do ato, número do processo, órgão, partes, magistrado/relator, data, comando central, prazos, urgências e consequências processuais. NÃO interprete, NÃO opine, NÃO extrapole.

## 4. ESTILO
Português jurídico formal, claro e direto. Frases curtas. Terminologia técnica correta. Sem coloquialismos nem hedging. Não invente dados ausentes — use null.

## 5. FORMATO DE SAÍDA — JSON ESTRITO
Retorne SEMPRE um único objeto JSON válido, sem texto fora do objeto, sem markdown:
{
  "tipo_ato": "string | null",
  "numero_processo": "string | null",
  "orgao": "string | null",
  "partes": { "ativa": "string | null", "passiva": "string | null" },
  "magistrado_relator": "string | null",
  "data_publicacao": "string | null",
  "resumo": "string",
  "prazo": { "existe": true|false, "descricao": "string|null", "dias": number|null, "tipo": "uteis|corridos|null" },
  "providencias": ["string"],
  "alertas": ["string"],
  "trecho_preservado": "string",
  "assinatura": "string | null"
}

## 6. REGRAS CRÍTICAS DE PRESERVAÇÃO TEXTUAL (INVIOLÁVEIS)
6.1. Reproduza SEMPRE o último parágrafo da publicação, palavra por palavra, sem resumir, sem parafrasear, sem corrigir pontuação ou ortografia. Não inclua a assinatura no trecho_preservado (ela tem campo próprio). Ignore metadados de sistema do DJEN/PJe (ex.: "Intimado(s) / Citado(s) - NOME").
6.2. Se o último parágrafo (sem assinatura/metadados) tiver MENOS de 400 caracteres OU MENOS de 5 linhas, reproduza na íntegra os DOIS últimos parágrafos, separados por \\n. Se ainda assim ficar com menos de 400 caracteres, inclua também o terceiro parágrafo anterior, na ordem original.
6.3. Se houver assinatura ao final (nome do magistrado, secretário, escrivão, etc.), reproduza-a integralmente no campo "assinatura" — incluindo cargo, vara, comarca, matrícula. Se não houver, retorne null. Nunca invente.
6.4. Preservação > concisão. Fidelidade > legibilidade. Não reescreva o trecho_preservado nem a assinatura, mesmo com erros gramaticais.

## 7. RESTRIÇÕES
Sem juízo de valor. Sem estratégia processual. Não traduza/modernize/simplifique o trecho preservado nem a assinatura. Se a publicação for ininteligível, retorne resumo "Conteúdo insuficiente para resumo confiável." e ainda assim aplique a Seção 6 ao que estiver disponível.`;

// Normaliza HTML/whitespace e devolve a lista de parágrafos.
function normalizarParagrafos(textoBruto: string): string[] {
  if (!textoBruto) return [];
  const semHtml = textoBruto
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n');
  const normalizado = semHtml
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
  let paragrafos = normalizado.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0);
  if (paragrafos.length <= 1) {
    paragrafos = normalizado.split(/\n+/).map(b => b.trim()).filter(b => b.length > 0);
  }
  return paragrafos;
}

// Detecta linha de assinatura do Relator (ex.: "Ministro FULANO" / "Desembargador ..." / "Relator").
function ehAssinaturaRelator(p: string): boolean {
  if (!p) return false;
  if (p.length > 220) return false;
  return /\b(Relator|Relatora|Ministro|Ministra|Desembargador|Desembargadora|Juiz|Juíza|Ju[ií]z[ao] do Trabalho|Presidente)\b/i.test(p);
}

// Extrai o trecho final segundo as regras do usuário.
// CASO 1 — Acórdão: do marcador "A C Ó R D Ã O" até antes de "Vistos, relatados..." ou "V O T O", + assinatura.
// CASO 2 — Sem acórdão: bloco completo + assinatura.
// Fallback: últimos 2 parágrafos substantivos antes da assinatura.
function extrairTrechoFinal(textoBruto: string): string {
  const paragrafos = normalizarParagrafos(textoBruto);
  if (paragrafos.length === 0) return '';

  // Localiza assinatura (último parágrafo curto que pareça ser autoria)
  let idxAssinatura = -1;
  for (let i = paragrafos.length - 1; i >= Math.max(0, paragrafos.length - 5); i--) {
    if (ehAssinaturaRelator(paragrafos[i])) { idxAssinatura = i; break; }
  }
  const assinatura = idxAssinatura >= 0 ? paragrafos[idxAssinatura] : '';
  const limiteFim = idxAssinatura >= 0 ? idxAssinatura : paragrafos.length;

  // Procura marcador de ACÓRDÃO
  const reAcordao = /^\s*(A\s*C\s*Ó\s*R\s*D\s*Ã\s*O|AC[ÓO]RD[ÃA]O)\s*$/i;
  let idxAcordao = -1;
  for (let i = 0; i < limiteFim; i++) {
    if (reAcordao.test(paragrafos[i]) || reAcordao.test(paragrafos[i].split('\n')[0] || '')) {
      idxAcordao = i; break;
    }
  }
  // Também aceita marcador embutido no início de um parágrafo
  if (idxAcordao < 0) {
    for (let i = 0; i < limiteFim; i++) {
      if (/^(A\s*C\s*Ó\s*R\s*D\s*Ã\s*O|AC[ÓO]RD[ÃA]O)\b/i.test(paragrafos[i])) {
        idxAcordao = i; break;
      }
    }
  }

  const reFimEmenta = /^(\s*)(Vistos,?\s+relatados|V\s*O\s*T\s*O\b|RELAT[ÓO]RIO\b)/i;

  let selecionados: string[] = [];

  if (idxAcordao >= 0) {
    // CASO 1 — extrai do A C Ó R D Ã O até antes do relatório/voto
    let idxFim = limiteFim;
    for (let i = idxAcordao + 1; i < limiteFim; i++) {
      if (reFimEmenta.test(paragrafos[i])) { idxFim = i; break; }
    }
    selecionados = paragrafos.slice(idxAcordao, idxFim);
  } else {
    // CASO 2 — sem acórdão: inclui o bloco inteiro
    selecionados = paragrafos.slice(0, limiteFim);
  }

  // Salvaguarda: nunca devolver só a assinatura — garantir ao menos 2 parágrafos substantivos
  const substantivos = selecionados.filter(p => p.length >= 30 && !ehAssinaturaRelator(p));
  if (substantivos.length < 2) {
    const candidatos = paragrafos.slice(0, limiteFim).filter(p => p.length >= 30 && !ehAssinaturaRelator(p));
    selecionados = candidatos.slice(-2);
  }

  if (assinatura) selecionados = [...selecionados, assinatura];
  return selecionados.join('\n\n').trim();
}

// Mantém compat com chamadas antigas.
function extrairUltimosBlocos(textoBruto: string, _n = 3): string {
  return extrairTrechoFinal(textoBruto);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
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

      const conteudoBruto = pub.conteudo || pub.texto || pub.teor || '';
      const conteudo = conteudoBruto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!conteudo || conteudo.length < 20) {
        return new Response(
          JSON.stringify({ id: pub.id, resumo: 'Publicação sem conteúdo suficiente para resumir.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const truncated = conteudo.substring(0, 8000);
      const userMsg = `Texto integral da publicação a ser resumida (metadados do sistema podem aparecer no início/fim — descarte-os conforme Seção 8):\n\nProcesso: ${pub.processo || pub.numeroProcesso || 'N/A'}\nData: ${pub.data || pub.dataDisponibilizacao || 'N/A'}\n\n---\n${truncated}\n---\n\nRetorne APENAS o objeto JSON conforme a Seção 5, sem texto adicional.`;

      let resumo = 'Não foi possível gerar resumo.';
      const summaryModel = Deno.env.get('OPENAI_SUMMARY_MODEL') || 'gpt-4o';
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
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
              max_tokens: 2000,
              temperature: 0.1,
              response_format: { type: 'json_object' },
            }),
          });

          if (resp.status === 429) {
            const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.warn(`Rate limited (429) for pub ${pub.id}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }

          if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
          const aiResponse = await resp.json();
          resumo = aiResponse.choices?.[0]?.message?.content?.trim() || resumo;
          break; // success
        } catch (e) {
          if (attempt === maxRetries - 1) {
            console.error(`Erro ao resumir pub ${pub.id} após ${maxRetries} tentativas:`, e);
            resumo = 'Erro ao gerar resumo desta publicação.';
          }
        }
      }

      // Converte o JSON do agente em markdown legível para a UI.
      resumo = formatarResumoMarkdown(resumo);

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
