import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import { AudienciaFormSimplificado } from "@/components/audiencias/AudienciaFormSimplificado";

export type NovoItemTipo = "tarefa" | "evento" | "prazo" | "audiencia" | "parcelamento";

interface NovoItemPanelProps {
  tipo: NovoItemTipo;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  /** Registro existente para edição (tarefa/evento/prazo/parcelamento). */
  itemParaEditar?: any | null;
  /** Processo pré-selecionado (usado quando aberto dentro do Detalhe do Processo). */
  processoPreSelecionado?: { id: string; numero: string; coordenacao_id?: string | null } | null;
  /** Publicação DJEN vinculada, para exibir card verde retrátil. */
  publicacao?: any | null;
  /**
   * Modo embutido: usa fluxo natural (sem altura fixa nem overflow interno),
   * de forma que a rolagem ocorra apenas no container externo da página.
   */
  embedded?: boolean;
}

/**
 * Painel unificado para criar/editar itens (Tarefa, Evento, Prazo, Audiência, Parcelamento recorrente).
 * Mesmos formulários usados pelo Painel de Controle — reutilizado no Detalhe do Processo.
 */
export function NovoItemPanel({
  tipo,
  onClose,
  onSuccess,
  itemParaEditar = null,
  processoPreSelecionado = null,
  publicacao = null,
  embedded = false,
}: NovoItemPanelProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: membrosCoordenacoes = [] } = useQuery({
    queryKey: ["membros-coordenacoes-novo-item-panel", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return (data || []).map((m) => m.coordenacao_id);
    },
    enabled: !!user?.id && !isAdmin && tipo === "tarefa",
  });

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-novo-item-panel", isAdmin, membrosCoordenacoes],
    queryFn: async () => {
      let query = supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      if (!isAdmin && membrosCoordenacoes.length > 0) {
        query = query.in("id", membrosCoordenacoes);
      } else if (!isAdmin && membrosCoordenacoes.length === 0) {
        return [];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: tipo === "tarefa" && (isAdmin || membrosCoordenacoes.length > 0),
  });

  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
  };

  return (
    <div className={embedded ? "w-full flex flex-col bg-background" : "h-full w-full flex flex-col bg-background overflow-hidden"}>
      <div className="flex items-center justify-end px-2 py-1.5 border-b bg-card flex-shrink-0 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Fechar">
          <span className="sr-only">Fechar</span>
          ×
        </Button>
      </div>
      <div className={embedded ? "w-full" : "flex-1 min-h-0 overflow-hidden"}>
        {tipo === "tarefa" && (
          <NovaTarefaDialog
            inline
            embedded={embedded}
            open
            onOpenChange={handleOpenChange}
            coordenacoes={coordenacoes}
            tarefaParaEditar={itemParaEditar}
            processoPreSelecionado={processoPreSelecionado ?? undefined}
            publicacao={publicacao ?? undefined}
            onSuccess={() => { void onSuccess(); }}
          />
        )}
        {tipo === "evento" && (
          <EventoDialog
            inline
            embedded={embedded}
            open
            onOpenChange={(o) => { handleOpenChange(o); if (!o) void onSuccess(); }}
            evento={itemParaEditar}
            defaultProcessoId={processoPreSelecionado?.id}
            publicacao={publicacao ?? undefined}
          />
        )}
        {tipo === "prazo" && (
          <PrazoDialog
            inline
            embedded={embedded}
            open
            onOpenChange={(o) => { handleOpenChange(o); if (!o) void onSuccess(); }}
            prazo={itemParaEditar}
            defaultProcessoId={processoPreSelecionado?.id}
            publicacao={publicacao ?? undefined}
          />
        )}
        {tipo === "audiencia" && (
          <div className={embedded ? "flex flex-col" : "h-full flex flex-col"}>
            <div className="px-4 pt-4 sm:px-6 sm:pt-5 pb-3 shrink-0 border-b">
              <h3 className="text-base font-semibold">Audiência</h3>
            </div>
            <div className={embedded ? "px-4 sm:px-6 py-4" : "flex-1 overflow-y-auto px-4 sm:px-6 py-4"}>
              <AudienciaFormSimplificado
                hideTitleHeader
                defaultProcessoId={processoPreSelecionado?.id}
                defaultProcessoNumero={processoPreSelecionado?.numero}
                /* Coordenação nunca vem do processo: usa a do usuário logado */
                publicacaoId={publicacao?.id}
                onSuccess={() => { void onSuccess(); }}
                onCancel={onClose}
              />
            </div>
          </div>
        )}
        {tipo === "parcelamento" && (
          <GerarParcelasDialog
            inline
            embedded={embedded}
            open
            onOpenChange={(o) => { handleOpenChange(o); if (!o) void onSuccess(); }}
            evento={itemParaEditar}
            defaultProcessoId={processoPreSelecionado?.id}
          />
        )}
      </div>
    </div>
  );
}

export default NovoItemPanel;