// Helpers para registrar/ler/marcar falhas por item nas engines do servidor.
// Persiste em public.execucoes_servidor_falhas (criada via migration).
// Cada item tem um item_key estável por (tipo, dia_brt) para deduplicar e
// permitir refila na próxima execução do mesmo dia.

function diaBrtHoje() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Teto de tentativas por item/dia. Acima disso o item é abandonado e não
// volta a aparecer como RETRY no quadro de execuções do dia.
const MAX_TENTATIVAS = 3;

// 429 (rate limit) não é falha do item: é o DJEN pedindo espera. Não consome
// tentativa do teto, para a unidade não virar "abandonado" por congestionamento.
function ehRateLimit(erro) {
  return /HTTP\s*429|rate\s*limit|too many requests/i.test(String(erro || ""));
}

async function recordFalha(sb, { tipo, execucaoId, itemKey, payload, erro }) {
  if (!tipo || !itemKey) return;
  const dia = diaBrtHoje();
  const ultimoErro = String(erro || "").slice(0, 1000);
  const semConsumirTentativa = ehRateLimit(erro);
  // Lê tentativas atuais e regrava (Postgrest não suporta increment + upsert simples).
  const { data: existente } = await sb
    .from("execucoes_servidor_falhas")
    .select("id, tentativas, status")
    .eq("tipo", tipo)
    .eq("dia_brt", dia)
    .eq("item_key", itemKey)
    .maybeSingle();
  if (existente?.id) {
    const tentativas = semConsumirTentativa
      ? existente.tentativas || 0
      : (existente.tentativas || 0) + 1;
    const status =
      !semConsumirTentativa && tentativas >= MAX_TENTATIVAS ? "abandonado" : "pendente";
    await sb
      .from("execucoes_servidor_falhas")
      .update({
        tentativas,
        ultimo_erro: ultimoErro,
        execucao_id: execucaoId || null,
        payload: payload || {},
        status,
      })
      .eq("id", existente.id);
  } else {
    await sb.from("execucoes_servidor_falhas").insert({
      tipo,
      execucao_id: execucaoId || null,
      item_key: itemKey,
      payload: payload || {},
      ultimo_erro: ultimoErro,
      tentativas: semConsumirTentativa ? 0 : 1,
      status: "pendente",
      dia_brt: dia,
    });
  }
}

async function marcarFalhaResolvida(sb, tipo, itemKey) {
  if (!tipo || !itemKey) return;
  const dia = diaBrtHoje();
  await sb
    .from("execucoes_servidor_falhas")
    .update({ status: "resolvido" })
    .eq("tipo", tipo)
    .eq("dia_brt", dia)
    .eq("item_key", itemKey)
    .eq("status", "pendente");
}

async function lerFalhasPendentes(sb, tipo, opts = {}) {
  const dia = diaBrtHoje();
  const limite = Number(opts.limite) > 0 ? Number(opts.limite) : null;
  let query = sb
    .from("execucoes_servidor_falhas")
    .select("id, item_key, payload, tentativas")
    .eq("tipo", tipo)
    .eq("dia_brt", dia)
    .eq("status", "pendente")
    .lt("tentativas", MAX_TENTATIVAS)
    // Itens com menos tentativas primeiro: prioriza quem ainda tem chance real
    // de sucesso em vez de reciclar sempre os mesmos tribunais problemáticos.
    .order("tentativas", { ascending: true })
    .order("id", { ascending: true });
  if (limite) query = query.limit(limite);
  const { data, error } = await query;
  if (error) {
    console.warn(`[falhasRefila] lerFalhasPendentes(${tipo}):`, error.message);
    return [];
  }
  return data || [];
}

/** Quantas unidades do dia ainda estão sem coleta (pendente/abandonado). */
async function contarFalhasNaoColetadas(sb, tipo) {
  const dia = diaBrtHoje();
  const { count, error } = await sb
    .from("execucoes_servidor_falhas")
    .select("id", { count: "exact", head: true })
    .eq("tipo", tipo)
    .eq("dia_brt", dia)
    .in("status", ["pendente", "abandonado"]);
  if (error) {
    console.warn(`[falhasRefila] contarFalhasNaoColetadas(${tipo}):`, error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Detalhe das unidades do dia que seguem sem coleta, agrupado por tribunal.
 * Usado para o diagnóstico da rodada parcial dizer QUAL tribunal ficou de fora
 * e por qual motivo (em vez de apenas "parcial (1)").
 */
async function listarFalhasNaoColetadas(sb, tipo, limite = 200) {
  const dia = diaBrtHoje();
  const { data, error } = await sb
    .from("execucoes_servidor_falhas")
    .select("item_key, payload, tentativas, status, ultimo_erro")
    .eq("tipo", tipo)
    .eq("dia_brt", dia)
    .in("status", ["pendente", "abandonado"])
    .limit(limite);
  if (error) {
    console.warn(`[falhasRefila] listarFalhasNaoColetadas(${tipo}):`, error.message);
    return [];
  }
  const porTribunal = new Map();
  for (const f of data || []) {
    const p = f.payload || {};
    const tribunal = String(p.tribunal || "?").toUpperCase();
    if (!porTribunal.has(tribunal)) {
      porTribunal.set(tribunal, {
        tribunal,
        unidades: 0,
        abandonadas: 0,
        pendentes: 0,
        tentativas_max: 0,
        ultimo_erro: null,
      });
    }
    const g = porTribunal.get(tribunal);
    g.unidades++;
    if (f.status === "abandonado") g.abandonadas++;
    else g.pendentes++;
    g.tentativas_max = Math.max(g.tentativas_max, Number(f.tentativas) || 0);
    if (f.ultimo_erro && !g.ultimo_erro) g.ultimo_erro = String(f.ultimo_erro).slice(0, 200);
  }
  return Array.from(porTribunal.values()).sort((a, b) => b.unidades - a.unidades);
}

module.exports = {
  recordFalha,
  marcarFalhaResolvida,
  lerFalhasPendentes,
  contarFalhasNaoColetadas,
  listarFalhasNaoColetadas,
  diaBrtHoje,
  MAX_TENTATIVAS,
  ehRateLimit,
};