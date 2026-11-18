import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { ProcessoDocumentosTab } from "@/components/processos/ProcessoDocumentosTab";
import { ProcessoAnexosJuditTab } from "@/components/processos/ProcessoAnexosJuditTab";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  processoId?: string | null;
  processoNumero?: string | null;
  active: boolean;
}

/** Documentos cadastrados e anexos já armazenados; nenhuma consulta Judit é iniciada aqui. */
export function DocumentosProcessoResponsabilidade({ processoId, processoNumero, active }: Props) {
  const { data: documentos = [], isLoading, refetch } = useQuery({
    queryKey: ["minhas-responsabilidades", "documentos-processo", processoId],
    enabled: active && !!processoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!active) return null;
  if (!processoId) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-medium">Nenhum processo vinculado</h3>
        <p className="mt-1 text-sm text-muted-foreground">Vincule a atividade a um processo para consultar seus documentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <div className="mb-3 px-1">
          <h3 className="text-sm font-semibold">Documentos do processo</h3>
          <p className="text-xs text-muted-foreground">Arquivos cadastrados pela equipe, disponíveis para consulta e envio.</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando documentos...
          </div>
        ) : (
          <ProcessoDocumentosTab
            processoId={processoId}
            documentos={documentos}
            refetchDocumentos={() => void refetch()}
          />
        )}
      </section>

      {processoNumero && (
        <section className="border-t pt-5">
          <div className="mb-3 px-1">
            <h3 className="text-sm font-semibold">Anexos Judit já disponíveis</h3>
            <p className="text-xs text-muted-foreground">Somente os anexos já armazenados são exibidos; abrir esta aba não solicita uma nova pesquisa.</p>
          </div>
          <ProcessoAnexosJuditTab processoNumero={processoNumero} processoId={processoId} />
        </section>
      )}
    </div>
  );
}
