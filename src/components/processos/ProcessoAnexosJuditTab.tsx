import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnexosJuditTab } from "@/components/distribuicao-tst/AnexosJuditTab";
import { Loader2 } from "lucide-react";
import { obterVariantesCnjBusca } from "@/utils/cnjMask";
import { toast } from "sonner";

interface Props {
  processoNumero: string;
  processoId?: string;
}

export function ProcessoAnexosJuditTab({ processoNumero, processoId }: Props) {
  const queryClient = useQueryClient();
  const { data: anexos = [], isLoading } = useQuery({
    queryKey: ["judit_anexos", processoNumero],
    enabled: !!processoNumero,
    queryFn: async () => {
      const variantes = obterVariantesCnjBusca(processoNumero);
      const { data, error } = await supabase
        .from("judit_anexos" as any)
        .select("*")
        .in("processo_numero", variantes)
        .order("attachment_date", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  if (!processoNumero) {
    return <p className="text-sm text-muted-foreground">Processo sem número CNJ.</p>;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const attachments = (anexos || []).map((a: any) => ({
    step_id: a.step_id || a.attachment_id,
    attachment_id: a.attachment_id,
    attachment_name: a.attachment_name,
    attachment_date: a.attachment_date,
    extension: a.extension,
    instance: a.instance,
    cnj: a.cnj,
    texto_indexado: a.texto_indexado,
    documento_id: a.documento_id,
    storage_path: a.storage_path,
  }));

  return (
    <AnexosJuditTab
      processoNumero={processoNumero}
      attachments={attachments}
      dadosJudit={null}
      contexto="processo"
      onIaPreenchido={async ({ resumo, processo: campos }) => {
        if (!resumo && !campos) return;
        try {
          const variantes = obterVariantesCnjBusca(processoNumero);
          const query = supabase
            .from("processos")
            .select("id, judit_ia_observacoes, judit_campos")
            .limit(1);
          const { data: procs } = processoId
            ? await query.eq("id", processoId)
            : await query.in("numero", variantes);
          const proc = (procs as any[])?.[0];
          if (!proc?.id) return;

          // Whitelist defensiva — apenas colunas conhecidas da tabela `processos`.
          const ALLOWED = new Set([
            "assunto","classe","materia","natureza","pedidos",
            "tipo_processo","area","sistema",
            "polo_ativo","polo_passivo","terceiro_envolvido","reclamante","reclamados",
            "tribunal","justica","esfera","instancia","orgao_julgador","vara","comarca","uf",
            "data_distribuicao","data_citacao","data_recebimento",
            "valor_causa","valor_condenacao","valor_provisionado",
            "fase","status","descricao","observacoes_processo","andamento_atual",
            "ativo_passivo","responsabilidade_tipo","risco_atual","probabilidade","risco",
            "funcao","advogado_externo","periodo_laborado","cpf_cnpj_parte_contraria",
          ]);
          const NUMERIC = new Set(["valor_causa", "valor_condenacao", "valor_provisionado"]);
          const update: Record<string, any> = {};
          const filled = new Set<string>(Array.isArray(proc.judit_campos) ? proc.judit_campos : []);
          for (const [k, v] of Object.entries(campos || {})) {
            if (!ALLOWED.has(k)) continue;
            if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) continue;
            update[k] = NUMERIC.has(k) ? Number(v) : v;
            filled.add(k);
          }
          if ((update.tribunal || update.orgao_julgador || update.vara) && !update.tipo_processo) {
            update.tipo_processo = "judicial";
            filled.add("tipo_processo");
          }
          if (resumo) {
            update.judit_ia_observacoes = proc.judit_ia_observacoes
              ? `${proc.judit_ia_observacoes}\n\n${resumo}`
              : resumo;
          }
          if (filled.size > 0) update.judit_campos = Array.from(filled);
          if (Object.keys(update).length === 0) return;
          const { error } = await supabase
            .from("processos")
            .update(update as any)
            .eq("id", proc.id);
          if (error) throw error;
          await queryClient.invalidateQueries({ queryKey: ["processo"] });
          const camposCount = Object.keys(update).filter((k) => k !== "judit_ia_observacoes").length;
          toast.success(
            camposCount > 0
              ? `IA gravou ${camposCount} campo(s) no processo.`
              : "Observações da IA gravadas no processo.",
          );
        } catch (e: any) {
          toast.error("Falha ao gravar observações da IA: " + (e?.message || ""));
        }
      }}
    />
  );
}