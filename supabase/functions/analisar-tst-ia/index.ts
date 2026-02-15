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

    const systemPrompt = `Você é um especialista jurídico sênior brasileiro, com profundo conhecimento em processos trabalhistas no TST (Tribunal Superior do Trabalho) e nas instâncias inferiores (TRTs e Varas do Trabalho).

Sua tarefa é analisar com cuidado todos os documentos fornecidos e extrair informações para preencher os campos de um formulário de acompanhamento TST.

INSTRUÇÕES DETALHADAS PARA CADA CAMPO:

1. **dossie_tst** — Número do dossiê interno da equipe no TST. Procure referências como "Dossiê nº", "Processo Interno", códigos alfanuméricos de controle.

2. **equipe_tst** — Nome da equipe ou escritório responsável pelo acompanhamento no TST. Identifique menções a nomes de equipes, setores ou departamentos.

3. **relator_tst** — Nome completo do Ministro Relator. Procure em decisões, despachos, acórdãos, pautas de julgamento. Formato: "Min. [Nome Completo]".

4. **relator_favorabilidade** — Avaliação da tendência decisória do relator para o tipo de matéria em discussão. Use:
   - "+" se o relator tem histórico favorável ao nosso cliente (banco/reclamado)
   - "-" se tem histórico desfavorável
   - "neutro" se não há elementos suficientes
   Justifique brevemente na análise.

5. **turma_tst** — Identifique a Turma ou órgão colegiado (ex: "1ª Turma", "2ª Turma", "SDI-1", "SDI-2", "SDC", "Tribunal Pleno").

6. **turma_favorabilidade** — Mesma lógica do relator, mas para a composição da turma. Analise se a turma tem jurisprudência predominante favorável ou não.

7. **parte_recorrente_tst** — Quem interpôs o recurso no TST: "Reclamante", "Reclamado", "Ambos", "MPT" (Ministério Público do Trabalho).

8. **tipo_recurso_reclamante** — Tipo específico do recurso do reclamante: "Recurso de Revista", "Agravo de Instrumento em Recurso de Revista (AIRR)", "Agravo Interno", "Recurso Ordinário", "Embargos à SDI", "Recurso Extraordinário" etc.

9. **materias_recurso_reclamante** — Liste TODAS as matérias/temas discutidos no recurso do reclamante, separados por ponto-e-vírgula. Seja específico: "Horas extras - reflexos; Intervalo intrajornada - natureza jurídica; Honorários advocatícios".

10. **aparelhamento_reclamante** — Avalie a qualidade técnica do recurso:
    - "Bem aparelhado" - fundamentação sólida, jurisprudência pertinente, prequestionamento adequado
    - "Razoavelmente aparelhado" - fundamentação parcial
    - "Mal aparelhado" - deficiências técnicas, falta de prequestionamento, jurisprudência impertinente

11. **chance_exito_reclamante** — Probabilidade de provimento do recurso do reclamante:
    - "Alta" (>70%) - jurisprudência pacificada favorável, matéria sumulada
    - "Média" (40-70%) - jurisprudência divergente, matéria controvertida
    - "Baixa" (15-40%) - jurisprudência majoritariamente contrária
    - "Remota" (<15%) - matéria sumulada contra, óbice processual evidente

12-15. **tipo_recurso_banco, materias_recurso_banco, aparelhamento_banco, chance_exito_banco** — Mesmos critérios dos campos 8-11, mas para o recurso do banco/reclamado.

16. **honra_tst** — Identifique se há questão de honra ou ponto sensível para a instituição (ex: assédio moral institucional, discriminação, acidente fatal). Responda "Sim - [descrição breve]" ou "Não".

17. **tema_tst** — Tema(s) principal(is) conforme tabela de temas do TST. Seja preciso e use a nomenclatura oficial quando possível.

18. **execucao_tst** — Fase de execução: "Não iniciada", "Em fase de conhecimento", "Em execução provisória", "Em execução definitiva", "Liquidação de sentença", "Cumprimento de sentença", "Arquivado".

19. **midia_negativa_tst** — Há risco de exposição negativa na mídia? Considere: valor da causa, natureza do pedido (assédio, discriminação, acidente), repercussão social. "Sim - [motivo]", "Não", ou "Baixo risco".

20. **decisao_quarteirizado** — Se há decisão ou parecer de escritório terceirizado/quarteirizado, resuma os pontos principais com detalhamento.

21. **recurso_terceiros_tst** — Há recurso de terceiros interessados? "Sim - MPT", "Sim - Sindicato", "Não", etc.

REGRAS CRÍTICAS:
- Analise TODOS os documentos fornecidos antes de responder
- Quando um campo puder ser preenchido, SEMPRE preencha com o máximo de detalhamento
- Para campos de "matérias", seja exaustivo - liste todas as matérias encontradas
- Para avaliações de favorabilidade e chance de êxito, fundamente com base nos documentos
- Use null APENAS quando realmente não houver informação nos documentos
- Na observação final, indique o nível de confiança geral e quais documentos foram mais relevantes

Responda APENAS em JSON válido:
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
  "observacoes": "resumo detalhado da análise, confiança nos dados e documentos mais relevantes"
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
      if (result[field] && result[field] !== "null" && result[field] !== null) {
        filtered[field] = String(result[field]);
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
