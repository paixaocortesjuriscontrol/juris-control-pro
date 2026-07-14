import { supabase } from "@/integrations/supabase/client";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { formatProcessoNumero } from "@/lib/utils";

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function salvarPublicacaoNoProcesso(pub: PublicacaoUnificada, processoId: string) {
  if (!pub?.id || !processoId) return;

  // Publicações descartadas são apenas auditoria: não devem ser vinculadas ao
  // processo nem a tarefas/prazos/eventos criados pelo botão Adicionar.
  if (pub.tipo_origem === "descartada" || pub.tipo_origem === "datajud") return;

  if (pub.tipo_origem === "processo") {
    const updatePayload: Record<string, unknown> = { processo_id: processoId };
    if (pub.processo_numero) updatePayload.processo_numero = pub.processo_numero;
    const { error } = await (supabase as any)
      .from("publicacoes_djen_processos")
      .update(updatePayload)
      .eq("id", pub.id);
    if (error) console.warn("[ensureProcessoFromPublicacao] falha ao vincular publicação do processo:", error);
    return;
  }

  const { error: updateTermoError } = await (supabase as any)
    .from("publicacoes_djen")
    .update({ processo_id: processoId })
    .eq("id", pub.id);
  if (updateTermoError) console.warn("[ensureProcessoFromPublicacao] falha ao vincular publicação ao processo:", updateTermoError);

  // A aba "Pub. DJEN" dos detalhes do processo historicamente lê a tabela
  // publicacoes_djen_processos. Ao criar tarefa/prazo/evento/audiência a partir
  // de uma publicação da Análise DJEN, também gravamos uma cópia ali para que a
  // publicação clicada apareça imediatamente no processo/caso.
  try {
    const { data: original } = await (supabase as any)
      .from("publicacoes_djen")
      .select("id, hash_conteudo, processo_numero, conteudo, data_publicacao, data_disponibilizacao, fonte, lida, orgao, tipo_comunicacao, meio, advogados_json, partes_json, tribunal, dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, status, dedup_key, id_djen")
      .eq("id", pub.id)
      .maybeSingle();

    const hashConteudo = original?.hash_conteudo || pub.dedup_conteudo_key || pub.dedup_key || pub.id;
    const processoNumero = original?.processo_numero || pub.processo_numero;
    if (!hashConteudo || !processoNumero) return;

    const row: Record<string, unknown> = {
      processo_id: processoId,
      processo_numero: processoNumero,
      conteudo: original?.conteudo ?? pub.conteudo ?? null,
      data_publicacao: original?.data_publicacao ?? pub.data_publicacao ?? null,
      data_disponibilizacao: original?.data_disponibilizacao ?? pub.data_disponibilizacao ?? null,
      fonte: original?.fonte ?? pub.fonte ?? "DJEN",
      hash_conteudo: hashConteudo,
      lida: original?.lida ?? pub.lida ?? false,
      orgao: original?.orgao ?? pub.orgao ?? null,
      tipo_comunicacao: original?.tipo_comunicacao ?? pub.tipo_comunicacao ?? null,
      meio: original?.meio ?? pub.meio ?? null,
      advogados_json: original?.advogados_json ?? pub.advogados_json ?? null,
      partes_json: original?.partes_json ?? pub.partes_json ?? null,
      tribunal: original?.tribunal ?? pub.tribunal ?? null,
      dedup_processo_digits: original?.dedup_processo_digits ?? null,
      dedup_data_ref: original?.dedup_data_ref ?? null,
      dedup_head_norm: original?.dedup_head_norm ?? null,
      coordenacao_id: original?.coordenacao_id ?? pub.coordenacao_id ?? null,
      status: original?.status ?? "encontrada",
      dedup_key: original?.dedup_key ?? pub.dedup_key ?? null,
      id_djen: original?.id_djen ?? pub.id_djen ?? null,
    };

    const { data: existentePorHash } = await (supabase as any)
      .from("publicacoes_djen_processos")
      .select("id")
      .eq("processo_id", processoId)
      .eq("hash_conteudo", hashConteudo)
      .maybeSingle();

    if (existentePorHash?.id) {
      const { error } = await (supabase as any)
        .from("publicacoes_djen_processos")
        .update(row)
        .eq("id", existentePorHash.id);
      if (error) throw error;
      return;
    }

    if (row.id_djen && row.coordenacao_id) {
      const { data: existentePorDjen } = await (supabase as any)
        .from("publicacoes_djen_processos")
        .select("id")
        .eq("coordenacao_id", row.coordenacao_id)
        .eq("id_djen", row.id_djen)
        .maybeSingle();

      if (existentePorDjen?.id) {
        const { error } = await (supabase as any)
          .from("publicacoes_djen_processos")
          .update(row)
          .eq("id", existentePorDjen.id);
        if (error) throw error;
        return;
      }
    }

    const { error: insertError } = await (supabase as any)
      .from("publicacoes_djen_processos")
      .insert(row);

    if (insertError) {
      const fallbackRow = { ...row, id_djen: null };
      const { error: fallbackError } = await (supabase as any)
        .from("publicacoes_djen_processos")
        .upsert(fallbackRow, { onConflict: "processo_id,hash_conteudo" });
      if (fallbackError) throw fallbackError;
    }
  } catch (err) {
    console.warn("[ensureProcessoFromPublicacao] falha ao salvar publicação na aba Pub. DJEN:", err);
  }
}

/**
 * Extrai a seção "Parte(s):" do conteúdo da publicação e retorna
 * uma lista de partes { nome, polo, is_advogado }.
 * O conteúdo DJEN costuma ter o padrão:
 *   "Parte(s): NOME (Autor) - ADV: DR. FULANO (OAB...)"
 */
function parsePartesFromConteudo(conteudo: string): Array<{
  nome: string;
  polo: string | null;
  is_advogado: boolean;
}> {
  if (!conteudo) return [];
  const texto = stripHtml(conteudo);
  const m = texto.match(/Parte\(s\)\s*:\s*(.+?)(?:Advogado\(s\)|Advogados\s*:|$)/i);
  if (!m) return [];
  const bloco = m[1];
  // separa por " - " ou ", " tolerante
  const raw = bloco
    .split(/\s(?:-|\|)\s|;|,\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const partes: Array<{ nome: string; polo: string | null; is_advogado: boolean }> = [];
  const vistas = new Set<string>();
  for (const item of raw) {
    // Detecta advogado por prefixo "ADV" ou " OAB "
    const isAdv = /\b(ADV|OAB)\b/i.test(item);
    // Detecta polo por parenteses (Autor|Réu|Reclamante|Reclamado|Requerente|Requerido|Exequente|Executado)
    let polo: string | null = null;
    const poloMatch = item.match(/\((autor|reclamante|requerente|exequente|réu|reclamado|requerido|executado|impetrante|impetrado)[^)]*\)/i);
    if (poloMatch) {
      const p = poloMatch[1].toLowerCase();
      if (/autor|reclamante|requerente|exequente|impetrante/.test(p)) polo = "ativo";
      else polo = "passivo";
    }
    // Nome = tudo antes do primeiro parênteses ou traço com ADV
    const nome = item
      .replace(/\s*\(.*?\).*/g, "")
      .replace(/\s*-\s*ADV.*$/i, "")
      .replace(/\s*OAB.*$/i, "")
      .trim();
    if (nome.length < 3 || nome.length > 200) continue;
    const chave = nome.toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    partes.push({ nome, polo, is_advogado: isAdv });
  }
  return partes;
}

/**
 * Busca um processo existente pelo número da publicação. Se não existir,
 * cria silenciosamente uma pasta + processo + responsável + movimentação inicial,
 * e marca a publicação como lida.
 * Retorna { id, numero } do processo, ou null se a publicação não tiver número.
 */
export async function ensureProcessoFromPublicacao(
  pub: PublicacaoUnificada,
  userId: string,
  userCoordenacaoId?: string | null,
  coordenacaoIdOverride?: string | null,
): Promise<{ id: string; numero: string } | null> {
  const numero = pub.processo_numero?.trim();
  if (!numero) return null;

  const numeroDigits = numero.replace(/\D/g, "");
  // Sempre tentar formatar a partir dos dígitos puros (o número que vem do DJEN é geralmente 20 dígitos sem máscara).
  // formatProcessoNumero retorna o input original quando não há exatamente 20 dígitos.
  const numeroMasked = formatProcessoNumero(numeroDigits.length === 20 ? numeroDigits : numero);
  const candidatos = Array.from(new Set([numeroMasked, numero, numeroDigits].filter(Boolean)));

  const coordFinal = coordenacaoIdOverride || pub.coordenacao_id || userCoordenacaoId || null;

  // 1. Tenta encontrar processo existente
  try {
    const orExpr = candidatos.map((c) => `numero.ilike.%${c}%`).join(",");
    const { data: existente } = await supabase
      .from("processos")
      .select("id, numero")
      .or(orExpr)
      .limit(1)
      .maybeSingle();
    if (existente?.id) {
      // Atualizar coordenacao_id se um override válido foi fornecido
      if (coordenacaoIdOverride) {
        await supabase
          .from("processos")
          .update({ coordenacao_id: coordenacaoIdOverride })
          .eq("id", existente.id);
      }
      await salvarPublicacaoNoProcesso(pub, existente.id);
      return { id: existente.id, numero: existente.numero ?? numero };
    }
  } catch {
    /* segue para criação */
  }

  // 2. Cria pasta + processo + responsável
  const poloAtivo = pub.polo_ativo || "Autor não identificado";
  const poloPassivo = pub.polo_passivo || "Réu não identificado";
  const nomePasta = `${poloPassivo} x ${poloAtivo} - ${numero}`.substring(0, 200);

  let pastaId: string | null = null;
  const { data: pastaExistente } = await supabase
    .from("pastas")
    .select("id")
    .eq("nome", nomePasta)
    .maybeSingle();
  if (pastaExistente?.id) {
    pastaId = pastaExistente.id;
  } else {
    const { data: novaPasta, error: pastaErr } = await supabase
      .from("pastas")
      .insert({
        nome: nomePasta,
        descricao: `Processo importado do DJEN - ${numero}`,
        criado_por: userId,
      })
      .select("id")
      .single();
    if (pastaErr) throw pastaErr;
    pastaId = novaPasta!.id;
  }

  const conteudoLimpo = stripHtml(pub.conteudo || "");
  const { data: processo, error: procErr } = await supabase
    .from("processos")
    .insert({
      numero: numeroMasked || numero,
      area: "civil",
      status: "ativo",
      tribunal: pub.tribunal || pub.fonte || "Não identificado",
      polo_ativo: pub.polo_ativo || "A identificar",
      polo_passivo: pub.polo_passivo || "A identificar",
      assunto: conteudoLimpo.substring(0, 500) || "Processo importado do DJEN",
      pasta_id: pastaId,
      coordenacao_id: coordFinal,
      monitorar_andamentos: true,
    })
    .select("id, numero")
    .single();
  if (procErr) throw procErr;

  await supabase
    .from("processos_responsaveis")
    .insert({ processo_id: processo!.id, usuario_id: userId })
    .then(() => {}, () => {});

  await supabase
    .from("movimentacoes")
    .insert({
      processo_id: processo!.id,
      descricao: `Publicação DJEN: ${conteudoLimpo.substring(0, 1000) || "Importado do DJEN"}`,
      tipo: "publicacao",
      fonte: "DJEN",
      data_movimentacao: pub.data_publicacao || new Date().toISOString(),
    })
    .then(() => {}, () => {});

  // Importar partes separadamente (uma por registro), best-effort
  try {
    const partes = parsePartesFromConteudo(pub.conteudo || "");
    if (partes.length > 0) {
      await supabase.from("processos_partes").insert(
        partes.map((p) => ({
          processo_id: processo!.id,
          nome: p.nome,
          polo: p.polo,
          is_advogado: p.is_advogado,
          fonte: "DJEN",
          created_by: userId,
        })),
      );
    }
  } catch {
    /* best-effort */
  }

  await salvarPublicacaoNoProcesso(pub, processo!.id);

  return { id: processo!.id, numero: processo!.numero ?? numero };
}