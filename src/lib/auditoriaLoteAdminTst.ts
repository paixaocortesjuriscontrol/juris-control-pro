import { supabase } from "@/integrations/supabase/client";

/**
 * Registrador central de auditoria das operações em LOTE do menu Admin. TST.
 *
 * Cada ferramenta abre um registro em `auditoria_lotes_admin_tst` no início da
 * execução (`iniciarAuditoriaLote`) e o encerra no final (`finalizarAuditoriaLote`),
 * gravando data/hora, usuário, arquivo, totais e a lista dos processos/dossiês
 * afetados. Nunca lança: falhas de auditoria não podem interromper a importação.
 */

export const TIPOS_LOTE_ADMIN_TST = [
  { value: "importar_certidao_pdf", label: "Importar PDF Certidão" },
  { value: "importar_distribuicao", label: "Importar Planilha Distribuição" },
  { value: "atualizar_dossies", label: "Atualizar Dossiês" },
  { value: "atualizar_equipe", label: "Atualizar Equipe" },
  { value: "atualizar_situacao_envio", label: "Atualizar Situação de Envio" },
  { value: "resposta_santander", label: "Resposta Santander" },
  { value: "benner_sim", label: "Benner SIM (conferência)" },
  { value: "outro_escritorio", label: "Verificar Outro Escritório" },
  { value: "base_pca_distribuicoes", label: "Base PCA - TST - Distribuições" },
  { value: "aplicar_tag_lote", label: "Aplicar TAG em lote" },
  { value: "distribuir_automatico", label: "Distribuir automaticamente" },
  { value: "delegar_processos", label: "Delegar processos" },
  { value: "pautas_tst_import", label: "Importar Pautas TST" },
  { value: "classificacao_tst_import", label: "Importar Classificação TST" },
  { value: "carga_benner", label: "Carga Benner" },
  { value: "outro", label: "Outra operação em lote" },
] as const;

export type TipoLoteAdminTst = (typeof TIPOS_LOTE_ADMIN_TST)[number]["value"] | string;

export const labelTipoLoteAdminTst = (tipo?: string | null): string =>
  TIPOS_LOTE_ADMIN_TST.find((t) => t.value === tipo)?.label ||
  (tipo || "—").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const labelStatusLoteAdminTst = (status?: string | null): string =>
  ({
    em_andamento: "Em andamento",
    concluida: "Concluída",
    cancelada: "Cancelada",
    erro: "Erro",
  } as Record<string, string>)[status || ""] || status || "—";

export interface ItemAuditoriaLote {
  processo?: string | null;
  dossie?: string | null;
  acao?: string;
  detalhe?: string | null;
  campos?: Record<string, any> | null;
}

const MAX_ITENS = 5000;

export interface IniciarAuditoriaLoteParams {
  tipo: TipoLoteAdminTst;
  ferramenta?: string;
  arquivoNome?: string | null;
  coordenacaoId?: string | null;
  totalLinhas?: number;
  detalhes?: Record<string, any>;
}

/** Abre um registro de auditoria e devolve o id (ou null se falhar). */
export async function iniciarAuditoriaLote(
  params: IniciarAuditoriaLoteParams
): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return null;

    let nome: string | null = null;
    try {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();
      nome = (perfil as any)?.nome ?? null;
    } catch {
      /* ignore */
    }

    const { data, error } = await supabase
      .from("auditoria_lotes_admin_tst" as any)
      .insert({
        tipo_operacao: params.tipo,
        ferramenta: params.ferramenta ?? labelTipoLoteAdminTst(params.tipo),
        rota: typeof window !== "undefined" ? window.location.pathname : null,
        arquivo_nome: params.arquivoNome ?? null,
        usuario_id: user.id,
        usuario_nome: nome,
        usuario_email: user.email ?? null,
        coordenacao_id: params.coordenacaoId ?? null,
        status: "em_andamento",
        total_linhas: params.totalLinhas ?? 0,
        detalhes: params.detalhes ?? {},
      } as any)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("Falha ao iniciar auditoria de lote:", error);
      return null;
    }
    return (data as any)?.id ?? null;
  } catch (e) {
    console.warn("Falha ao iniciar auditoria de lote:", e);
    return null;
  }
}

export interface FinalizarAuditoriaLoteParams {
  status?: "concluida" | "cancelada" | "erro";
  totalLinhas?: number;
  criados?: number;
  atualizados?: number;
  ignorados?: number;
  erros?: number;
  itens?: ItemAuditoriaLote[];
  resumo?: string | null;
  erro?: string | null;
  detalhes?: Record<string, any>;
}

/** Encerra o registro de auditoria com totais, resumo e itens afetados. */
export async function finalizarAuditoriaLote(
  id: string | null | undefined,
  params: FinalizarAuditoriaLoteParams
): Promise<void> {
  if (!id) return;
  try {
    const itens = (params.itens || []).slice(0, MAX_ITENS);
    const payload: Record<string, any> = {
      status: params.status ?? "concluida",
      finalizado_em: new Date().toISOString(),
      total_criados: params.criados ?? 0,
      total_atualizados: params.atualizados ?? 0,
      total_ignorados: params.ignorados ?? 0,
      total_erros: params.erros ?? 0,
      itens,
      resumo: params.resumo ?? null,
      erro_mensagem: params.erro ?? null,
    };
    if (params.totalLinhas !== undefined) payload.total_linhas = params.totalLinhas;
    if (params.detalhes) payload.detalhes = params.detalhes;
    if ((params.itens || []).length > MAX_ITENS) {
      payload.detalhes = {
        ...(params.detalhes || {}),
        itens_truncados: true,
        itens_total: (params.itens || []).length,
      };
    }

    const { error } = await supabase
      .from("auditoria_lotes_admin_tst" as any)
      .update(payload as any)
      .eq("id", id);
    if (error) console.warn("Falha ao finalizar auditoria de lote:", error);
  } catch (e) {
    console.warn("Falha ao finalizar auditoria de lote:", e);
  }
}