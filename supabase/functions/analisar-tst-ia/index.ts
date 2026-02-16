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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada");
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

    // Fetch indexed text pages
    const { data: paginasIndexadas } = await supabase
      .from("documentos_texto_indexado")
      .select("documento_id, pagina, conteudo_texto")
      .eq("processo_id", processoId)
      .order("documento_id")
      .order("pagina")
      .limit(500);

    // Fetch document names
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

    // Build document content
    let allDocContent = "";
    let docsCount = 0;
    const maxChars = 80000; // Claude supports much larger context

    if (paginasIndexadas && paginasIndexadas.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const p of paginasIndexadas) {
        const key = p.documento_id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
      }

      const parts: string[] = [];
      let totalChars = 0;

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
      // Fallback: conteudo_extraido
      const { data: documentos } = await supabase
        .from("documentos")
        .select("id, nome, conteudo_extraido")
        .eq("processo_id", processoId)
        .not("conteudo_extraido", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!documentos || documentos.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhum documento com conteúdo extraído encontrado. Envie documentos na aba Pasta primeiro." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let totalChars = 0;
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

    const systemPrompt = `Você é um Consultor Jurídico Especialista em TST para o Banco Santander. Sua missão é realizar a triagem mensal de processos distribuídos ao Tribunal Superior do Trabalho com foco em agilidade, precisão técnica e recomendação estratégica. Ao final da análise, você deve preencher OBRIGATORIAMENTE o formulário do sistema interno "TST".

DIRETRIZES DE ANÁLISE:

1. Foco no Despacho: Ao analisar os documentos, priorize o Despacho de Admissibilidade (Decisão do TRT que nega ou admite o RR) e as petições de AIRR/RR.

2. Mapeamento de Matérias: Identifique todas as matérias (principais e acessórias). Use o formato: "1. Matéria A; 2. Matéria B; 3. Matéria C".

3. Separação por Parte: Se houver recursos do Banco e do Reclamante, crie blocos distintos para cada um.

4. Aparelhamento e Êxito: Realize uma análise global do recurso (se está bem fundamentado conforme o Art. 896 da CLT ou se esbarra em óbices como as Súmulas 126, 296 ou 333 do TST). Classifique a chance de êxito como Alta / Média / Remota.

5. Status e Trânsito: Verifique se já houve decisão (monocrática ou acórdão), se existem agravos internos/embargos e se já ocorreu o trânsito em julgado (com data).

6. Análise de Sentimento do Relator/Turma: Com base no histórico do relator e da turma (se disponível nos autos ou por conhecimento jurisprudencial), indique se são favoráveis (+) ou desfavoráveis (-) à tese do Banco.

7. Mídia Negativa: Avalie se o caso envolve valores expressivos, pessoa famosa, ou matéria sensível que possa atrair a atenção da imprensa (Baixo / Médio / Alto).

DIRETRIZ DE OPERAÇÃO:
Seja extremamente objetivo. O objetivo é permitir que o advogado leia a ficha em menos de 30 segundos e consiga alimentar o sistema "TST" e a planilha de controle imediatamente. Preencha TODOS os campos. Se alguma informação não estiver disponível, utilize "Não informado" ou "N/A".

REGRAS CRÍTICAS:
- Analise TODOS os documentos fornecidos antes de responder
- TODOS os campos devem ser preenchidos com algum valor - NUNCA retorne null
- Para campos de "matérias", use formato numerado: "1. Matéria A; 2. Matéria B"
- Para "aparelhamento", faça análise global: "Bem aparelhado / Deficiente / Risco de Súmula 126"
- Para "chance de êxito", use: "Alta / Média / Remota"
- Para "mídia negativa", use: "Baixo / Médio / Alto"
- Para favorabilidade (+ ou -), fundamente com base nos documentos

Responda APENAS em JSON válido. TODOS os campos devem ter valor string (nunca null):
{
  "dossie_tst": "valor ou N/A",
  "equipe_tst": "valor ou N/A",
  "relator_tst": "Nome do Ministro ou N/A",
  "relator_favorabilidade": "+ ou - ou N/A",
  "turma_tst": "Ex: 1ª Turma, 2ª Turma, SDI-1 ou N/A",
  "turma_favorabilidade": "+ ou - ou N/A",
  "parte_recorrente_tst": "Banco / Reclamante / Ambos ou N/A",
  "tipo_recurso_reclamante": "Ex: Recurso de Revista, AIRR ou N/A",
  "materias_recurso_reclamante": "1. Matéria A; 2. Matéria B ou N/A",
  "aparelhamento_reclamante": "Análise global ou N/A",
  "chance_exito_reclamante": "Alta / Média / Remota ou N/A",
  "tipo_recurso_banco": "Ex: Recurso de Revista, AIRR ou N/A",
  "materias_recurso_banco": "1. Matéria A; 2. Matéria B ou N/A",
  "aparelhamento_banco": "Análise global ou N/A",
  "chance_exito_banco": "Alta / Média / Remota ou N/A",
  "honra_tst": "Informações sobre honorários ou Não informado",
  "tema_tst": "Ex: Tema 246 do TST ou N/A",
  "execucao_tst": "Definitiva / Provisória / Suspensa / Cognição ou N/A",
  "midia_negativa_tst": "Baixo / Médio / Alto",
  "decisao_quarteirizado": "Resumo conciso da sentença de 1º grau ou Não informado",
  "recurso_terceiros_tst": "Sim - quem / Não",
  "status_tst": "Ex: Concluso ao relator / Aguardando julgamento / Decisão monocrática / Acórdão publicado / Trânsito em julgado",
  "transito_julgado_tst": "Não / Sim - Data: DD/MM/AAAA",
  "sugestao_providencia_tst": "Recomendação estratégica: Ex: Memorial / Acordo / Aguardar / Peticionar urgência",
  "observacoes": "resumo executivo da análise em até 5 linhas"
}`;

    console.log(
      `Analisando TST com Claude para processo ${processo.numero}, ${docsCount} documentos, ${paginasIndexadas?.length || 0} páginas indexadas`
    );

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
          {
            role: "user",
            content: `DADOS DO PROCESSO:\n${processoContext}\n\nDOCUMENTOS DO PROCESSO (analise todos com atenção):\n\n${allDocContent}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Erro na API Claude: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("Resposta vazia do Claude");
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

    // Include all valid fields from the AI response
    const filtered: Record<string, string> = {};
    const validFields = [
      "dossie_tst", "equipe_tst", "relator_tst", "relator_favorabilidade",
      "turma_tst", "turma_favorabilidade", "parte_recorrente_tst",
      "tipo_recurso_reclamante", "materias_recurso_reclamante",
      "aparelhamento_reclamante", "chance_exito_reclamante",
      "tipo_recurso_banco", "materias_recurso_banco", "aparelhamento_banco",
      "chance_exito_banco", "honra_tst", "tema_tst", "execucao_tst",
      "midia_negativa_tst", "decisao_quarteirizado", "recurso_terceiros_tst",
      "status_tst", "transito_julgado_tst", "sugestao_providencia_tst",
    ];

    for (const field of validFields) {
      const val = result[field];
      if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).toLowerCase() !== "null") {
        filtered[field] = String(val);
      }
    }

    console.log(
      `Análise TST Claude concluída: ${Object.keys(filtered).length} campos preenchidos`
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
