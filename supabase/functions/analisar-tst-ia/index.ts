import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { processoId } = await req.json();

    if (!processoId) {
      return new Response(
        JSON.stringify({ error: "processoId é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch process data
    const { data: processo, error: procError } = await supabase
      .from("processos")
      .select("*")
      .eq("id", processoId)
      .single();

    if (procError || !processo) {
      throw new Error("Processo não encontrado");
    }

    // Fetch indexed text pages for this process (from documentos_texto_indexado)
    const { data: paginasIndexadas, error: idxError } = await supabase
      .from("documentos_texto_indexado")
      .select("documento_id, pagina, conteudo_texto")
      .eq("processo_id", processoId)
      .order("documento_id")
      .order("pagina")
      .limit(500);

    // Also fetch document names for context
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

    // If no indexed content, fallback to conteudo_extraido
    let allDocContent = "";
    let docsCount = 0;

    if (paginasIndexadas && paginasIndexadas.length > 0) {
      // Group by document
      const grouped: Record<string, string[]> = {};
      for (const p of paginasIndexadas) {
        const key = p.documento_id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
      }

      const parts: string[] = [];
      let totalChars = 0;
      const maxChars = 50000;

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
        docsCount++;
      }

      allDocContent = parts.join("\n\n");
    } else {
      // Fallback: use conteudo_extraido from documentos
      const { data: documentos } = await supabase
        .from("documentos")
        .select("id, nome, conteudo_extraido")
        .eq("processo_id", processoId)
        .not("conteudo_extraido", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!documentos || documentos.length === 0) {
        return new Response(
          JSON.stringify({
            error:
              "Nenhum documento com conteúdo extraído encontrado. Envie documentos na aba Pasta primeiro.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let totalChars = 0;
      const maxChars = 50000;
      const docTexts: string[] = [];

      for (const doc of documentos) {
        const content = doc.conteudo_extraido || "";
        if (totalChars + content.length > maxChars) break;
        docTexts.push(`=== ${doc.nome} ===\n${content}`);
        totalChars += content.length;
        docsCount++;
      }

      allDocContent = docTexts.join("\n\n");
    }

    // Build context about current processo
    const processoContext = `
Número do Processo: ${processo.numero || "N/A"}
Polo Ativo (Reclamante): ${processo.polo_ativo || "N/A"}
Polo Passivo (Reclamado): ${processo.polo_passivo || "N/A"}
Tribunal: ${processo.tribunal || "N/A"}
Vara: ${processo.vara || "N/A"}
Comarca: ${processo.comarca || "N/A"}
Data de Distribuição: ${processo.data_distribuicao || "N/A"}
Assunto: ${processo.assunto || "N/A"}
Status: ${processo.status || "N/A"}
Área: ${processo.area || "N/A"}
`;

    const systemPrompt = `Você é um especialista jurídico brasileiro em processos trabalhistas no TST (Tribunal Superior do Trabalho).
Analise os documentos anexados ao processo e extraia informações para preencher os campos do formulário TST.

CAMPOS A PREENCHER (retorne apenas os que conseguir identificar nos documentos):

1. dossie_tst - Número do dossiê no TST
2. equipe_tst - Nome da equipe responsável no TST
3. relator_tst - Nome do Ministro Relator
4. relator_favorabilidade - Favorabilidade do relator: "+" (favorável), "-" (desfavorável), ou "neutro"
5. turma_tst - Turma do TST (ex: "1ª Turma", "SDI-1", etc.)
6. turma_favorabilidade - Favorabilidade da turma: "+" (favorável), "-" (desfavorável), ou "neutro"
7. parte_recorrente_tst - Quem é o recorrente (ex: "Reclamante", "Reclamado", "Ambos")
8. tipo_recurso_reclamante - Tipo do recurso do reclamante (ex: "Recurso de Revista", "Agravo de Instrumento", etc.)
9. materias_recurso_reclamante - Matérias discutidas no recurso do reclamante
10. aparelhamento_reclamante - Aparelhamento do recurso do reclamante (ex: "Bem aparelhado", "Mal aparelhado")
11. chance_exito_reclamante - Chance de êxito do reclamante (ex: "Alta", "Média", "Baixa", "Remota")
12. tipo_recurso_banco - Tipo do recurso do banco/reclamado
13. materias_recurso_banco - Matérias discutidas no recurso do banco/reclamado
14. aparelhamento_banco - Aparelhamento do recurso do banco/reclamado
15. chance_exito_banco - Chance de êxito do banco/reclamado
16. honra_tst - Questão de honra no processo (ex: "Sim", "Não", ou descrição)
17. tema_tst - Tema(s) principal(is) do processo no TST
18. execucao_tst - Fase/status de execução
19. midia_negativa_tst - Risco de mídia negativa (ex: "Sim", "Não", ou descrição)
20. decisao_quarteirizado - Decisão do quarteirizado (descrição detalhada se houver)
21. recurso_terceiros_tst - Recurso de terceiros (ex: "Sim - MPT", "Não")

DADOS DO PROCESSO:
${processoContext}

Responda APENAS em JSON válido com os campos que conseguir preencher. Use null para campos não identificados.
{
  "dossie_tst": "valor ou null",
  "equipe_tst": "valor ou null",
  "relator_tst": "valor ou null",
  "relator_favorabilidade": "valor ou null",
  "turma_tst": "valor ou null",
  "turma_favorabilidade": "valor ou null",
  "parte_recorrente_tst": "valor ou null",
  "tipo_recurso_reclamante": "valor ou null",
  "materias_recurso_reclamante": "valor ou null",
  "aparelhamento_reclamante": "valor ou null",
  "chance_exito_reclamante": "valor ou null",
  "tipo_recurso_banco": "valor ou null",
  "materias_recurso_banco": "valor ou null",
  "aparelhamento_banco": "valor ou null",
  "chance_exito_banco": "valor ou null",
  "honra_tst": "valor ou null",
  "tema_tst": "valor ou null",
  "execucao_tst": "valor ou null",
  "midia_negativa_tst": "valor ou null",
  "decisao_quarteirizado": "valor ou null",
  "recurso_terceiros_tst": "valor ou null",
  "observacoes": "resumo da análise e confiança nos dados extraídos"
}`;

    console.log(
      `Analisando TST para processo ${processo.numero}, ${docsCount} documentos, ${paginasIndexadas?.length || 0} páginas indexadas`
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise os seguintes documentos do processo e extraia as informações TST:\n\n${allDocContent}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    let result;
    try {
      const jsonStr = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      result = JSON.parse(jsonStr);
    } catch {
      console.error("Erro ao parsear resposta:", content);
      throw new Error("Não foi possível processar a resposta da IA");
    }

    // Filter out null values
    const filtered: Record<string, string> = {};
    const validFields = [
      "dossie_tst", "equipe_tst", "relator_tst", "relator_favorabilidade",
      "turma_tst", "turma_favorabilidade", "parte_recorrente_tst",
      "tipo_recurso_reclamante", "materias_recurso_reclamante",
      "aparelhamento_reclamante", "chance_exito_reclamante",
      "tipo_recurso_banco", "materias_recurso_banco", "aparelhamento_banco",
      "chance_exito_banco", "honra_tst", "tema_tst", "execucao_tst",
      "midia_negativa_tst", "decisao_quarteirizado", "recurso_terceiros_tst",
    ];

    for (const field of validFields) {
      if (result[field] && result[field] !== "null") {
        filtered[field] = String(result[field]);
      }
    }

    console.log(
      `Análise TST concluída: ${Object.keys(filtered).length} campos preenchidos`
    );

    return new Response(
      JSON.stringify({
        campos: filtered,
        observacoes: result.observacoes || null,
        documentos_analisados: docsCount,
        paginas_indexadas: paginasIndexadas?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro na análise TST:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
