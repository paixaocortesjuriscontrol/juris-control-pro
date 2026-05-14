import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnexosJuditTab } from "@/components/distribuicao-tst/AnexosJuditTab";
import { Loader2 } from "lucide-react";
import { obterVariantesCnjBusca } from "@/utils/cnjMask";

interface Props {
  processoNumero: string;
}

export function ProcessoAnexosJuditTab({ processoNumero }: Props) {
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
    />
  );
}