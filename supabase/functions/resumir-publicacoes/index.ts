import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

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
6. Se a publicação for curta (certidão, intimação simples), pode transcrever os trechos principais quase na íntegra. Se for longa, selecione os trechos que um advogado sublinharia para a cliente.
7. NÃO inclua o trecho final no seu resumo — ele será anexado automaticamente, na íntegra, ao final do texto. Foque apenas em destacar/transcrever os trechos relevantes do meio da publicação. Não mencione "TRECHO FINAL" nem repita os últimos blocos.`;

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

      const truncated = conteudo.substring(0, 4000);
      const trechoFinal = extrairTrechoFinal(conteudoBruto);
      const userMsg = `Analise e resuma esta publicação jurídica:\n\nProcesso: ${pub.processo || pub.numeroProcesso || 'N/A'}\nData: ${pub.data || pub.dataDisponibilizacao || 'N/A'}\n\nConteúdo da publicação:\n${truncated}\n\n(O trecho final (ementa do acórdão ou texto integral da intimação + assinatura do Relator) será anexado automaticamente, na íntegra, ao final. NÃO o inclua no seu resumo.)`;

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
              max_tokens: 1200,
              temperature: 0.2,
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

      // Garantia: SEMPRE anexar o trecho final literal da publicação ao fim do resumo,
      // sem nenhuma alteração do conteúdo original. Se o modelo já incluiu, removemos
      // a versão dele para evitar duplicação e colocamos a versão literal.
      if (trechoFinal) {
        // Remove qualquer seção "TRECHO FINAL" anterior gerada pelo modelo
        const marcador = /\n*-{2,}\s*TRECHO FINAL[^\n]*\n[\s\S]*$/i;
        const resumoLimpo = resumo.replace(marcador, '').trimEnd();
        resumo = `${resumoLimpo}\n\n--- TRECHO FINAL DA PUBLICAÇÃO (original, sem resumir) ---\n${trechoFinal}`;
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
