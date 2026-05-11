import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  SYSTEM_PROMPT as SYSTEM_PROMPT_INDIVIDUAL,
  SYSTEM_PROMPT_FASE_RESUMO,
  SYSTEM_PROMPT_FASE_TRECHO,
} from './prompt-agente.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


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

// ============================================================
// PAUTA DE JULGAMENTO — extração do CABEÇALHO (não do final)
// Para pautas, o trecho juridicamente relevante está no início:
// identifica o tipo de sessão e a data de início/encerramento.
// ============================================================
function isPautaDeJulgamento(conteudo: string): boolean {
  if (!conteudo) return false;
  const txt = conteudo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return /Pauta\s+de\s+Julgamento/i.test(txt) ||
    (/\bSess[aã]o\s+(Ordin[áa]ria|Extraordin[áa]ria|Virtual|Presencial)/i.test(txt) &&
      /\bsess[aã]o\s+(virtual|presencial)/i.test(txt));
}

function extrairTrechoPauta(conteudo: string): string {
  if (!conteudo || !isPautaDeJulgamento(conteudo)) return "";
  const semHtml = conteudo
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n?/g, "\n");
  const txt = semHtml.split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
  const m = txt.match(/Pauta\s+de\s+Julgamento/i);
  const start = m ? m.index! : 0;
  const body = txt.slice(start);
  const fim = body.match(/encerramento[\s\S]{0,120}?\d{2}\/\d{2}\/\d{4}\s*\.?/i);
  if (fim) {
    const end = (fim.index ?? 0) + fim[0].length;
    return body.slice(0, end).trim();
  }
  const ini = body.match(/in[ií]cio[\s\S]{0,120}?\d{2}\/\d{2}\/\d{4}\s*\.?/i);
  if (ini) {
    const end = (ini.index ?? 0) + ini[0].length;
    return body.slice(0, end).trim();
  }
  const cut = body.slice(0, 1500);
  const lastDot = cut.lastIndexOf(".");
  return (lastDot > 200 ? cut.slice(0, lastDot + 1) : cut).trim();
}

// Converte o JSON do agente DJEN em texto plano legível para exibição na UI.
function formatarResumoTextoPlano(jsonStr: string): string {
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    const limpo = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { data = JSON.parse(limpo); } catch { return jsonStr; }
  }

  const linhas: string[] = [];
  // Remove qualquer marcador markdown (**bold**, *italic*) que a IA insira por engano
  const stripMd = (v: any) => {
    if (v === null || v === undefined) return v;
    return String(v).replace(/\*\*/g, '').replace(/(^|\s)\*(\S[^*]*\S)\*(?=\s|$)/g, '$1$2').trim();
  };
  const push = (label: string, val: any) => {
    if (val === null || val === undefined || val === '') return;
    linhas.push(`${label}: ${stripMd(val)}`);
  };

  // Tipo de ato, Processo, Órgão, Partes e Data já constam no cabeçalho do documento.
  // Não duplicar aqui — começamos direto pelo Relator.
  push('Relator(a)', data.magistrado_relator);

  if (data.resumo) {
    linhas.push('');
    linhas.push(`Resumo: ${stripMd(data.resumo)}`);
  }

  if (data.prazo && data.prazo.existe) {
    linhas.push('');
    const partesPrazo = [data.prazo.descricao];
    if (data.prazo.dias) partesPrazo.push(`${data.prazo.dias} dia(s) ${data.prazo.tipo || ''}`.trim());
    push('Prazo', partesPrazo.filter(Boolean).join(' — '));
  }

  if (Array.isArray(data.providencias) && data.providencias.length > 0) {
    linhas.push('');
    linhas.push('Providências:');
    data.providencias.forEach((p: string) => linhas.push(`- ${stripMd(p)}`));
  }

  if (Array.isArray(data.alertas) && data.alertas.length > 0) {
    linhas.push('');
    linhas.push('Alertas:');
    data.alertas.forEach((a: string) => linhas.push(`- ${stripMd(a)}`));
  }

  if (data.trecho_preservado) {
    linhas.push('');
    linhas.push('TRECHO FINAL DA PUBLICAÇÃO (original, sem resumir)');
    linhas.push(stripMd(data.trecho_preservado));
  }

  if (data.assinatura) {
    linhas.push('');
    linhas.push('Assinatura:');
    linhas.push(stripMd(data.assinatura));
  }

  if (data.intimados) {
    linhas.push('');
    const txt = stripMd(data.intimados);
    // Garante o rótulo "Intimado(s) / Citado(s):" caso a IA já tenha incluído ou não
    if (/^Intimado/i.test(txt)) linhas.push(txt);
    else linhas.push(`Intimado(s) / Citado(s): ${txt}`);
  }

  return linhas.join('\n').trim();
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
    const { publicacoes, publicacao, monitoramentoId, resumoIndividual, apenasTrecho } = body;

    // ── Modo APENAS TRECHO: roda só a Fase 2 e devolve trecho_preservado + assinatura + intimados (texto puro) ──
    if (apenasTrecho) {
      const pub = publicacao || (publicacoes && publicacoes[0]);
      if (!pub) {
        return new Response(
          JSON.stringify({ id: null, trecho: '' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const conteudoBruto = pub.conteudo || pub.texto || pub.teor || '';
      const conteudo = conteudoBruto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!conteudo || conteudo.length < 20) {
        return new Response(
          JSON.stringify({ id: pub.id, trecho: '' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const summaryModel = Deno.env.get('OPENAI_SUMMARY_MODEL') || 'gpt-4o';
      const tailLength = 6000;
      const trechoTail = conteudo.length > tailLength ? '…' + conteudo.substring(conteudo.length - tailLength) : conteudo;
      const processo = pub.processo || pub.numeroProcesso || 'N/A';
      const dataPub = pub.data || pub.dataDisponibilizacao || 'N/A';
      const userMsg = `PUBLICAÇÃO ÚNICA — extraia trecho_preservado e assinatura SOMENTE deste texto, lendo do FINAL para o começo. Ignore qualquer contexto anterior.\n\nProcesso: ${processo}\nData: ${dataPub}\n\n--- PORÇÃO FINAL DO TEXTO (leia de trás para frente) ---\n${trechoTail}\n--- FIM ---\n\nRetorne APENAS o JSON da Fase 2 com os campos trecho_preservado e assinatura.`;
      try {
        let respText = '';
        for (let attempt = 0; attempt < 3; attempt++) {
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: summaryModel,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT_FASE_TRECHO },
                { role: 'user', content: userMsg },
              ],
              max_tokens: 2000,
              temperature: 0.1,
              response_format: { type: 'json_object' },
            }),
          });
          if (resp.status === 429) { await new Promise(r => setTimeout(r, Math.min(2000 * Math.pow(2, attempt), 10000))); continue; }
          if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
          const aiResp = await resp.json();
          respText = aiResp.choices?.[0]?.message?.content?.trim() || '';
          break;
        }
        let dados: any = {};
        try { dados = JSON.parse(respText); } catch {
          const limpo = respText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
          try { dados = JSON.parse(limpo); } catch { dados = {}; }
        }
        const partes: string[] = [];
        if (dados.trecho_preservado) partes.push(String(dados.trecho_preservado).trim());
        if (dados.assinatura) { partes.push(''); partes.push(String(dados.assinatura).trim()); }
        if (dados.intimados) { partes.push(''); partes.push(String(dados.intimados).trim()); }
        return new Response(
          JSON.stringify({ id: pub.id, trecho: partes.join('\n\n').trim() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error(`Erro apenasTrecho pub ${pub.id}:`, e);
        return new Response(
          JSON.stringify({ id: pub.id, trecho: '' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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

      // Execução em DUAS FASES por publicação, com isolamento total entre publicações
      // (cada chamada é independente — sem histórico, sem contexto compartilhado).
      const summaryModel = Deno.env.get('OPENAI_SUMMARY_MODEL') || 'gpt-4o';
      const maxRetries = 3;
      const processo = pub.processo || pub.numeroProcesso || 'N/A';
      const dataPub = pub.data || pub.dataDisponibilizacao || 'N/A';

      // Helper: 1 chamada à OpenAI com retry/backoff
      async function callOpenAI(systemPrompt: string, userMsg: string, maxTokens: number): Promise<string> {
        let lastErr: unknown = null;
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
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userMsg },
                ],
                max_tokens: maxTokens,
                temperature: 0.1,
                response_format: { type: 'json_object' },
              }),
            });
            if (resp.status === 429) {
              const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000);
              console.warn(`Rate limited (429) pub ${pub.id}, retry em ${waitMs}ms (${attempt + 1}/${maxRetries})`);
              await new Promise(r => setTimeout(r, waitMs));
              continue;
            }
            if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
            const aiResponse = await resp.json();
            return aiResponse.choices?.[0]?.message?.content?.trim() || '';
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr || new Error('Falha após retries');
      }

      // ── FASE 1: RESUMO (sem trecho_preservado / assinatura) ──
      const truncadoInicio = conteudo.substring(0, 8000);
      const userMsgFase1 = `PUBLICAÇÃO ÚNICA — analise SOMENTE este texto, isolado de qualquer outro contexto.\n\nProcesso: ${processo}\nData: ${dataPub}\n\n--- TEXTO INTEGRAL ---\n${truncadoInicio}\n--- FIM DO TEXTO ---\n\nRetorne APENAS o JSON da Fase 1 (sem trecho_preservado nem assinatura).`;

      // ── FASE 2: TRECHO FINAL — apenas a porção FINAL do texto ──
      // Envia os últimos 6000 caracteres para o modelo focar no fim.
      const tailLength = 6000;
      const trechoFinal = conteudo.length > tailLength
        ? '…' + conteudo.substring(conteudo.length - tailLength)
        : conteudo;
      const userMsgFase2 = `PUBLICAÇÃO ÚNICA — extraia trecho_preservado e assinatura SOMENTE deste texto, lendo do FINAL para o começo. Ignore qualquer contexto anterior.\n\nProcesso: ${processo}\nData: ${dataPub}\n\n--- PORÇÃO FINAL DO TEXTO (leia de trás para frente) ---\n${trechoFinal}\n--- FIM ---\n\nRetorne APENAS o JSON da Fase 2 com os campos trecho_preservado e assinatura.`;

      let dadosResumo: any = {};
      let dadosTrecho: any = {};

      try {
        const [respFase1, respFase2] = await Promise.all([
          callOpenAI(SYSTEM_PROMPT_FASE_RESUMO, userMsgFase1, 1500),
          callOpenAI(SYSTEM_PROMPT_FASE_TRECHO, userMsgFase2, 2000),
        ]);
        try { dadosResumo = JSON.parse(respFase1); } catch {
          const limpo = respFase1.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
          try { dadosResumo = JSON.parse(limpo); } catch { dadosResumo = { resumo: respFase1 }; }
        }
        try { dadosTrecho = JSON.parse(respFase2); } catch {
          const limpo = respFase2.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
          try { dadosTrecho = JSON.parse(limpo); } catch { dadosTrecho = {}; }
        }
      } catch (e) {
        console.error(`Erro ao resumir pub ${pub.id}:`, e);
        return new Response(
          JSON.stringify({ id: pub.id, resumo: 'Erro ao gerar resumo desta publicação.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mescla as duas fases em um único objeto e formata em markdown
      const merged = {
        ...dadosResumo,
        trecho_preservado: dadosTrecho.trecho_preservado ?? null,
        assinatura: dadosTrecho.assinatura ?? null,
        intimados: dadosTrecho.intimados ?? null,
      };
      const resumo = formatarResumoTextoPlano(JSON.stringify(merged));

      return new Response(
        JSON.stringify({ id: pub.id, resumo, orgao: merged.orgao ?? null }),
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
      ? `\n\nAVISO: Foram analisadas ${MAX_PUBLICACOES} de ${totalOriginal} publicações.`
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

Seja preciso ao extrair números de processos e prazos. Use texto plano sem formatação especial. Não use negrito, itálico, bullets nem markdown.`
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
