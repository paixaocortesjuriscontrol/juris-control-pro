import { forwardRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemAtividades, useSubatividades, type TipoItemAtividade } from "./ItemAtividades";
import { ItemComentarios } from "./ItemComentarios";
import { ItemAnexos, type ItemAnexosHandle, type ItemAnexosTipo } from "./ItemAnexos";
import { ItemHistorico } from "./ItemHistorico";

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

    return (
      <Tabs defaultValue="atividades" className="w-full border-t pt-3">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="atividades">
            Atividades{atividades.length > 0 ? ` ${concluidas}/${atividades.length}` : ""}
          </TabsTrigger>
          <TabsTrigger value="comentarios">Comentários</TabsTrigger>
          {mostrarAnexos && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
          <TabsTrigger value="historico">Histórico de alterações</TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="mt-3">
          <ItemAtividades tipo={tipo} itemId={itemId} />
        </TabsContent>

        <TabsContent value="comentarios" className="mt-3">
          <ItemComentarios tipo={tipoComentario} itemId={itemId} />
        </TabsContent>

        {mostrarAnexos && (
          <TabsContent value="anexos" className="mt-3" forceMount>
            <ItemAnexos
              ref={anexosRef}
              tipo={tipoComentario as ItemAnexosTipo}
              itemId={itemId}
              processoId={processoId}
            />
          </TabsContent>
        )}

        <TabsContent value="historico" className="mt-3">
          <ItemHistorico tipo={tipo} tipoComentario={tipoComentario} itemId={itemId} />
        </TabsContent>
      </Tabs>
    );
  },
);
ItemAbas.displayName = "ItemAbas";
