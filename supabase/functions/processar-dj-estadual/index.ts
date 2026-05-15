import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROCESSO_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

function splitIntoPages(content: string): { page: number; text: string }[] {
  const pages: { page: number; text: string }[] = [];
  // Tenta marcadores explícitos primeiro
  const m = content.split(/(?:^|\n)---\s*P[áa]gina\s*\d+\s*---(?:\n|$)/i);
  if (m.length > 1) {
    m.forEach((t, i) => {
      if (t.trim()) pages.push({ page: i + 1, text: t.trim() });
    });
    return pages;
  }
  const charsPerPage = 3000;
  let cur = "";
  let page = 1;
  for (const line of content.split("\n")) {
    if (cur.length + line.length > charsPerPage && cur.length > 0) {
      pages.push({ page, text: cur.trim() });
      page++;
      cur = line;
    } else {
      cur += (cur ? "\n" : "") + line;
    }
  }
  if (cur.trim()) pages.push({ page, text: cur.trim() });
  return pages;
}

async function extractWithJina(pdfUrl: string) {
  const JINA = Deno.env.get("JINA_API_KEY");
  if (!JINA) throw new Error("JINA_API_KEY não configurada");

  const r = await fetch(`https://r.jina.ai/${encodeURIComponent(pdfUrl)}`, {
    headers: {
      Authorization: `Bearer ${JINA}`,
      Accept: "application/json",
      "X-Return-Format": "markdown",
    },
  });
  if (!r.ok) throw new Error(`Jina HTTP ${r.status}`);
  const j = await r.json();
  const content: string = j.content || j.data?.content || "";
  if (!content) throw new Error("Jina retornou conteúdo vazio");
  return splitIntoPages(content);
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
    const pdf_id = body.pdf_id as string | undefined;
    const limit = Number(body.limit ?? 3);

    let alvos: any[] = [];
    if (pdf_id) {
      const { data, error } = await supabase
        .from("dj_estaduais_pdfs")
        .select("*")
        .eq("id", pdf_id)
        .maybeSingle();
      if (error || !data) return json({ error: "PDF não encontrado" }, 404);
      alvos = [data];
    } else {
      const { data } = await supabase
        .from("dj_estaduais_pdfs")
        .select("*")
        .eq("status", "baixado")
        .order("created_at", { ascending: true })
        .limit(limit);
      alvos = data || [];
    }

    if (alvos.length === 0) return json({ ok: true, processados: 0 });

    const resultados: any[] = [];
    for (const pdf of alvos) {
      try {
        await supabase
          .from("dj_estaduais_pdfs")
          .update({ status: "processando", erro_mensagem: null })
          .eq("id", pdf.id);

        const { data: signed, error: sErr } = await supabase.storage
          .from("dj-estaduais-pdfs")
          .createSignedUrl(pdf.storage_path, 600);
        if (sErr || !signed?.signedUrl) {
          throw new Error(`signed url: ${sErr?.message || "vazia"}`);
        }

        const paginas = await extractWithJina(signed.signedUrl);

        // limpa conteúdo anterior
        await supabase
          .from("dj_estaduais_conteudo")
          .delete()
          .eq("pdf_id", pdf.id);

        // insere em lotes
        const rows = paginas.map((p) => ({
          pdf_id: pdf.id,
          pagina: p.page,
          conteudo_texto: p.text,
          processos_detectados: Array.from(
            new Set(p.text.match(PROCESSO_REGEX) || []),
          ),
        }));
        for (let i = 0; i < rows.length; i += 100) {
          const slice = rows.slice(i, i + 100);
          const { error: iErr } = await supabase
            .from("dj_estaduais_conteudo")
            .insert(slice);
          if (iErr) throw new Error(`insert: ${iErr.message}`);
        }

        await supabase
          .from("dj_estaduais_pdfs")
          .update({
            status: "processado",
            total_paginas: paginas.length,
            processado_em: new Date().toISOString(),
          })
          .eq("id", pdf.id);

        resultados.push({ id: pdf.id, ok: true, paginas: paginas.length });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase
          .from("dj_estaduais_pdfs")
          .update({ status: "erro", erro_mensagem: msg.slice(0, 1000) })
          .eq("id", pdf.id);
        resultados.push({ id: pdf.id, ok: false, erro: msg });
      }
    }

    return json({ ok: true, processados: resultados.length, resultados });
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