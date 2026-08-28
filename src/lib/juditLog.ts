import { supabase } from "@/integrations/supabase/client";

/**
 * Grava um registro em `judit_logs` com metadados de faturamento (tipo
 * de cobrança, tela de origem, usuário, duração). Nunca lança — falhas de log
 * apenas escrevem no console para não afetar o fluxo da consulta Judit.
 *
 * Tabela de preços aplicada no relatório /consumo-judit:
 * - com_anexos  → R$ 3,75
 * - on_demand   → R$ 0,25
 * - datalake    → R$ 0,25
 * - erro/falha  → R$ 0,00
 */
export type JuditLogParams = {
  processoNumero: string;
  tribunal?: string | null;
  requestPayload: Record<string, any>;
  juditData?: any;
  juditError?: any;
  duracaoMs?: number | null;
  origem?: string | null;
};

function detectarTipoCobranca(
  payload: Record<string, any>,
  juditData?: any,
): "com_anexos" | "on_demand" | "datalake" | "cache_local" {
  const meta = juditData?._judit_meta;
  // Reaproveitamento do resultado já obtido HOJE: não há chamada nova à Judit,
  // portanto não há custo.
  if (meta?.app_cache === true || meta?.respondido_do_cache === true) return "cache_local";
  const p = payload || {};
  if (p.com_anexos === true || p.with_attachments === true) return "com_anexos";
  if (p.on_demand === true || p.force_refresh === true) return "on_demand";
  return "datalake";
}

export async function logJudit(params: JuditLogParams): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const status = params.juditError
      ? "erro_funcao"
      : params.juditData?.error
      ? "erro_api"
      : "sucesso";

    const origem =
      params.origem ??
      (typeof window !== "undefined" ? window.location.pathname : null);

    await supabase.from("judit_logs" as any).insert({
      processo_numero: params.processoNumero,
      tribunal: params.tribunal ?? null,
      request_payload: params.requestPayload,
      raw_response: params.juditData ?? null,
      status,
      error_message: params.juditError?.message || params.juditData?.error || null,
      created_by: userData?.user?.id || null,
      user_email: userData?.user?.email || null,
      origem,
      duracao_ms: params.duracaoMs ?? null,
      tipo_cobranca: detectarTipoCobranca(params.requestPayload),
    });
  } catch (e) {
    console.warn("Falha ao gravar judit_logs:", e);
  }
}