// Função TEMPORÁRIA: importação da planilha "MEUS PRAZOS - EMILLY" (Coordenação GOL).
// Remover após a importação.
import { createClient } from "npm:@supabase/supabase-js@2";
import data from "./data.json" with { type: "json" };

const TOKEN = "gol-emilly-7f3c9a21b8e4";
const COORD = "f5a0ac48-7461-49c1-9151-219e570831bd";
const EMILLY = "d27dafc3-6756-461e-a930-224d00ef0e41";
const MARCA = "Importado da planilha MEUS PRAZOS - EMILLY (29/09/2026)";
const dig = (s: string) => String(s || "").replace(/\D/g, "");
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.headers.get("x-import-token") !== TOKEN) return json({ error: "forbidden" }, 403);
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const d: any = data;

  // Mapa número(dígitos) -> id
  const nums = Object.keys(d.procs);
  const mapa = new Map<string, string>();
  const carregar = async () => {
    for (let i = 0; i < nums.length; i += 50) {
      const lote = nums.slice(i, i + 50);
      const { data: rows } = await sb.from("processos").select("id, numero, coordenacao_id").in("numero", lote);
      for (const r of rows || []) {
        const k = dig(r.numero);
        if (!mapa.has(k) || r.coordenacao_id === COORD) mapa.set(k, r.id);
      }
    }
  };

  if (body.mode === "import") {
    await carregar();
    const novos = nums.filter((n) => !mapa.has(dig(n))).map((n) => ({
      numero: n, polo_ativo: d.procs[n].recl, polo_passivo: d.procs[n].cli, uf: d.procs[n].uf,
      classe: d.procs[n].classe, area: "trabalhista", status: "ativo", coordenacao_id: COORD, descricao: MARCA,
    }));
    const erros: string[] = [];
    for (let i = 0; i < novos.length; i += 50) {
      const { error } = await sb.from("processos").insert(novos.slice(i, i + 50));
      if (error) erros.push("proc:" + error.message);
    }
    await carregar();

    const { data: jaT } = await sb.from("tarefas").select("id").in("id", d.items.map((x: any) => x.id));
    const { data: jaA } = await sb.from("audiencias_detectadas").select("id").in("id", d.items.map((x: any) => x.id));
    const ja = new Set([...(jaT || []), ...(jaA || [])].map((r: any) => r.id));
    const pend = d.items.filter((x: any) => !ja.has(x.id));
    const prazos = pend.filter((x: any) => !x.aud);
    const auds = pend.filter((x: any) => x.aud);

    const tRows = prazos.map((x: any) => ({
      id: x.id, processo_id: mapa.get(dig(x.n)) || null, titulo: x.prov.slice(0, 250), descricao: x.desc,
      data_vencimento: x.fatal, data_fatal: x.fatal, tipo_tarefa: "PRAZO", tipo_registro: "tarefa",
      status: "pendente", prioridade: "media", responsavel_id: x.resp[0], coordenacao_id: COORD,
      origem: "planilha", criado_por: EMILLY,
    }));
    for (let i = 0; i < tRows.length; i += 50) {
      const { error } = await sb.from("tarefas").insert(tRows.slice(i, i + 50));
      if (error) erros.push("tarefa:" + error.message);
    }
    const tr = prazos.flatMap((x: any) => x.resp.map((u: string) => ({ tarefa_id: x.id, usuario_id: u })));
    for (let i = 0; i < tr.length; i += 100) {
      const { error } = await sb.from("tarefa_responsaveis").insert(tr.slice(i, i + 100));
      if (error) erros.push("resp:" + error.message);
    }

    const aRows = auds.map((x: any) => {
      const h = x.hora || "12:00";
      return {
        id: x.id, processo_id: mapa.get(dig(x.n)) || null, processo_numero: x.n, titulo: x.prov.slice(0, 250),
        data_audiencia: `${x.fatal}T${h}:00-03:00`, hora: x.hora, hora_brasilia: x.hora, tipo_audiencia: x.tipo,
        observacoes: x.desc, polo_ativo: x.recl, cliente: x.cli, status: "pendente", origem: "planilha",
        coordenacao_id: COORD, criado_por: EMILLY,
      };
    });
    for (let i = 0; i < aRows.length; i += 50) {
      const { error } = await sb.from("audiencias_detectadas").insert(aRows.slice(i, i + 50));
      if (error) erros.push("aud:" + error.message);
    }
    const aa = auds.flatMap((x: any) => x.resp.map((u: string) => ({ audiencia_id: x.id, advogado_id: u })));
    for (let i = 0; i < aa.length; i += 100) {
      const { error } = await sb.from("audiencias_advogados").insert(aa.slice(i, i + 100));
      if (error) erros.push("audadv:" + error.message);
    }
    return json({ processos_novos: novos.length, processos_total: mapa.size, prazos: tRows.length, audiencias: aRows.length, erros });
  }

  if (body.mode === "judit") {
    // Processa até `limit` processos importados ainda sem consulta Judit
    const limit = Math.min(Number(body.limit) || 8, 15);
    const { data: alvo } = await sb.from("processos").select("id, numero")
      .eq("coordenacao_id", COORD).eq("descricao", MARCA).is("ultima_consulta_judit", null).limit(limit);
    const res: any[] = [];
    await Promise.all((alvo || []).map(async (p: any) => {
      try {
        const r = await fetch(`${url}/functions/v1/busca-judit-processos-e-casos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
          body: JSON.stringify({ numero_processo: p.numero }),
        });
        const j: any = await r.json().catch(() => ({}));
        const upd: Record<string, unknown> = { ultima_consulta_judit: new Date().toISOString() };
        if (j && !j.error) {
          for (const k of ["tribunal", "vara", "comarca", "assunto", "materia", "orgao_julgador", "instancia", "justica", "fase", "data_distribuicao", "valor_causa", "reclamante", "reclamados"]) {
            if (j[k] != null && j[k] !== "") upd[k] = j[k];
          }
          if (j.polo_ativo) upd.polo_ativo = j.polo_ativo;
          if (j.polo_passivo) upd.polo_passivo = j.polo_passivo;
          const { _judit_raw, ...semRaw } = j;
          await sb.from("consultas_judit").insert({ processo_id: p.id, requisitada_em: new Date().toISOString(), status_http: 200, payload_resposta: semRaw, erro: null });
          const movs = Array.isArray(j.movimentacoes) ? j.movimentacoes : [];
          const seen = new Set<string>();
          const rows = movs.map((m: any) => {
            const dt = String(m.data || m.data_movimentacao || "").slice(0, 10);
            const de = String(m.descricao || (m.complementos || []).join("; ") || "").trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dt) || !de || seen.has(dt + de)) return null;
            seen.add(dt + de);
            return { processo_id: p.id, data_movimentacao: `${dt}T12:00:00.000Z`, descricao: de, fonte: "judit_api", codigo: m.codigo != null ? String(m.codigo) : null, raw: m };
          }).filter(Boolean);
          for (let i = 0; i < rows.length; i += 200) await sb.from("movimentacoes").insert(rows.slice(i, i + 200));
          res.push({ n: p.numero, ok: true, movs: rows.length });
        } else {
          res.push({ n: p.numero, ok: false, erro: j?.error || `HTTP ${r.status}` });
        }
        const { error } = await sb.from("processos").update(upd).eq("id", p.id);
        if (error) {
          // se algum campo não couber, grava ao menos a marca de consulta
          await sb.from("processos").update({ ultima_consulta_judit: upd.ultima_consulta_judit }).eq("id", p.id);
          res.push({ n: p.numero, upd_erro: error.message });
        }
      } catch (e) {
        res.push({ n: p.numero, ok: false, erro: (e as Error).message });
      }
    }));
    const { count } = await sb.from("processos").select("id", { count: "exact", head: true })
      .eq("coordenacao_id", COORD).eq("descricao", MARCA).is("ultima_consulta_judit", null);
    return json({ processados: res, restantes: count });
  }
  return json({ error: "mode inválido" }, 400);
});
