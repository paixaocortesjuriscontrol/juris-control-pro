import { createClient } from "npm:@supabase/supabase-js@2";
const TOKEN = "8da8b175380fce6d8577317aa5ff8c87";
const COORD = "b0f690ad-68da-43d7-af5f-9adafeab3fd5";
Deno.serve(async (req) => {
  if (req.headers.get("x-tmp-token") !== TOKEN) return new Response("no", { status: 401 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const rows: any[] = await req.json();
  const digits = [...new Set(rows.map((r) => String(r.processo_numero).replace(/\D/g, "")))];
  const { data: ex } = await sb.from("pautas_tst").select("id,processo_digits,data_julgamento,aba_origem").in("processo_digits", digits);
  const { data: db } = await sb.from("dados_benner").select("id,processo,dossie").or(digits.map((d) => `processo.ilike.%${d.slice(0,7)}%`).join(",")).not("aba_origem","is",null);
  const { data: procs } = await sb.from("processos").select("id,numero").in("numero", rows.map((r) => r.processo_numero));
  let ins = 0, upd = 0, errs: string[] = [];
  for (const r of rows) {
    const d = String(r.processo_numero).replace(/\D/g, "");
    const m = (ex || []).find((e: any) => e.processo_digits === d && (r.data_julgamento ? e.data_julgamento === r.data_julgamento : (e.data_julgamento == null && e.aba_origem === r.aba_origem)));
    const b = (db || []).find((x: any) => (r.dossie && x.dossie === r.dossie) || String(x.processo).replace(/\D/g, "") === d);
    const p = (procs || []).find((x: any) => x.numero === r.processo_numero);
    const row = { ...r, coordenacao_id: COORD, dados_benner_id: b?.id ?? null, processo_id: p?.id ?? null };
    const q = m ? sb.from("pautas_tst").update(row).eq("id", m.id) : sb.from("pautas_tst").insert(row);
    const { error } = await q;
    if (error) errs.push(d + ": " + error.message); else m ? upd++ : ins++;
  }
  return Response.json({ ins, upd, errs });
});
