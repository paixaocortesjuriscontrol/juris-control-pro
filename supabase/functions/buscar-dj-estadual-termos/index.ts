import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extrairContexto(texto: string, termo: string, raio = 250): string {
  const lower = texto.toLowerCase();
  const t = termo.toLowerCase();
  const idx = lower.indexOf(t);
  if (idx === -1) return "";
  const ini = Math.max(0, idx - raio);
  const fim = Math.min(texto.length, idx + termo.length + raio);
  return (ini > 0 ? "…" : "") + texto.slice(ini, fim) + (fim < texto.length ? "…" : "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const tribunal = body.tribunal as string | undefined;
    const dataInicio = body.dataInicio as string | undefined;
    const dataFim = body.dataFim as string | undefined;
    const caderno = body.caderno as string | undefined;
    const termos = (Array.isArray(body.termos) ? body.termos : [])
      .map((t: unknown) => String(t || "").trim())
      .filter((t: string) => t.length >= 2);

    if (termos.length === 0) {
      return json({ error: "Informe ao menos um termo (mínimo 2 caracteres)" }, 400);
    }

    // 1) busca PDFs no escopo
    let q = supabase
      .from("dj_estaduais_pdfs")
      .select("id, tribunal, data_publicacao, caderno, storage_path, status")
      .eq("status", "processado");
    if (tribunal) q = q.eq("tribunal", tribunal);
    if (caderno) q = q.eq("caderno", caderno);
    if (dataInicio) q = q.gte("data_publicacao", dataInicio);
    if (dataFim) q = q.lte("data_publicacao", dataFim);

    const { data: pdfs, error: pErr } = await q.limit(200);
    if (pErr) return json({ error: pErr.message }, 500);
    if (!pdfs || pdfs.length === 0) {
      return json({ ok: true, total: 0, matches: [], pdfs: 0 });
    }

    const pdfMap = new Map<string, any>(pdfs.map((p: any) => [p.id, p]));
    const pdfIds = pdfs.map((p: any) => p.id);

    // 2) busca conteúdo com ILIKE de cada termo (limitado)
    const matches: any[] = [];
    for (const termo of termos) {
      const { data: rows, error } = await supabase
        .from("dj_estaduais_conteudo")
        .select("pdf_id, pagina, conteudo_texto, processos_detectados")
        .in("pdf_id", pdfIds)
        .ilike("conteudo_texto", `%${termo}%`)
        .limit(500);
      if (error) continue;
      for (const r of rows || []) {
        const pdf = pdfMap.get((r as any).pdf_id);
        if (!pdf) continue;
        matches.push({
          tribunal: pdf.tribunal,
          data_publicacao: pdf.data_publicacao,
          caderno: pdf.caderno,
          pagina: (r as any).pagina,
          termo,
          contexto: extrairContexto((r as any).conteudo_texto, termo),
          processos: (r as any).processos_detectados || [],
          pdf_id: (r as any).pdf_id,
        });
      }
    }

    return json({ ok: true, total: matches.length, pdfs: pdfs.length, matches });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}