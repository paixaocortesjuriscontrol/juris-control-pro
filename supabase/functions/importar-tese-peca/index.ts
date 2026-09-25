import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIPOS = ["contestacao", "recurso_ordinario", "contrarrazoes", "peticao_inicial", "memoriais", "outros"];

function anonimizar(t: string): string {
  return t
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "[CPF]")
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, "[CNPJ]")
    .replace(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/g, "[NÚMERO DO PROCESSO]");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const texto = String(body?.texto ?? "");
    const nomeArquivo = String(body?.nomeArquivo ?? "").slice(0, 300);
    const area = String(body?.area ?? "trabalhista");
    const coordenacaoId = body?.coordenacaoId || null;
    if (texto.trim().length < 300) return json({ error: "Arquivo sem texto suficiente (talvez seja escaneado)." }, 400);

    const trecho = texto.slice(0, 80000);
    const ai = await geminiChatCompletionsFetch({
      model: "gemini-flash-latest",
      messages: [
        {
          role: "system",
          content: `Você é um advogado sênior que cataloga peças processuais num banco de teses.
Leia a peça e responda APENAS um JSON com as chaves:
titulo (curto, descreve a tese central), tipo_peca (um de: ${TIPOS.join(", ")}), materia, assunto_cnj, tipo_recurso (ou null),
tags (array de 3 a 10 palavras-chave), fundamentos (texto organizado com os argumentos jurídicos, artigos de lei, súmulas, OJs e julgados citados, em tópicos),
peca_modelo (o texto integral da peça ANONIMIZADO: troque nomes de pessoas por [RECLAMANTE], [RECLAMADA], [ADVOGADO], [TESTEMUNHA]; remova CPF, RG, endereços e números de processo).`,
        },
        { role: "user", content: `Arquivo: ${nomeArquivo}\n\n${trecho}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      _ai_usage: { edgeFunction: "importar-tese-peca", authHeader, origem: "importar-tese-peca", metadata: { arquivo: nomeArquivo } },
    });
    if (!ai.ok) {
      const e = await ai.json().catch(() => ({}));
      return json({ error: e?.error?.message || `IA retornou status ${ai.status}` }, ai.status === 429 ? 429 : 502);
    }
    const aiData = await ai.json();
    let raw = String(aiData?.choices?.[0]?.message?.content ?? "").trim().replace(/^```(json)?/i, "").replace(/```$/, "");
    let r: any;
    try { r = JSON.parse(raw); } catch { return json({ error: "IA não devolveu dados legíveis" }, 502); }

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.from("teses_juridicas").insert({
      coordenacao_id: coordenacaoId,
      titulo: String(r.titulo || nomeArquivo || "Tese importada").slice(0, 300),
      tipo_peca: TIPOS.includes(r.tipo_peca) ? r.tipo_peca : "outros",
      area,
      materia: r.materia ?? null,
      assunto_cnj: r.assunto_cnj ?? null,
      tipo_recurso: r.tipo_recurso ?? null,
      tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 15) : [],
      fundamentos: anonimizar(String(r.fundamentos ?? "")),
      peca_modelo: anonimizar(String(r.peca_modelo || trecho)),
      origem_arquivo: nomeArquivo,
      ativo: false,
      criado_por: u.user.id,
    }).select("id, titulo, tipo_peca").single();
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, tese: data });
  } catch (e: any) {
    return json({ error: e?.message || "Erro ao importar peça" }, 500);
  }
});
