/**
 * Sondagem temporária: descobre quais padrões de URL do DEJT respondem com PDF
 * para uma data específica (edição datada) por tribunal.
 * Usada apenas para diagnóstico do motor DJEN Pautas Servidor.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function candidatos(tribunal: string, iso: string): string[] {
  const [y, m, d] = iso.split("-");
  const id = tribunal === "TST" ? "TST" : (tribunal.match(/^TRT(\d{1,2})$/)?.[1] ?? "").padStart(2, "0");
  if (!id) return [];
  const ddmmyyyy = `${d}/${m}/${y}`;
  return [
    `https://diario.jt.jus.br/cadernos/${y}/${m}/${d}/Diario_J_${id}.pdf`,
    `https://diario.jt.jus.br/cadernos/Diario_J_${id}_${y}${m}${d}.pdf`,
    `https://diario.jt.jus.br/cadernos/Diario_J_${id}_${d}${m}${y}.pdf`,
    `https://diario.jt.jus.br/cadernos/${y}${m}${d}/Diario_J_${id}.pdf`,
    `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=${tribunal}&data=${encodeURIComponent(ddmmyyyy)}&caderno=judiciario`,
    `https://diario.jt.jus.br/cadernos/Diario_J_${id}.pdf`,
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const tribunais: string[] = Array.isArray(body?.tribunais) && body.tribunais.length
    ? body.tribunais
    : ["TST", "TRT2", "TRT3"];
  const datas: string[] = Array.isArray(body?.datas) && body.datas.length
    ? body.datas
    : [new Date().toISOString().slice(0, 10)];

  const out: Array<Record<string, unknown>> = [];
  for (const t of tribunais) {
    for (const iso of datas) {
      for (const url of candidatos(t, iso)) {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "application/pdf,*/*",
              "Referer": "https://dejt.jt.jus.br/",
            },
          });
          const ctype = res.headers.get("content-type") || "";
          let magic = "";
          let bytes = 0;
          if (res.ok) {
            const buf = new Uint8Array(await res.arrayBuffer());
            bytes = buf.length;
            magic = new TextDecoder().decode(buf.slice(0, 4));
          } else {
            await res.body?.cancel();
          }
          out.push({
            tribunal: t,
            data: iso,
            url,
            status: res.status,
            ctype,
            bytes,
            pdf: magic === "%PDF",
            lastModified: res.headers.get("last-modified"),
          });
        } catch (e) {
          out.push({ tribunal: t, data: iso, url, erro: String((e as Error)?.message || e) });
        }
      }
    }
  }
  void pad;
  return new Response(JSON.stringify({ out }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
