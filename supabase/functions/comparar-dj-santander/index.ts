import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { textoDoc, textoPdf } = await req.json();

    if (!textoDoc || !textoPdf) {
      return new Response(JSON.stringify({ error: "Ambos os textos são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(Deno.env.get("GEMINI_API_KEY_DJEN") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY"))) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    const systemPrompt = `Você é um analista jurídico especializado em extrair números de processos trabalhistas de documentos.

Sua tarefa é analisar DOIS textos e extrair TODOS os números de processos encontrados em cada um.

Números de processos seguem o padrão CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO ou variações como NNNNNNN-DD.AAAA.5.TT.OOOO.
Também podem aparecer sem formatação, apenas como sequência numérica.

IMPORTANTE:
- Extraia APENAS os números de processos, sem duplicatas
- Normalize todos para o formato com pontuação CNJ quando possível
- Retorne a resposta EXCLUSIVAMENTE como um JSON válido (sem markdown, sem código)

O JSON deve ter esta estrutura:
{
  "processos_doc": ["0001234-56.2023.5.01.0001", ...],
  "processos_pdf": ["0001234-56.2023.5.01.0001", ...]
}`;

    const userPrompt = `TEXTO DO DOCUMENTO DO ADVOGADO (DOC):
---
${textoDoc.substring(0, 15000)}
---

TEXTO DO PDF RESUMO (DJEN):
---
${textoPdf.substring(0, 15000)}
---

Extraia todos os números de processos de cada texto.`;

    const response = await geminiChatCompletionsFetch({
      _ai_usage: { edgeFunction: "comparar-dj-santander", authHeader: req.headers.get("authorization"), referer: req.headers.get("referer") }, model: "gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      throw new Error(`Erro Gemini: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    // Parse the JSON response
    let parsed;
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Falha ao interpretar resposta da IA");
    }

    const processosDoc: string[] = parsed.processos_doc || [];
    const processosPdf: string[] = parsed.processos_pdf || [];

    // Compare
    const setDoc = new Set(processosDoc.map((p: string) => p.replace(/\D/g, "")));
    const setPdf = new Set(processosPdf.map((p: string) => p.replace(/\D/g, "")));

    const comuns: string[] = [];
    const somenteDoc: string[] = [];
    const somentePdf: string[] = [];

    // Map normalized -> original for doc
    const docMap = new Map<string, string>();
    processosDoc.forEach((p: string) => docMap.set(p.replace(/\D/g, ""), p));
    const pdfMap = new Map<string, string>();
    processosPdf.forEach((p: string) => pdfMap.set(p.replace(/\D/g, ""), p));

    for (const [norm, orig] of docMap) {
      if (setPdf.has(norm)) {
        comuns.push(orig);
      } else {
        somenteDoc.push(orig);
      }
    }

    for (const [norm, orig] of pdfMap) {
      if (!setDoc.has(norm)) {
        somentePdf.push(orig);
      }
    }

    return new Response(JSON.stringify({
      processos_doc: processosDoc,
      processos_pdf: processosPdf,
      comuns,
      somente_doc: somenteDoc,
      somente_pdf: somentePdf,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
