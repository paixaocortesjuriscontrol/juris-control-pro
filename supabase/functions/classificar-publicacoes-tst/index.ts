import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publicacoes } = await req.json();

    if (!publicacoes || !Array.isArray(publicacoes) || publicacoes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma publicação fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY não está configurada");
    }

    // 1. Buscar tabela de IRR do TST
    let tabelaIRR = "";
    try {
      const irrResponse = await fetch("https://www.tst.jus.br/nugep-sp/recursos-repetitivos/tabela-completa", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JurisControl/1.0)" },
      });
      if (irrResponse.ok) {
        const html = await irrResponse.text();
        const temaRegex = /Tema\s*(\d+)|<td[^>]*>\s*(\d+)\s*<\/td>/gi;
        const temas: string[] = [];
        let match;
        while ((match = temaRegex.exec(html)) !== null) {
          const num = match[1] || match[2];
          if (num && parseInt(num) > 0 && parseInt(num) < 500) {
            temas.push(num);
          }
        }
        tabelaIRR = `Temas IRR do TST conhecidos: ${[...new Set(temas)].join(", ")}`;
      }
    } catch (e) {
      console.error("Erro ao buscar tabela IRR:", e);
      tabelaIRR = "Tabela IRR não disponível - classificar com base no conteúdo textual";
    }

    // 2. Pré-classificação determinística por palavras-chave inequívocas
    const PAUTA_KEYWORDS = [
      "pauta de julgamento",
      "aditamento à pauta",
      "aditamento a pauta",
      "sessão virtual",
      "sessão ordinária",
      "sessao virtual",
      "sessao ordinaria",
      "plenario virtual",
      "plenário virtual",
      "incluído no plenário",
      "incluido no plenario",
      "destaque para julgamento",
      "sustentação oral",
      "sustentacao oral",
    ];
    const IRR_KEYWORDS = [
      "incidente de recursos repetitivos",
      "incjulgrreembrep",
      "tabela de irr",
      "recurso de revista repetitivo",
    ];
    const TEMA_REGEX = /\btema\s+(?:vinculante\s+)?(?:n[º°]?\s*)?(\d{1,4})\b/gi;

    function preClassificar(conteudo: string): { categoria: "TEMAS_IRR" | "PAUTA" | "PRAZOS"; tema_irr?: string; observacao_ia?: string } | null {
      const lower = conteudo.toLowerCase();
      // Check IRR first (higher priority per prompt rules)
      const temaMatch = TEMA_REGEX.exec(conteudo);
      if (temaMatch || IRR_KEYWORDS.some(k => lower.includes(k))) {
        TEMA_REGEX.lastIndex = 0;
        const m2 = TEMA_REGEX.exec(conteudo);
        return { categoria: "TEMAS_IRR", tema_irr: m2 ? `Tema ${m2[1]}` : undefined, observacao_ia: "Classificação automática por palavras-chave IRR" };
      }
      TEMA_REGEX.lastIndex = 0;
      // Check PAUTA
      if (PAUTA_KEYWORDS.some(k => lower.includes(k))) {
        return { categoria: "PAUTA", observacao_ia: "Classificação automática por palavras-chave de pauta" };
      }
      return null;
    }

    // 3. Classificar publicações em lotes (apenas as que não foram pré-classificadas)
    const batchSize = 10;
    const resultados: Array<{
      id: string;
      categoria: "TEMAS_IRR" | "PAUTA" | "PRAZOS";
      tema_irr?: string;
      observacao_ia?: string;
      resumo?: string;
    }> = [];

    const pubsParaIA: typeof publicacoes = [];
    for (const p of publicacoes) {
      const conteudoLimpo = (p.conteudo || "").replace(/<[^>]*>/g, " ");
      const pre = preClassificar(conteudoLimpo);
      if (pre) {
        resultados.push({ id: p.id, ...pre });
      } else {
        pubsParaIA.push(p);
      }
    }

    console.log(`Pré-classificadas: ${resultados.length}, para IA: ${pubsParaIA.length}`);

    for (let i = 0; i < pubsParaIA.length; i += batchSize) {
      const batch = pubsParaIA.slice(i, i + batchSize);
      
      const pubsTexto = batch.map((p: any, idx: number) => {
        const conteudoLimpo = (p.conteudo || "").replace(/<[^>]*>/g, " ").substring(0, 3000);
        return `--- PUBLICAÇÃO ${i + idx + 1} (ID: ${p.id}) ---
Processo: ${p.processo_numero || "N/A"}
Órgão: ${p.orgao || p.tribunal || "N/A"}
Tipo: ${p.tipo_comunicacao || "Intimação"}
Conteúdo: ${conteudoLimpo}`;
      }).join("\n\n");

      const systemPrompt = `Você é um assistente jurídico especializado em análise de publicações do TST (Tribunal Superior do Trabalho).

Sua tarefa é classificar cada publicação em EXATAMENTE UMA das 3 categorias:

1. **TEMAS_IRR** - Publicações que mencionam Temas da Tabela de Recursos de Revista Repetitivos (IRR) do TST. 
   Indicadores: menciona "Tema XX" ou "Tema Vinculante", "Tabela de IRR", "Incidente de Recursos Repetitivos", "suspensão" de recurso por tema repetitivo, "IncJulgRREmbRep".
   ${tabelaIRR}

2. **PAUTA** - Publicações sobre inclusão em pauta de julgamento.
   Indicadores: "Pauta de Julgamento", "sessão virtual", "sessão ordinária", "incluído no PLENARIO VIRTUAL", "Aditamento à Pauta", "sustentação oral", "destaque para julgamento", "sessão presencial".

3. **PRAZOS** - Todas as demais publicações que envolvem prazos, decisões, despachos e atos ordinatórios.
   Indicadores: "NEGO SEGUIMENTO", "nego provimento", "rejeito os embargos", "ATO ORDINATÓRIO", "manifestar-se", "prazo legal", decisões monocráticas, certidões, cumprimento de obrigação.

IMPORTANTE:
- Se uma publicação menciona um Tema IRR, classifique como TEMAS_IRR mesmo que também contenha prazo.
- Se uma publicação é sobre pauta de julgamento, classifique como PAUTA mesmo que tenha prazo embutido.
- Para TEMAS_IRR, identifique o número do Tema mencionado (ex: "Tema 208").`;

      const userPrompt = `Classifique as seguintes publicações. Responda APENAS com um JSON válido (sem markdown):
{
  "classificacoes": [
    {
      "id": "id_da_publicacao",
      "categoria": "TEMAS_IRR" | "PAUTA" | "PRAZOS",
      "tema_irr": "Tema XX (se aplicável, senão null)",
      "observacao_ia": "Breve observação sobre a classificação (1 frase)",
      "resumo": "Para PRAZOS: faça um RESUMO ANALÍTICO da publicação como um advogado faria. Resuma o teor da decisão/despacho em linguagem jurídica objetiva, citando trechos relevantes entre aspas quando necessário. Exemplos: 'Negado seguimento ao agravo de instrumento com base no art. 932, III, do CPC e art. 118, X, do RITST.', 'Ato ordinatório intimando a parte agravada para manifestação sobre o agravo interposto, no prazo legal.', 'Rejeitados os embargos de declaração por ausência de vícios a serem sanados.'. Para TEMAS_IRR e PAUTA: null"
    }
  ]
}

${pubsTexto}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido na API Claude. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("Erro na API Claude:", response.status, errorText);
        throw new Error(`Erro ao consultar Claude para classificação: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;

      if (!content) {
        console.error("Resposta vazia do Claude para lote", i);
        batch.forEach((p: any) => {
          resultados.push({ id: p.id, categoria: "PRAZOS", observacao_ia: "Classificação padrão (sem resposta da IA)" });
        });
        continue;
      }

      // Parse JSON
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();

      try {
        const parsed = JSON.parse(jsonStr);
        const classificacoes = parsed.classificacoes || parsed;
        
        if (Array.isArray(classificacoes)) {
          classificacoes.forEach((c: any) => {
            const categoriaValida = ["TEMAS_IRR", "PAUTA", "PRAZOS"].includes(c.categoria) ? c.categoria : "PRAZOS";
            resultados.push({
              id: c.id,
              categoria: categoriaValida,
              tema_irr: c.tema_irr || undefined,
              observacao_ia: c.observacao_ia || undefined,
              resumo: c.resumo || undefined,
            });
          });
        }
      } catch (parseErr) {
        console.error("Erro ao parsear resposta do Claude:", parseErr, jsonStr);
        batch.forEach((p: any) => {
          resultados.push({ id: p.id, categoria: "PRAZOS", observacao_ia: "Erro no parsing da classificação" });
        });
      }

      // Pequeno delay entre lotes
      if (i + batchSize < pubsParaIA.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return new Response(
      JSON.stringify({ classificacoes: resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao classificar publicações:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
