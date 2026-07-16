import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você é um advogado trabalhista sênior do escritório que defende o Banco
Santander (Brasil) S.A. em ações trabalhistas no TST. Sua tarefa: ler os
documentos do processo e produzir uma sugestão de "Análise do Quarteirizado"
para o controle interno do escritório.

A análise será inserida no campo G da planilha de carga e é INSUMO PARA
REVISÃO HUMANA do advogado responsável. Seja factual, conciso e direto.
Não opine sobre estratégia. Não invente dados.

═══════════════════════════════════════════════════════════════
CONTEXTO JURÍDICO
═══════════════════════════════════════════════════════════════
"Quarteirização" = cadeia de prestação onde o trabalhador é empregado de
empresa A, que presta serviços para empresa B (terceirizada/intermediária),
que por sua vez presta para o tomador final (Santander).

Marcos relevantes (não citar literalmente no texto, mas usar como base):
- Súmula 331 do TST (responsabilidade subsidiária do tomador, culpa in
  vigilando/eligendo)
- Tema 725 do STF / RE 958.252 (licitude da terceirização em qualquer
  atividade — distinção entre atividade-fim e atividade-meio não é mais
  determinante para LICITUDE, mas ainda relevante para análise de subordinação
  e pedido de vínculo direto)
- Tema 246 do STF (vedação de responsabilidade subsidiária automática da
  Administração Pública — não se aplica ao Santander, que é empresa privada)
- Lei 6.019/74 (com redação das Leis 13.429/2017 e 13.467/2017)
- IN 41/2018 do TST (direito intertemporal)

═══════════════════════════════════════════════════════════════
TAREFA
═══════════════════════════════════════════════════════════════
A partir dos documentos fornecidos, identifique:

1. CADEIA DE PRESTAÇÃO — trabalhador, empregador formal, intermediários, papel do Santander.
2. ATIVIDADE EXERCIDA — função; classifique como atividade-fim bancária, atividade-meio típica ou caso fronteiriço.
3. PLEITO CONTRA O SANTANDER — vínculo direto / subsidiária / solidária / grupo econômico / equiparação a bancário.
4. DECISÃO DO TRT — sentido (condenou/absolveu/reformou) e fundamento principal.
5. TESE DO SANTANDER NO RR — principais argumentos do recurso (se houver).
6. PONTOS DE RISCO — subordinação direta, pessoalidade, solvência da empregadora, equiparação a bancário, cadeia 3+ níveis, precedente desfavorável da turma.

═══════════════════════════════════════════════════════════════
SAÍDA
═══════════════════════════════════════════════════════════════
Devolva EXCLUSIVAMENTE via tool call "analise_quarteirizado". Sem markdown, sem texto extra.

Campo principal G_analise_quarteirizado: 3 a 6 linhas, prosa corrida.
- Comece pela cadeia: nome do reclamante, empregadora, intermediárias, papel do Santander.
- Em seguida: atividade exercida e classificação.
- Depois: o que o TRT decidiu e sob qual fundamento.
- Por fim: tese do Santander no recurso (se houver) e principais riscos.
- Use SIGLAS quando o documento usar (RR, AIRR, TRT-2, SDI-1).
- Use o nome do reclamante e das empresas como aparecem nos autos.
- NÃO use linguagem promocional. NÃO recomende estratégia. NÃO conclua sobre chance de êxito.

CONFIANÇA
- "alta": acórdão TRT íntegro + RR do Santander disponíveis, fatos claros
- "media": apenas um dos dois disponíveis, ou documentos parciais
- "baixa": só ementa, OCR ruim, contradições — ainda assim gere o texto e sinalize em _observacoes_para_revisor.

SE NÃO HOUVER SUBSTRATO (apenas certidões/intimações), devolva G_analise_quarteirizado vazio
e _observacoes_para_revisor = "Sem documento substantivo disponível (acórdão/recurso). Sugestão não gerada."`;

const SUBSTANTIVE_REGEX = /(ac[oó]rd[aã]o|recurso\s+de\s+revista|\brr\b|senten[cç]a|contesta[cç][aã]o|decis[aã]o\s+monocr[aá]tica|airr|embargos)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    if (!(Deno.env.get("GEMINI_API_KEY_DJEN") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY"))) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

    const body = await req.json();
    const processoId: string | null = body?.processo_id || null;
    const processoNumero: string = String(body?.processo_numero || "").trim();
    const documentoIds: string[] = Array.isArray(body?.documento_ids) ? body.documento_ids : [];

    let pid = processoId;
    if (!pid && processoNumero) {
      const { data: proc } = await supabase
        .from("processos").select("id").eq("numero", processoNumero).maybeSingle();
      pid = proc?.id || null;
    }
    if (!pid) return json({ error: "Processo não encontrado" }, 404);

    // Carrega documentos e filtra apenas peças substantivas pelo nome
    let docsQ = supabase.from("documentos").select("id, nome").eq("processo_id", pid);
    if (documentoIds.length > 0) docsQ = docsQ.in("id", documentoIds);
    const { data: docs } = await docsQ;
    const substantivos = (docs || []).filter((d: any) => SUBSTANTIVE_REGEX.test(d.nome || ""));

    if (substantivos.length === 0) {
      return json({
        analise_quarteirizado: null,
        skipped: true,
        motivo: "Sem documento substantivo (acórdão/RR/sentença/contestação) entre os anexos.",
      });
    }

    const subIds = substantivos.map((d: any) => d.id);
    const { data: paginas, error: pagErr } = await supabase
      .from("documentos_texto_indexado")
      .select("documento_id, pagina, conteudo_texto")
      .in("documento_id", subIds)
      .order("documento_id").order("pagina").limit(800);
    if (pagErr) return json({ error: "Erro ao carregar texto: " + pagErr.message }, 500);
    if (!paginas || paginas.length === 0) {
      return json({ analise_quarteirizado: null, skipped: true, motivo: "Sem texto indexado nos documentos substantivos." });
    }

    const docNames: Record<string, string> = Object.fromEntries(substantivos.map((d: any) => [d.id, d.nome]));
    const grouped: Record<string, string[]> = {};
    for (const p of paginas as any[]) {
      (grouped[p.documento_id] ||= []).push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
    }
    const maxChars = 90000;
    const parts: string[] = [];
    let total = 0;
    let idx = 0;
    const docIndexMap: Array<{ idx: number; documento_id: string; nome: string }> = [];
    for (const [docId, pages] of Object.entries(grouped)) {
      docIndexMap.push({ idx, documento_id: docId, nome: docNames[docId] || "Documento" });
      const block = `=== [${idx}] ${docNames[docId] || "Documento"} ===\n${pages.join("\n")}`;
      if (total + block.length > maxChars) {
        parts.push(block.substring(0, Math.max(0, maxChars - total)) + "\n[...truncado]");
        break;
      }
      parts.push(block);
      total += block.length;
      idx++;
    }
    const fullText = parts.join("\n\n");

    const tool = {
      type: "function",
      function: {
        name: "analise_quarteirizado",
        description: "Sugestão de análise do quarteirizado (campo G).",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            G_analise_quarteirizado: { type: "string", description: "3 a 6 linhas em prosa corrida. Vazio se não houver substrato." },
            _estrutura: {
              type: "object",
              additionalProperties: false,
              properties: {
                ha_quarteirizacao: { type: "string", enum: ["S", "N", "Indefinido"] },
                cadeia: { type: "string" },
                atividade: { type: "string" },
                natureza_atividade: { type: "string", enum: ["fim_bancaria", "meio_tipica", "fronteirica", "indefinido"] },
                pleito_contra_santander: { type: "string" },
                decisao_trt: { type: "string" },
                tese_santander_rr: { type: "string" },
                pontos_risco: { type: "array", items: { type: "string" } },
                empregadora_status_economico: { type: "string", enum: ["solvente", "recuperacao_judicial", "falencia", "desconhecido"] },
              },
            },
            _documentos_usados: { type: "array", items: { type: "integer" } },
            _confianca: { type: "string", enum: ["alta", "media", "baixa"] },
            _observacoes_para_revisor: { type: "string" },
          },
          required: ["G_analise_quarteirizado"],
        },
      },
    };

    const aiRes = await geminiChatCompletionsFetch({
        _ai_usage: { edgeFunction: "analise-quarteirizado-ia", authHeader: req.headers.get("authorization"), referer: req.headers.get("referer") }, model: "gemini-2.5-flash",
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Processo: ${processoNumero}`,
              `\nDocumentos disponíveis (substantivos): ${docIndexMap.map((d) => `[${d.idx}] ${d.nome}`).join(" | ")}`,
              `\nTrechos:\n\n${fullText}`,
              `\nUse a função analise_quarteirizado para devolver a sugestão.`,
            ].join("\n"),
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "analise_quarteirizado" } },
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `Gemini ${aiRes.status}: ${t.substring(0, 300)}` }, 500);
    }
    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return json({ error: "IA não retornou tool call" }, 500);
    let parsed: any = {};
    try { parsed = JSON.parse(toolCall.function.arguments); } catch { return json({ error: "Falha ao parsear" }, 500); }

    const texto = (parsed?.G_analise_quarteirizado || "").toString().trim();
    // Validação leve
    const valido = texto.length >= 150 && /SANTANDER/i.test(parsed?._estrutura?.cadeia || texto);
    return json({
      analise_quarteirizado: texto || null,
      estrutura: parsed?._estrutura || null,
      confianca: parsed?._confianca || null,
      observacoes_revisor: parsed?._observacoes_para_revisor || null,
      documentos_usados: parsed?._documentos_usados || [],
      docs_index: docIndexMap,
      validado_local: valido,
      tokens: aiJson?.usage || null,
    });
  } catch (e: any) {
    console.error("analise-quarteirizado-ia erro:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});