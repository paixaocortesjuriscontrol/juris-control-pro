import { createClient } from "npm:@supabase/supabase-js@2";

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

const SYSTEM_PROMPT = `Você é um analista jurídico que lê PEÇAS PROCESSUAIS (petições, decisões,
despachos, certidões, sentenças, acórdãos, contestações) e devolve dados estruturados para
preencher o FORMULÁRIO DE PROCESSO (cadastro do processo no escritório).

REGRA DE OURO
• NUNCA invente. Se a informação não está EXPLÍCITA no documento, OMITA o campo do retorno.
• Não tente preencher campos da Distribuição TST nem de Dados Benner — esta extração é
  exclusivamente para o cadastro/visão geral do PROCESSO.
• A saída deve conter SOMENTE colunas do cadastro do processo, dentro da chave "processo".

CAMPOS PERMITIDOS (sempre OMITA quando não houver evidência clara):
  • tipo_processo: "judicial" quando houver tribunal/órgão/vara judicial explícitos; "administrativo" só se o documento disser processo administrativo.
  • assunto: assunto principal do processo (string curta).
  • classe: classe processual literal (ex: "Reclamação Trabalhista", "Ação Civil Pública").
  • area: área jurídica literal/derivada do tribunal (ex: "Trabalhista", "Cível").
  • sistema: sistema processual quando explícito (PJe, eSAJ, eProc, Projudi etc.).
  • materia: matéria/área temática (string curta).
  • natureza: natureza da ação (string curta).
  • pedidos: lista textual de pedidos, separada por ";" — extrair da petição inicial / razões de recurso.
  • polo_ativo / polo_passivo: nomes literais separados por " / ".
  • terceiro_envolvido: nomes literais separados por " / ".
  • reclamante / reclamados: idem polos (use o mesmo conteúdo quando aplicável).
  • tribunal: sigla do tribunal (ex: "TST", "TRT-2", "TJSP").
  • justica: "trabalhista" | "comum" | "federal" | "eleitoral" | "militar".
  • esfera: "federal" | "estadual" | "municipal".
  • instancia: "1" | "2" | "superior" | "tribunal_superior".
  • orgao_julgador / vara / comarca / uf.
  • data_distribuicao / data_citacao / data_recebimento: formato AAAA-MM-DD.
  • valor_causa: número decimal (sem R$).
  • valor_condenacao: número decimal, só se houver condenação líquida no documento.
  • valor_provisionado: número decimal, só se o documento trouxer provisão/contingência literal.
  • ativo_passivo / responsabilidade_tipo / risco_atual / probabilidade / risco: só se estiverem expressos literalmente.
  • fase: descrição curta da fase atual (≤120 chars).
  • status: "ativo" | "suspenso" | "arquivado_definitivamente" | "encerrado".
  • descricao: resumo do processo em até 3 frases factuais (sem juízo de valor).
  • observacoes_processo: observação factual adicional (até 400 chars).
  • andamento_atual: último andamento relevante (até 200 chars).
  • funcao: função/cargo do reclamante quando explícita.
  • advogado_externo: nome do advogado externo quando explícito.
  • periodo_laborado: período laborado quando explícito (ex: "01/2018 a 06/2022").
  • cpf_cnpj_parte_contraria: documento literal.

EVIDÊNCIA
Em "_evidencias" cite o trecho literal (≤200 chars) que sustenta cada campo extraído.

CONFIANÇA
Em "_confianca" classifique cada campo: "alta" | "media" | "baixa".

ALERTAS
Em "_alertas" reporte conflitos entre documentos ou OCR ruim.

SAÍDA
Devolva JSON puro no formato:
{"processo": {...}, "_evidencias": {...}, "_confianca": {...}, "_alertas": []}
Campos sem evidência: OMITA do JSON.`;

async function openAIJson(body: any): Promise<Response> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: { message: "OPENAI_API_KEY não configurada" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    return await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: { message: `Falha de rede OpenAI: ${e?.message || e}` } }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const ALLOWED_PROCESSO_FIELDS = new Set([
  "assunto", "tipo_processo", "classe", "natureza", "area", "fase", "status",
  "tribunal", "justica", "instancia", "esfera", "sistema", "orgao_julgador", "vara", "comarca", "uf", "materia",
  "polo_ativo", "polo_passivo", "terceiro_envolvido", "reclamante", "reclamados", "pedidos",
  "data_distribuicao", "data_recebimento", "data_citacao",
  "valor_causa", "valor_condenacao", "valor_provisionado",
  "ativo_passivo", "responsabilidade_tipo", "risco_atual", "probabilidade", "risco",
  "funcao", "advogado_externo", "descricao", "observacoes_processo", "andamento_atual",
  "periodo_laborado", "cpf_cnpj_parte_contraria",
]);

function normalizarInstancia(value: any) {
  const s = String(value || "").trim();
  if (!s) return s;
  if (/^1\b|primeira|1ª/i.test(s)) return "1ª Instância";
  if (/^2\b|segunda|2ª/i.test(s)) return "2ª Instância";
  if (/tribunal[_\s-]*superior|superior/i.test(s)) return "TST";
  return s;
}

function normalizarProcessoOut(input: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!ALLOWED_PROCESSO_FIELDS.has(k)) continue;
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) continue;
    out[k] = k === "instancia" ? normalizarInstancia(v) : v;
  }
  if ((out.tribunal || out.orgao_julgador || out.vara) && !out.tipo_processo) {
    out.tipo_processo = "judicial";
  }
  return out;
}

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

    if (!Deno.env.get("OPENAI_API_KEY")) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

    const body = await req.json();
    const processoId: string | null = body?.processo_id || null;
    const processoNumero: string = String(body?.processo_numero || "").trim();
    const documentoIds: string[] = Array.isArray(body?.documento_ids) ? body.documento_ids : [];

    if (!processoId && !processoNumero) {
      return json({ error: "processo_id ou processo_numero é obrigatório" }, 400);
    }

    let pid = processoId;
    if (!pid) {
      const { data: proc } = await supabase
        .from("processos")
        .select("id")
        .eq("numero", processoNumero)
        .maybeSingle();
      pid = proc?.id || null;
    }
    if (!pid) return json({ error: "Processo não encontrado" }, 404);

    let q = supabase
      .from("documentos_texto_indexado")
      .select("documento_id, pagina, conteudo_texto")
      .eq("processo_id", pid)
      .order("documento_id")
      .order("pagina")
      .limit(800);
    if (documentoIds.length > 0) q = q.in("documento_id", documentoIds);
    const { data: paginas, error: pagErr } = await q;
    if (pagErr) return json({ error: "Erro ao carregar texto: " + pagErr.message }, 500);
    if (!paginas || paginas.length === 0) {
      return json({ error: "Nenhum texto indexado para os anexos selecionados." }, 400);
    }

    const docIds = [...new Set(paginas.map((p: any) => p.documento_id))];
    const { data: docs } = await supabase
      .from("documentos")
      .select("id, nome")
      .in("id", docIds);
    const docNames: Record<string, string> = Object.fromEntries(
      (docs || []).map((d: any) => [d.id, d.nome])
    );

    const grouped: Record<string, string[]> = {};
    for (const p of paginas as any[]) {
      (grouped[p.documento_id] ||= []).push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
    }
    const maxChars = 90000;
    const parts: string[] = [];
    let totalChars = 0;
    for (const [docId, pages] of Object.entries(grouped)) {
      const block = `=== ${docNames[docId] || "Documento"} ===\n${pages.join("\n")}`;
      if (totalChars + block.length > maxChars) {
        parts.push(block.substring(0, Math.max(0, maxChars - totalChars)) + "\n[...truncado]");
        break;
      }
      parts.push(block);
      totalChars += block.length;
    }
    const fullText = parts.join("\n\n");

    const aiRes = await openAIJson({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Processo: ${processoNumero}`,
            `\nTrechos das peças (ordenados por documento):\n\n${fullText}`,
            `\nDevolva SOMENTE JSON válido com campos do cadastro do processo que tenham evidência citável em "_evidencias".`,
          ].join("\n"),
        },
      ],
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `OpenAI ${aiRes.status}: ${t.substring(0, 300)}` }, 500);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    if (!content) return json({ error: "IA não retornou JSON" }, 500);
    let parsed: any;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      return json({ error: "Falha ao parsear resposta da IA" }, 500);
    }

    const processoOut = normalizarProcessoOut(parsed?.processo || {});

    return json({
      processo_id: pid,
      processo: processoOut,
      alertas: Array.isArray(parsed?._alertas) ? parsed._alertas : [],
      evidencias: parsed?._evidencias || {},
      confianca: parsed?._confianca || {},
    });
  } catch (e: any) {
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});