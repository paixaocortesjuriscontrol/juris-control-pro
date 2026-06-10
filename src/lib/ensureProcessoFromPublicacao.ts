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

  return { id: processo!.id, numero: processo!.numero ?? numero };
}