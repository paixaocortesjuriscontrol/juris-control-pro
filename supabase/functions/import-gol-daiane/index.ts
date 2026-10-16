import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = "gol-daiane-imp-9f3k2m7x";
const COORD_GOL = "f5a0ac48-7461-49c1-9151-219e570831bd";
const CLIENTE_GOL = "0122704b-b6df-4ef5-9a3a-2061c30bea97";
const CRIADO_POR = "401f396e-5678-4567-8ca9-7640979f62a7"; // Daiane Souza
const HOJE = "2026-10-16";

const RESP: Record<string, string[]> = {
  "DAIANE": ["401f396e-5678-4567-8ca9-7640979f62a7"],
  "PHELIPE": ["d9702715-8004-4747-88ea-a7b31a37d3c0"],
  "MARIA LUIZA": ["e7f348e7-7711-466a-aab6-c032e671857d"],
  "EMILLY": ["d27dafc3-6756-461e-a930-224d00ef0e41"],
  "FERNANDA": ["a7975b03-b6f8-4719-acc1-9e1dd319bece"],
  "GISELE": ["6faf6142-eea5-44e0-8ddf-ef5d18263ccc"],
  "CARLOS": ["70ac117d-1317-4aca-bb5e-e092b74ad99c"],
  "SAULO": ["9a16b906-ffdd-454d-9459-f82f2f80798d"],
  "BRUNA": ["233c9fed-cc50-4ce5-8c5f-bf777a84b6cb"],
  "GABRIELLY": ["65409e5f-150a-4548-8595-9c7206c62107"],
  "VICTORYA": ["a422abea-c4bb-49fa-a440-13a18a8ef1d8"],
  "VICTÓRYA": ["a422abea-c4bb-49fa-a440-13a18a8ef1d8"],
};

function mapResponsaveis(resp: string | null): string[] {
  if (!resp) return [];
  const up = resp.toUpperCase().normalize("NFC");
  const ids = new Set<string>();
  for (const parte of up.split(/[/,;]+/)) {
    const p = parte.trim();
    for (const [nome, uid] of Object.entries(RESP)) {
      if (p === nome || p.startsWith(nome + " ") || p.startsWith(nome + "-")) ids.add(uid[0]);
    }
  }
  return [...ids];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const body = await req.json().catch(() => null);
  if (!body || body.token !== TOKEN) return new Response("unauthorized", { status: 401 });
  const rows = body.rows as any[];
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const procCache = new Map<string, string | null>();
  const out = { inseridos: 0, duplicados: 0, sem_processo_valido: 0, sem_data: 0, processos_criados: 0, erros: [] as string[] };

  for (const r of rows) {
    try {
      const digits = String(r.proc || "").replace(/\D/g, "");
      const fatal = /^\d{4}-\d{2}-\d{2}/.test(r.fatal || "") ? r.fatal.slice(0, 10) : null;
      if (digits.length < 15) { out.sem_processo_valido++; continue; }
      if (!fatal) { out.sem_data++; continue; }

      let processoId = procCache.get(digits);
      if (processoId === undefined) {
        const { data: found } = await supabase
          .from("processos")
          .select("id, coordenacao_id")
          .filter("numero", "ilike", `%${digits.slice(0, 7)}%${digits.slice(7, 13)}%`)
          .limit(50);
        let match: string | null = null;
        if (found && found.length) {
          const exatos = found.filter((p: any) => true);
          // refina comparando dígitos no banco via rpc-like: filtra em memória
          const { data: todos } = await supabase
            .from("processos")
            .select("id, numero, coordenacao_id")
            .in("id", exatos.map((p: any) => p.id));
          const ok = (todos || []).filter((p: any) => String(p.numero).replace(/\D/g, "") === digits);
          const gol = ok.find((p: any) => p.coordenacao_id === COORD_GOL);
          match = (gol || ok[0] || {}).id || null;
        }
        if (!match) {
          const { data: novo, error: errIns } = await supabase
            .from("processos")
            .insert({
              numero: String(r.proc).trim(),
              area: "trabalhista",
              status: "ativo",
              coordenacao_id: COORD_GOL,
              reclamante: r.recl || null,
              uf: r.uf && r.uf.length <= 2 ? r.uf.toUpperCase() : null,
              cliente_id: (r.cliente || "").toUpperCase().includes("GOL") ? CLIENTE_GOL : null,
              dados_relatorio_cliente: { relatorio_origem: "planilha Daiane Souza (MEUS PRAZOS / PLANILHA DE DEFESA)", cliente_planilha: r.cliente || null },
            })
            .select("id")
            .single();
          if (errIns) throw new Error("processo " + digits + ": " + errIns.message);
          match = novo.id;
          out.processos_criados++;
        }
        procCache.set(digits, match);
        processoId = match;
      }
      if (!processoId) { out.sem_processo_valido++; continue; }

      const titulo = (r.prov || "Prazo").trim();
      const { data: dup } = await supabase
        .from("tarefas")
        .select("id")
        .eq("processo_id", processoId)
        .ilike("titulo", titulo)
        .eq("data_fatal", fatal)
        .not("status", "in", '("cancelado","cancelado_oculto")')
        .limit(1);
      if (dup && dup.length) { out.duplicados++; continue; }

      const cumprido = fatal < HOJE;
      const partesDesc = [
        r.pub ? `Publicação: ${r.pub.split("-").reverse().join("/")}` : null,
        r.status ? `Status na planilha: ${r.status}` : null,
        r.cliente ? `Cliente/população: ${r.cliente}` : null,
        r.resp ? `Responsável na planilha: ${r.resp}` : null,
        r.obs ? `Obs: ${r.obs}` : null,
        `Aba ${r.aba} (${r.arquivo})`,
        "Importado da planilha de prazos enviada por Daiane Souza",
      ].filter(Boolean);

      const respIds = mapResponsaveis(r.resp);
      const { data: tarefa, error: errT } = await supabase
        .from("tarefas")
        .insert({
          processo_id: processoId,
          titulo,
          descricao: partesDesc.join(" | "),
          tipo_registro: "tarefa",
          tipo_tarefa: "PRAZO",
          prioridade: "media",
          status: cumprido ? "cumprido" : "pendente",
          data_vencimento: fatal,
          data_fatal: fatal,
          data_cumprimento: cumprido ? fatal : null,
          origem: "planilha",
          coordenacao_id: COORD_GOL,
          criado_por: CRIADO_POR,
          criado_por_nome: "Daiane Souza",
          responsavel_id: respIds[0] || null,
        })
        .select("id")
        .single();
      if (errT) throw new Error("tarefa " + digits + ": " + errT.message);

      if (respIds.length) {
        await supabase.from("tarefa_responsaveis").insert(respIds.map((u) => ({ tarefa_id: tarefa.id, usuario_id: u })));
      }
      out.inseridos++;
    } catch (e) {
      out.erros.push(String((e as Error).message).slice(0, 200));
    }
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
