import { useCallback, useEffect, useState } from "react";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import { ItemAtividades, useSubatividades, type TipoItemAtividade } from "@/components/comum/ItemAtividades";
import { ItemChecklist, useChecklistItem } from "@/components/comum/ItemChecklist";
import { ItemComentarios } from "@/components/comum/ItemComentarios";
import { ItemAnexos, type ItemAnexosTipo } from "@/components/comum/ItemAnexos";
import { ItemHistorico } from "@/components/comum/ItemHistorico";
import { TabErrorBoundary } from "@/components/comum/TabErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContagemComentarios } from "@/hooks/useItensComComentarios";

interface Props {
  item: any;
  itemId: string;
  processoId?: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

function tiposDoItem(item: any): { atividade: TipoItemAtividade; comentario: ItemAnexosTipo } {
  const id = String(item?.id ?? "");
  const tipo = String(item?.tipo ?? item?.origem ?? "").toLowerCase();
  const tipoTarefa = String(item?.tipo_tarefa ?? "").toUpperCase();
  if (id.startsWith("audiencia-det-") || tipo.includes("audiencia")) {
    return { atividade: "audiencia", comentario: "audiencia" };
  }
  if (tipo === "parcelamento" || tipo === "prazo_parcela") {
    return { atividade: "parcelamento", comentario: "evento" };
  }
  if (tipo === "prazo" || tipoTarefa === "PRAZO") {
    return { atividade: "prazo", comentario: "tarefa" };
  }
  if (tipo === "evento" || item?.origem === "evento") {
    return { atividade: "evento", comentario: "evento" };
  }
  return { atividade: "tarefa", comentario: "tarefa" };
}

/** Dados e registros da atividade, com uma única área de rolagem. */
export function AtividadeDetalhesResponsabilidade({ item, itemId, processoId, onClose, onUpdate }: Props) {
  const [secao, setSecao] = useState("dados");
  const [contagemAnexos, setContagemAnexos] = useState(0);
  const { atividade: tipoAtividade, comentario: tipoComentario } = tiposDoItem(item);
  const { data: atividades = [] } = useSubatividades(tipoAtividade, itemId);
  const { data: checklist = [] } = useChecklistItem(tipoAtividade, itemId);
  const { data: totalComentarios = 0 } = useContagemComentarios(tipoComentario, itemId);
  const aoMudarAnexos = useCallback((total: number) => setContagemAnexos(total), []);

  useEffect(() => {
    setSecao("dados");
    setContagemAnexos(0);
  }, [itemId]);

  const concluidas = atividades.filter((atividade) => atividade.situacao === "concluida").length;
  const checklistMarcados = checklist.filter((check) => check.marcado).length;
  const semAbas = String(item?.id ?? "").startsWith("prazo-tst-");

  if (semAbas) {
    return (
      <div className="h-full overflow-y-auto">
        <EdicaoItemPanel key={item.id} item={item} hideHeader embedded onClose={onClose} onUpdate={onUpdate} />
      </div>
    );
  }

  return (
    <Tabs value={secao} onValueChange={setSecao} className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b bg-muted/10 px-4 py-3">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="dados" className="py-2">Dados da atividade</TabsTrigger>
          <TabsTrigger value="atividades" className="py-2">
            Atividades{atividades.length > 0 ? ` ${concluidas}/${atividades.length}` : ""}
          </TabsTrigger>
          <TabsTrigger value="checklist" className="py-2">
            Checklist{checklist.length > 0 ? ` ${checklistMarcados}/${checklist.length}` : ""}
          </TabsTrigger>
          <TabsTrigger value="comentarios" className="py-2">
            Comentários{totalComentarios > 0 ? ` ${totalComentarios}` : ""}
          </TabsTrigger>
          <TabsTrigger value="anexos" className="py-2">
            Anexos{contagemAnexos > 0 ? ` ${contagemAnexos}` : ""}
          </TabsTrigger>
          <TabsTrigger value="historico" className="py-2">Histórico de alterações</TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="dados" className="m-0">
          <EdicaoItemPanel key={item.id} item={item} hideHeader embedded onClose={onClose} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="atividades" className="m-0 p-4">
          <TabErrorBoundary area="as atividades">
            <ItemAtividades tipo={tipoAtividade} itemId={itemId} />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="checklist" className="m-0 p-4">
          <TabErrorBoundary area="o checklist">
            <ItemChecklist tipo={tipoAtividade} itemId={itemId} />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="comentarios" className="m-0 p-4">
          <TabErrorBoundary area="os comentários">
            <ItemComentarios tipo={tipoComentario} itemId={itemId} semRolagemInterna />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="anexos" className="m-0 p-4">
          <TabErrorBoundary area="os anexos">
            <ItemAnexos
              tipo={tipoComentario}
              itemId={itemId}
              processoId={processoId}
              onContagemMudou={aoMudarAnexos}
            />
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="historico" className="m-0 p-4">
          <TabErrorBoundary area="o histórico">
            <ItemHistorico tipo={tipoAtividade} tipoComentario={tipoComentario} itemId={itemId} />
          </TabErrorBoundary>
        </TabsContent>
      </div>
    </Tabs>
  );
}
