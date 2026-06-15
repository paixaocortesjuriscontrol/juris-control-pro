// Engine DJEN Paralela no VPS: invoca a edge function monitorar-djen.
// Para evitar IDLE_TIMEOUT (504) da edge function (~150s), o VPS faz o
// chunking: lista os monitoramentos ativos aqui e invoca a edge function
// UMA VEZ POR MONITORAMENTO (com a janela de datas filtrada). Assim cada
// chamada é curta e o progresso é reportado em execucoes_servidor.progresso
// item-a-item, igual ao comportamento da Paralela do browser.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Timeout por chamada (1 monitoramento). 140s fica abaixo do limite do
// Supabase Edge Functions (~150s) para detectar travas antes do 504.
const TIMEOUT_MS = parseInt(process.env.PARALELA_TIMEOUT_MS || "140000", 10);

const TODOS_CIVEIS = ["TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT","TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO"];
const TODOS_TRT = ["TST","TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10","TRT11","TRT12","TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22","TRT23","TRT24"];
const TODOS_TRIBUNAIS = [...TODOS_TRT, "STF", "STJ", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", ...TODOS_CIVEIS];
const TIPO_ORDER = ["parte", "advogado", "palavra-chave", "processo"];

function mapTipo(tipo) {
  return tipo === "nome" ? "palavra-chave" : (tipo || "palavra-chave");
}

function expandirTribunais(tribunais) {
  if (!Array.isArray(tribunais) || tribunais.length === 0) return TODOS_TRIBUNAIS;
  const set = new Set();
  for (const raw of tribunais) {
    const t = String(raw || "").trim();
    if (t === "TODOS_CIVEIS") TODOS_CIVEIS.forEach((x) => set.add(x));
    else if (t === "TODOS_TRT") TODOS_TRT.forEach((x) => set.add(x));
    else if (t) set.add(t);
  }
  return set.size > 0 ? TODOS_TRIBUNAIS.filter((t) => set.has(t)) : TODOS_TRIBUNAIS;
}

async function invokeDjen(body) {
  const url = `${SUPABASE_URL}/functions/v1/monitorar-djen`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { status: res.status, body: parsed };
  } finally {
    clearTimeout(to);
  }
}

function ymdToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function run({ sb, payload, log, job }) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env do VPS");
  }

  const dataInicio = payload?.dataInicio || payload?.diarioYmd || ymdToday();
  const dataFim = payload?.dataFim || payload?.diarioYmd || dataInicio;
  const coordenacaoId = payload?.coordenacaoId || null;
  const monitoramentoIdsFiltro =
    Array.isArray(payload?.monitoramentoIds) && payload.monitoramentoIds.length > 0
      ? payload.monitoramentoIds
      : null;

  log("paralela.start", { dataInicio, dataFim, coordenacaoId, monitoramentoIdsFiltro });

  // 1) Lista monitoramentos ativos respeitando filtros
  let q = sb
    .from("monitoramentos_djen")
    .select("id, descricao, termo_busca, tipo, coordenacao_id, tribunais")
    .eq("ativo", true);
  if (coordenacaoId) q = q.eq("coordenacao_id", coordenacaoId);
  if (monitoramentoIdsFiltro) q = q.in("id", monitoramentoIdsFiltro);
  const { data: monitoramentos, error: monErr } = await q;
  if (monErr) throw new Error(`Falha ao listar monitoramentos: ${monErr.message}`);

  const lista = monitoramentos || [];
  log("paralela.monitoramentos", { total: lista.length });

  // 2) Estado de progresso (1 item por tribunal/tipo), espelhando a tela Paralela.
  const grouped = new Map();
  for (const m of lista) {
    const tipo = mapTipo(m.tipo);
    const tribunais = expandirTribunais(m.tribunais);
    for (const tribunal of tribunais) {
      const key = `${tipo}|${tribunal}`;
      if (!grouped.has(key)) grouped.set(key, { tipo, tribunal, monitoramentos: [] });
      grouped.get(key).monitoramentos.push(m);
    }
  }
  const itens = Array.from(grouped.values())
    .sort((a, b) => {
      const ta = TODOS_TRIBUNAIS.indexOf(a.tribunal);
      const tb = TODOS_TRIBUNAIS.indexOf(b.tribunal);
      return (ta - tb) || (TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo));
    })
    .map((g) => ({
      id: `${g.tipo}|${g.tribunal}`,
      label: g.monitoramentos.length > 1 ? `${g.monitoramentos.length} termos` : (g.monitoramentos[0]?.descricao || g.monitoramentos[0]?.termo_busca || g.tribunal),
      tribunal: g.tribunal,
      tipo: g.tipo,
      monitoramentoIds: g.monitoramentos.map((m) => m.id),
      status: "pendente",
      current: 0,
      total: g.monitoramentos.length,
      mensagem: "Aguardando slot...",
      novas: 0,
      descartadas: 0,
      duplicatas: 0,
      erro: null,
    }));

  let lastFlush = 0;
  const flushProgresso = async (force = false) => {
    if (!job?.id) return;
    const now = Date.now();
    if (!force && now - lastFlush < 800) return;
    lastFlush = now;
    const concluidos = itens.filter((i) => i.status === "concluido" || i.status === "erro").length;
    const falhas = itens.filter((i) => i.status === "erro").length;
    const atual = itens.find((i) => i.status === "executando");
    try {
      await sb
        .from("execucoes_servidor")
        .update({
          progresso: {
            totalItens: itens.length,
            concluidos,
            falhas,
            atual: atual ? { id: atual.id, label: atual.label } : null,
            itens,
            janela: { dataInicio, dataFim },
          },
          progresso_atualizado_em: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (e) {
      log("paralela.flush_error", { e: e.message });
    }
  };
  await flushProgresso(true);

  // 3) Loop sequencial: 1 chamada à edge function por tribunal/tipo
  let totalNovas = 0;
  let totalDescartadas = 0;
  let totalDuplicatas = 0;
  let totalErros = 0;

  // Helper: verifica se o usuário cancelou a execução via UI.
  const isCancelled = async () => {
    if (!job?.id) return false;
    try {
      const { data } = await sb
        .from("execucoes_servidor")
        .select("status")
        .eq("id", job.id)
        .maybeSingle();
      return data?.status === "cancelado";
    } catch {
      return false;
    }
  };

  for (const item of itens) {
    if (await isCancelled()) {
      log("paralela.cancelled", { remaining: itens.filter(i => i.status === "pendente").length });
      break;
    }
    item.status = "executando";
    item.mensagem = `Processando ${item.tribunal} via VPS...`;
    await flushProgresso();
    try {
      for (const monitoramentoId of item.monitoramentoIds) {
        if (await isCancelled()) break;
        const { status, body } = await invokeDjen({
          dataInicio,
          dataFim,
          execucaoServidorId: job?.id || null,
          skipServidorProgress: true,
          coordenacaoId,
          monitoramentoIds: [monitoramentoId],
          tribunais: [item.tribunal],
        });
        if (status < 200 || status >= 300) {
          throw new Error(`status ${status}: ${JSON.stringify(body).slice(0, 300)}`);
        }
        item.novas += body?.novas ?? 0;
        item.descartadas += body?.descartadas ?? 0;
        item.duplicatas += body?.duplicatas ?? 0;
        item.current += 1;
        item.mensagem = `${item.tribunal}: ${item.current}/${item.total} termos`;
        await flushProgresso();
      }
      item.current = item.total;
      item.mensagem = `Concluído: ${item.novas} novas, ${item.duplicatas} duplicadas, ${item.descartadas} descartadas`;
      item.status = "concluido";
      totalNovas += item.novas;
      totalDescartadas += item.descartadas;
      totalDuplicatas += item.duplicatas;
    } catch (e) {
      item.status = "erro";
      item.erro = String(e && e.message ? e.message : e).slice(0, 500);
      item.current = item.total;
      item.mensagem = "Erro na execução";
      totalErros += 1;
      log("paralela.item_error", { id: item.id, e: item.erro });
    }
    await flushProgresso();
  }
  await flushProgresso(true);

  log("paralela.done", {
    monitoramentos: itens.length,
    novas: totalNovas,
    descartadas: totalDescartadas,
    duplicatas: totalDuplicatas,
    erros: totalErros,
  });

  return {
    novas: totalNovas,
    descartadas: totalDescartadas,
    duplicatas: totalDuplicatas,
    erros: totalErros,
    monitoramentos: itens.length,
    dataInicio,
    dataFim,
  };
}

module.exports = { run };