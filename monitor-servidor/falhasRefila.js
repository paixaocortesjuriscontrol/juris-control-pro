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

async function recordFalha(sb, { tipo, execucaoId, itemKey, payload, erro }) {
  if (!tipo || !itemKey) return;
  const dia = diaBrtHoje();
  const ultimoErro = String(erro || "").slice(0, 1000);
  // Lê tentativas atuais e regrava (Postgrest não suporta increment + upsert simples).
  const { data: existente } = await sb
    .from("execucoes_servidor_falhas")
    .select("id, tentativas, status")
    .eq("tipo", tipo)
    .eq("dia_brt", dia)
    .eq("item_key", itemKey)
    .maybeSingle();
  if (existente?.id) {
    const tentativas = (existente.tentativas || 0) + 1;
    const status = tentativas >= MAX_TENTATIVAS ? "abandonado" : "pendente";
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
      tentativas: 1,
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

module.exports = { recordFalha, marcarFalhaResolvida, lerFalhasPendentes, diaBrtHoje, MAX_TENTATIVAS };