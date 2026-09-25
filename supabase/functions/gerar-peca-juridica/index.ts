import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";
import { logAiUsage } from "../_shared/ai-usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_PECA_LABEL: Record<string, string> = {
  contestacao: "Contestação",
  recurso_ordinario: "Recurso Ordinário",
  contrarrazoes: "Contrarrazões",
  peticao_inicial: "Petição Inicial",
  memoriais: "Memoriais",
  outros: "Peça Processual",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { processoId, tipoPeca, teseId, observacoes } = await req.json();

    if (!processoId || !tipoPeca) {
      return new Response(
        JSON.stringify({ error: "processoId e tipoPeca são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("authorization");
    const hasGeminiKey = !!(
      Deno.env.get("GEMINI_API_KEY_DJEN") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GOOGLE_API_KEY")
    );
    if (!hasGeminiKey) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar dados do processo
    const { data: processo, error: procError } = await supabase
      .from("processos")
      .select("numero, classe, assunto, area, tribunal, vara, comarca, data_distribuicao, polo_ativo, polo_passivo, valor_causa, valor_condenacao, resultado, status")
      .eq("id", processoId)
      .single();
    if (procError || !processo) {
      throw new Error("Processo não encontrado");
    }

    // 2. Buscar partes do processo
    const { data: partesRaw } = await supabase
      .from("processos_partes")
      .select("polo, nome, documento, is_advogado")
      .eq("processo_id", processoId)
      .order("polo");
    const partes = partesRaw || [];

    // 3. Buscar movimentações recentes
    const { data: movRaw } = await supabase
      .from("movimentacoes")
      .select("data_movimentacao, descricao")
      .eq("processo_id", processoId)
      .order("data_movimentacao", { ascending: false })
      .limit(20);
    const movimentacoes = (movRaw || []).map((m: any) => ({ data: m.data_movimentacao, descricao: m.descricao }));

    // 4. Buscar texto indexado (petição inicial e documentos principais)
    const { data: paginasIndexadas } = await supabase
      .from("documentos_texto_indexado")
      .select("documento_id, pagina, conteudo_texto")
      .eq("processo_id", processoId)
      .order("documento_id")
      .order("pagina")
      .limit(200);

    const docIds = [...new Set((paginasIndexadas || []).map((p: any) => p.documento_id))];
    let docNames: Record<string, string> = {};
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from("documentos")
        .select("id, nome")
        .in("id", docIds);
      if (docs) {
        docNames = Object.fromEntries(docs.map((d: any) => [d.id, d.nome]));
      }
    }

    let allDocContent = "";
    let totalChars = 0;
    const maxChars = 60000;
    if (paginasIndexadas && paginasIndexadas.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const p of paginasIndexadas) {
        const key = p.documento_id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
      }
      const parts: string[] = [];
      for (const [docId, pages] of Object.entries(grouped)) {
        const docName = docNames[docId] || "Documento";
        const docText = `=== ${docName} ===\n${pages.join("\n")}`;
        if (totalChars + docText.length > maxChars) {
          const remaining = maxChars - totalChars;
          if (remaining > 500) parts.push(docText.substring(0, remaining) + "\n[...truncado]");
          break;
        }
        parts.push(docText);
        totalChars += docText.length;
      }
      allDocContent = parts.join("\n\n");
    }

    // 5. Buscar tese(s) aplicável(is)
    let tese: any = null;
    if (teseId) {
      const { data: teseData } = await supabase
        .from("teses_juridicas")
        .select("*")
        .eq("id", teseId)
        .single();
      tese = teseData;
    } else {
      // RPC: buscar teses aplicáveis automaticamente
      const { data: tesesEncontradas, error: rpcError } = await supabase.rpc(
        "buscar_teses_aplicaveis",
        { p_processo_id: processoId, p_tipo_peca: tipoPeca, p_limite: 1 },
      );
      if (!rpcError && Array.isArray(tesesEncontradas) && tesesEncontradas.length > 0) {
        const t = tesesEncontradas[0];
        // Buscar a tese completa
        const { data: teseData } = await supabase
          .from("teses_juridicas")
          .select("*")
          .eq("id", t.id)
          .single();
        tese = teseData;
      }
    }

    // 6. Montar contexto do processo
    const partesText = (partes || [])
      .map((p: any) => {
        const polo = String(p.polo || "").toLowerCase().includes("at") ? "Polo Ativo" : "Polo Passivo";
        return `${polo}${p.is_advogado ? " (Advogado)" : ""}: ${p.nome}`;
      })
      .join("\n");

    const movimentacoesText = (movimentacoes || [])
      .slice(0, 10)
      .map((m: any) => `${m.data || ""} — ${m.descricao || ""}`)
      .join("\n");

    const processoContext = `
NÚMERO DO PROCESSO: ${processo.numero || "N/A"}
CLASSE: ${processo.classe || "N/A"}
ASSUNTO: ${processo.assunto || "N/A"}
ÁREA: ${processo.area || "N/A"}
TRIBUNAL: ${processo.tribunal || "N/A"}
VARA: ${processo.vara || "N/A"}
COMARCA: ${processo.comarca || "N/A"}
DATA DE DISTRIBUIÇÃO: ${processo.data_distribuicao || "N/A"}
VALOR DA CAUSA: ${processo.valor_causa || "N/A"}
VALOR DA CONDENAÇÃO: ${processo.valor_condenacao || "N/A"}
STATUS: ${processo.status || "N/A"}
RESULTADO: ${processo.resultado || "N/A"}

PARTES:
${partesText || "N/A"}

MOVIMENTAÇÕES RECENTES:
${movimentacoesText || "N/A"}
`;

    // 7. Montar prompt da tese
    const teseContext = tese
      ? `
TESE APLICÁVEL (do banco de teses):
Título: ${tese.titulo || "N/A"}
Tipo de Peça: ${TIPOS_PECA_LABEL[tese.tipo_peca] || tese.tipo_peca || "N/A"}
Matéria: ${tese.materia || "N/A"}
Assunto CNJ: ${tese.assunto_cnj || "N/A"}
Tipo de Recurso: ${tese.tipo_recurso || "N/A"}
Tags: ${(tese.tags || []).join(", ") || "N/A"}

FUNDAMENTOS DA TESE:
${tese.fundamentos || "N/A"}
${tese.peca_modelo ? `\nPEÇA-MODELO DO ESCRITÓRIO (siga a estrutura, o estilo e os argumentos, adaptando aos fatos deste processo; não copie nomes):\n${String(tese.peca_modelo).slice(0, 30000)}\n` : ""}
`
      : `
Nenhuma tese específica encontrada no banco de teses. Gere a peça com base nas melhores práticas processuais e na legislação aplicável.
`;

    const labelPeca = TIPOS_PECA_LABEL[tipoPeca] || "Peça Processual";
    const observacoesText = observacoes
      ? `\nOBSERVAÇÕES DO ADVOGADO:\n${observacoes}\n`
      : "";

    // 8. Prompt do sistema
    const systemPrompt = `Você é um advogado especialista em Direito do Trabalho brasileiro, com profunda experiência na redação de peças processuais para o Tribunal Superior do Trabalho (TST) e Tribunais Regionais do Trabalho (TRT).

Sua missão é gerar uma MINUTA de ${labelPeca} com base nos dados do processo, na tese jurídica aplicável e nos documentos anexados.

DIRETRIZES:
1. A peça deve seguir rigorosamente o formato processual brasileiro (endereçamento, qualificação, fatos, fundamentos, pedidos).
2. Use linguagem jurídica formal, objetiva e precisa.
3. Fundamente sempre nos dispositivos legais e jurisprudência citados na tese.
4. Adapte os argumentos aos fatos específicos do processo.
5. Se a tese não cobrir todos os pontos, complemente com argumentos jurídicos sólidos.
6. Inclua endereçamento correto conforme tribunal e vara.
7. A peça deve estar pronta para revisão — não é a versão final.

FORMATO DA PEÇA:
- Endereçamento ao tribunal/órgão competente
- Qualificação das partes (usar dados disponíveis)
- Síntese dos fatos
- Fundamentos jurídicos (artigos, súmulas, jurisprudência)
- Pedidos
- Data e local para assinatura

${processo.area === "trabalhista" ? "Use a CLT, Súmulas do TST e OJs correlatas. Art. 840, §1º CLT (contestação) ou Art. 895 CLT (recursos)." : "Use o CPC/legislação correlata à área."}

Gere APENAS o texto da peça, sem comentários ou explicações.`;

    const userPrompt = `Gere uma MINUTA de ${labelPeca} para o processo abaixo.

${processoContext}

${teseContext}

${observacoesText}

${allDocContent ? `DOCUMENTOS DO PROCESSO (trechos relevantes):\n${allDocContent}\n` : ""}

Gere a ${labelPeca} completa, em formato pronto para revisão.`;

    // 9. Chamar Gemini
    const aiResponse = await geminiChatCompletionsFetch({
      model: "gemini-flash-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
      _ai_usage: {
        edgeFunction: "gerar-peca-juridica",
        authHeader,
        referer: req.headers.get("referer"),
        origem: "gerar-peca-juridica",
        metadata: { processo_id: processoId, tipo_peca: tipoPeca, tese_id: teseId ?? null },
      },
    });

    if (!aiResponse.ok) {
      const errData = await aiResponse.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini retornou status ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const conteudo = aiData?.choices?.[0]?.message?.content || "";
    const usage = aiData?.usage || {};
    const modeloUsado = aiData?.model || "gemini-flash-latest";

    if (!conteudo) {
      throw new Error("IA não retornou conteúdo para a peça");
    }

    // 10. Calcular custo
    const promptTokens = usage.prompt_tokens ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
    const custoUsd =
      (promptTokens / 1_000_000) * 0.30 + (completionTokens / 1_000_000) * 2.50;

    // 11. Decodificar usuário do JWT
    let userId: string | null = null;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const parts = token.split(".");
        const pad = "=".repeat((4 - (parts[1].length % 4)) % 4);
        const json = atob((parts[1] + pad).replace(/-/g, "+").replace(/_/g, "/"));
        userId = JSON.parse(json)?.sub ?? null;
      } catch {}
    }

    // 12. Salvar peça gerada
    const { data: pecaSalva, error: pecaError } = await supabase
      .from("pecas_geradas")
      .insert({
        processo_id: processoId,
        tese_id: teseId ?? tese?.id ?? null,
        tipo_peca: tipoPeca,
        conteudo,
        modelo_ia: modeloUsado,
        custo_usd: custoUsd,
        tokens_input: promptTokens,
        tokens_output: completionTokens,
        revisado: false,
        observacoes: observacoes ?? null,
        criado_por: userId,
      })
      .select("*")
      .single();

    if (pecaError) {
      console.error("[gerar-peca-juridica] Erro ao salvar peça:", pecaError.message);
    }

    // Log já foi feito pelo geminiChatCompletionsFetch (_ai_usage)

    return new Response(
      JSON.stringify({
        success: true,
        peca: pecaSalva,
        conteudo,
        modelo: modeloUsado,
        tokens: { input: promptTokens, output: completionTokens, total: totalTokens },
        custo_usd: custoUsd,
        tese_usada: tese ? {
          id: tese.id,
          titulo: tese.titulo,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[gerar-peca-juridica] Erro:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro ao gerar peça jurídica" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
