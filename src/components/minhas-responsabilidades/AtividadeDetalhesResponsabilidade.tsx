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
import { useContagemAnexosItem, useContagemHistoricoItem } from "@/hooks/useContagensFichaResponsabilidade";
import { ContagemAba, ContagemParcialAba } from "@/components/comum/ContagemAba";
import { FileText, History, ListChecks, ListTodo, MessageSquare, Paperclip } from "lucide-react";

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
  const [anexosVistos, setAnexosVistos] = useState(false);
  const { atividade: tipoAtividade, comentario: tipoComentario } = tiposDoItem(item);
  const { data: atividades = [] } = useSubatividades(tipoAtividade, itemId);
  const { data: checklist = [] } = useChecklistItem(tipoAtividade, itemId);
  const { data: totalComentarios = 0 } = useContagemComentarios(tipoComentario, itemId);
  const { data: contagemAnexosSalvos = 0 } = useContagemAnexosItem(tipoComentario, itemId);
  const { data: contagemAuditoria = 0 } = useContagemHistoricoItem(itemId);
  const aoMudarAnexos = useCallback((total: number) => {
    setContagemAnexos(total);
    setAnexosVistos(true);
  }, []);

  useEffect(() => {
    setSecao("dados");
    setContagemAnexos(0);
    setAnexosVistos(false);
  }, [itemId]);

  const concluidas = atividades.filter((atividade) => atividade.situacao === "concluida").length;
  const checklistMarcados = checklist.filter((check) => check.marcado).length;
  // Antes de abrir a aba vale a contagem do banco; depois vale o que está na tela.
  const totalAnexos = anexosVistos ? contagemAnexos : contagemAnexosSalvos;
  const totalHistorico = contagemAuditoria + totalComentarios;
  const semAbas = String(item?.id ?? "").startsWith("prazo-tst-");

  if (semAbas) {
    return (
      <div className="h-full overflow-y-auto">
        <EdicaoItemPanel key={item.id} item={item} hideHeader embedded processoNaAba onClose={onClose} onUpdate={onUpdate} />
      </div>
    );
  }

  return (
    <Tabs value={secao} onValueChange={setSecao} className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b px-4 py-2">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="dados" className="gap-2 py-1.5"><FileText className="h-4 w-4" /> Dados da atividade</TabsTrigger>
          <TabsTrigger value="atividades" className="gap-2 py-1.5">
            <ListTodo className="h-4 w-4" /> Atividades <ContagemParcialAba feitos={concluidas} total={atividades.length} />
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2 py-1.5">
            <ListChecks className="h-4 w-4" /> Checklist <ContagemParcialAba feitos={checklistMarcados} total={checklist.length} />
          </TabsTrigger>
          <TabsTrigger value="comentarios" className="gap-2 py-1.5">
            <MessageSquare className="h-4 w-4" /> Comentários <ContagemAba valor={totalComentarios} />
          </TabsTrigger>
          <TabsTrigger value="anexos" className="gap-2 py-1.5">
            <Paperclip className="h-4 w-4" /> Anexos <ContagemAba valor={totalAnexos} />
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 py-1.5"><History className="h-4 w-4" /> Histórico de alterações <ContagemAba valor={totalHistorico} /></TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="dados" className="m-0">
          <EdicaoItemPanel key={item.id} item={item} hideHeader embedded processoNaAba onClose={onClose} onUpdate={onUpdate} />
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
