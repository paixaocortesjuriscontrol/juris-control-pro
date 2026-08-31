import { forwardRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemAtividades, useSubatividades, type TipoItemAtividade } from "./ItemAtividades";
import { ItemComentarios } from "./ItemComentarios";
import { ItemAnexos, type ItemAnexosHandle, type ItemAnexosTipo } from "./ItemAnexos";
import { ItemHistorico } from "./ItemHistorico";
import { TabErrorBoundary } from "./TabErrorBoundary";
import { useContagemComentarios } from "@/hooks/useItensComComentarios";

interface ItemAbasProps {
  /** Tipo do item (usado em atividades e histórico) */
  tipo: TipoItemAtividade;
  /** Tabela de comentários/anexos correspondente */
  tipoComentario: "tarefa" | "evento" | "audiencia";
  itemId?: string | null;
  processoId?: string | null;
  /** Oculta a aba de anexos quando não aplicável */
  mostrarAnexos?: boolean;
}

/**
 * Bloco padrão de abas exibido no rodapé dos formulários de itens
 * (prazo, tarefa, audiência, evento e parcelamento).
 */
export const ItemAbas = forwardRef<ItemAnexosHandle, ItemAbasProps>(
  ({ tipo, tipoComentario, itemId, processoId, mostrarAnexos = true }, anexosRef) => {
    const { data: atividades = [] } = useSubatividades(tipo, itemId);
    const concluidas = atividades.filter((a) => a.situacao === "concluida").length;
    const { data: totalComentarios = 0 } = useContagemComentarios(tipoComentario, itemId);

    return (
      <Tabs defaultValue="atividades" className="w-full border-t pt-3">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="atividades">
            Atividades{atividades.length > 0 ? ` ${concluidas}/${atividades.length}` : ""}
          </TabsTrigger>
          <TabsTrigger value="comentarios">
            Comentários{totalComentarios > 0 ? ` ${totalComentarios}` : ""}
          </TabsTrigger>
          {mostrarAnexos && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
          <TabsTrigger value="historico">Histórico de alterações</TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="mt-3">
          <TabErrorBoundary area="as atividades">
            <ItemAtividades tipo={tipo} itemId={itemId} />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="comentarios" className="mt-3">
          <TabErrorBoundary area="os comentários">
            <ItemComentarios tipo={tipoComentario} itemId={itemId} />
          </TabErrorBoundary>
        </TabsContent>

        {mostrarAnexos && (
          <TabsContent value="anexos" className="mt-3" forceMount>
            <TabErrorBoundary area="os anexos">
              <ItemAnexos
                ref={anexosRef}
                tipo={tipoComentario as ItemAnexosTipo}
                itemId={itemId}
                processoId={processoId}
              />
            </TabErrorBoundary>
          </TabsContent>
        )}

        <TabsContent value="historico" className="mt-3">
          <TabErrorBoundary area="o histórico">
            <ItemHistorico tipo={tipo} tipoComentario={tipoComentario} itemId={itemId} />
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>
    );
  },
);
ItemAbas.displayName = "ItemAbas";
