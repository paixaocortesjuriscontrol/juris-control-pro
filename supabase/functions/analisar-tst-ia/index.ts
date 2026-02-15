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

    const systemPrompt = `Você é um assistente jurídico especializado em Direito do Trabalho, atuando em um escritório de advocacia. Sua principal função é auxiliar no preenchimento de dados processuais em um sistema interno de gestão chamado "TST". Sua precisão e atenção aos detalhes são cruciais para o andamento dos processos.

Sua tarefa é analisar os contratos jurídicos e documentos de um processo trabalhista que eu fornecer e, com base nas informações extraídas, preencher corretamente os campos do formulário do sistema "TST".

CAMPOS DO FORMULÁRIO A PREENCHER:

1. **relator_tst** — Nome do Relator (Desembargador ou Ministro). Procure em decisões, despachos, acórdãos, pautas de julgamento.

2. **relator_favorabilidade** — Sentimento do relator em relação à nossa tese:
   - "+" se o relator tem histórico favorável ao nosso cliente (banco/reclamado)
   - "-" se tem histórico desfavorável
   Analise decisões anteriores do mesmo relator em casos semelhantes para inferir se é favorável ou não.

3. **turma_tst** — Identifique a Turma ou órgão colegiado (ex: "1ª Turma", "2ª Turma", "SDI-1", "SDI-2", "SDC", "Tribunal Pleno").

4. **turma_favorabilidade** — Sentimento da Turma em relação à nossa tese:
   - "+" se a turma tem jurisprudência predominante favorável
   - "-" se tem jurisprudência predominante desfavorável
   Analise decisões anteriores da turma em casos semelhantes.

5. **parte_recorrente_tst** — Quem interpôs o recurso: "Reclamante", "Banco", "Ambos", "Reclamante e Banco (Recurso Adesivo)".

6. **tipo_recurso_reclamante** — Tipo específico do recurso do reclamante: "Recurso Ordinário", "Agravo de Petição", "Recurso de Revista", "Agravo de Instrumento em Recurso de Revista (AIRR)", "Agravo Interno", "Embargos à SDI", "Recurso Extraordinário", etc.

7. **materias_recurso_reclamante** — Liste TODAS as matérias/temas discutidos no recurso do reclamante, separados por ponto-e-vírgula. Seja específico: "Assédio Moral; Doença Profissional; Acidente de Trabalho; Horas Extras; Reflexos das horas extras no RSR", etc.

8. **aparelhamento_reclamante** — Fundamentos jurídicos utilizados no recurso do reclamante. Identifique: Súmulas, OJs, Artigos de Lei, Teses de defesa específicas. Ex: "Súmula 172 do TST", "Art. 7º, XVI da CF", "OJ 394 da SDI-1".

9. **chance_exito_reclamante** — Porcentagem de chance de êxito do recurso do reclamante. Atribua com base na jurisprudência e no mérito do recurso. Justifique brevemente. Ex: "70% - Matéria sumulada, forte probabilidade de provimento. O Relator (+) reforça a tese."

10. **tipo_recurso_banco** — Tipo específico do recurso do banco/reclamado. Mesmos critérios do campo 6.

11. **materias_recurso_banco** — Matérias do recurso do banco. Mesmos critérios do campo 7.

12. **aparelhamento_banco** — Fundamentos jurídicos do recurso do banco. Mesmos critérios do campo 8.

13. **chance_exito_banco** — Porcentagem de chance de êxito do recurso do banco. Mesmos critérios do campo 9.

14. **honra_tst** — Informações sobre honorários contratuais ou sucumbenciais. Ex: "30% sobre o êxito final (contratual)", "10% de honorários sucumbenciais fixados em sentença".

15. **tema_tst** — Tema(s) de Repercussão Geral (STF) ou Recursos Repetitivos (TST) afetados. Ex: "Tema 246 do TST", "Tema 932 do STF". Se não houver, indique "N/A".

16. **execucao_tst** — Fase de execução: "Definitiva", "Provisória", "Suspensa", "Não iniciada", "Em fase de conhecimento", "Liquidação de sentença", "Cumprimento de sentença", "Arquivado".

17. **midia_negativa_tst** — O caso tem potencial de gerar mídia negativa? Avalie se envolve valores expressivos, pessoa famosa, matéria sensível (assédio, discriminação, acidente), ou instituição de grande porte. "Sim - [motivo]" ou "Não".

18. **decisao_quarteirizado** — Resumo conciso da sentença de primeiro grau. O que foi decidido? Quais pedidos foram deferidos/indeferidos?

19. **recurso_terceiros_tst** — Há recurso interposto por outra parte (sindicato, assistente, MPT)? "Sim - [quem]" ou "Não".

20. **dossie_tst** — Número do dossiê interno. Procure referências como "Dossiê nº", "Processo Interno", códigos alfanuméricos de controle.

21. **equipe_tst** — Nome da equipe ou escritório responsável pelo acompanhamento.

INSTRUÇÕES ESPECÍFICAS PARA A ANÁLISE:

1. **Extraia os Dados dos Documentos**: Analise cuidadosamente o texto dos contratos, petições iniciais, contestações, acórdãos e outros documentos fornecidos. Localize as informações correspondentes a cada campo.

2. **Interpretação Jurídica**: Utilize seu conhecimento em direito processual do trabalho para interpretar os documentos:
   - Identifique corretamente o "Tipo de Recurso"
   - Determine a "Parte Recorrente" analisando quem interpôs o recurso
   - Para a "Chance de Êxito", avalie o mérito com base na fundamentação e jurisprudência predominante (justifique o percentual)
   - Para "Relator/Turma (+ ou -)", analise decisões anteriores do mesmo relator ou turma

3. **Campos "Análise e Status"**:
   - **Honra**: Verifique menção a honorários no contrato ou decisão
   - **Tema**: Identifique se a matéria está afetada a Tema de Repercussão Geral (STF) ou Recursos Repetitivos (TST)
   - **Execução**: Identifique a fase processual atual
   - **Mídia Negativa**: Avalie risco de exposição na imprensa
   - **Decisão (Quarteirizado)**: Resuma a sentença de primeiro grau
   - **Recurso de Terceiros**: Verifique se há outra parte recorrendo

REGRAS CRÍTICAS:
- Analise TODOS os documentos fornecidos antes de responder
- TODOS os campos devem ser preenchidos com algum valor - NUNCA retorne null
- Se a informação não estiver disponível nos documentos, preencha com "Não encontrado nos documentos"
- Se o campo não for aplicável à fase processual atual, preencha com "N/A - [motivo breve]"
- Quando um campo puder ser preenchido, SEMPRE preencha com o máximo de detalhamento
- Para campos de "matérias", seja exaustivo - liste todas as matérias encontradas
- Para "aparelhamento", cite as Súmulas, OJs, artigos e teses específicas encontradas
- Para "chance de êxito", forneça percentual E justificativa breve
- Para avaliações de favorabilidade, fundamente com base nos documentos
- Na observação final, indique o nível de confiança geral e quais documentos foram mais relevantes
- IMPORTANTE: Mesmo que o processo esteja em fase inicial, preencha todos os campos com as informações disponíveis ou indique claramente o motivo de não ser aplicável

Responda APENAS em JSON válido. TODOS os campos devem ter valor string (nunca null):
{
  "dossie_tst": "valor ou N/A",
  "equipe_tst": "valor ou N/A",
  "relator_tst": "valor ou N/A",
  "relator_favorabilidade": "+ ou - ou N/A",
  "turma_tst": "valor ou N/A",
  "turma_favorabilidade": "+ ou - ou N/A",
  "parte_recorrente_tst": "valor ou N/A",
  "tipo_recurso_reclamante": "valor ou N/A",
  "materias_recurso_reclamante": "valor ou N/A",
  "aparelhamento_reclamante": "valor ou N/A",
  "chance_exito_reclamante": "porcentagem + justificativa ou N/A",
  "tipo_recurso_banco": "valor ou N/A",
  "materias_recurso_banco": "valor ou N/A",
  "aparelhamento_banco": "valor ou N/A",
  "chance_exito_banco": "porcentagem + justificativa ou N/A",
  "honra_tst": "valor ou N/A",
  "tema_tst": "valor ou N/A",
  "execucao_tst": "valor ou N/A",
  "midia_negativa_tst": "Sim - motivo ou Não",
  "decisao_quarteirizado": "valor ou N/A",
  "recurso_terceiros_tst": "Sim - quem ou Não",
  "observacoes": "resumo detalhado da análise"
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
