import { useEffect, useState } from "react";
import { Briefcase, CalendarDays, FileText, Flag, GitBranch, ListChecks, MapPin, Newspaper, UserRound } from "lucide-react";
import { ItemDrawer } from "@/components/agenda/ItemDrawer";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import { ProcessoItensLateral } from "@/components/processos/ProcessoItensLateral";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { corHeaderItem } from "@/lib/tipoItemAgenda";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import { formatarDataDetalhe } from "@/lib/detalheItemResponsabilidade";
import { PublicacoesItemResponsabilidade } from "./PublicacoesItemResponsabilidade";
import { WorkflowItemResponsabilidade } from "./WorkflowItemResponsabilidade";
import { DocumentosProcessoResponsabilidade } from "./DocumentosProcessoResponsabilidade";

function ResumoCampo({ icon: Icon, rotulo, valor }: { icon?: typeof CalendarDays; rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {rotulo}
      </dt>
      <dd className="mt-1 truncate text-xs font-medium text-foreground" title={valor}>{valor}</dd>
    </div>
  );
}

interface Props {
  item: any | null;
  onClose: () => void;
  onUpdate: () => void;
}

/** Ficha ampla usada somente pelo calendário de Minhas Responsabilidades. */
export function ItemCalendarioResponsabilidade({ item, onClose, onUpdate }: Props) {
  const [aba, setAba] = useState("atividade");
  useEffect(() => setAba("atividade"), [item?.id]);

  const itemId = item?.id ? getItemRawId(String(item.id)) : "";
  const processoId = item?.processo?.id ?? item?.processo_id ?? null;
  const processoNumero = item?.processo?.numero ?? item?.processo_numero ?? null;
  const partes = item ? {
    ativo: item.processo?.polo_ativo ?? item.partes_ativas ?? "",
    passivo: item.processo?.polo_passivo ?? item.partes_passivas ?? "",
  } : null;
  const tipo = String(item?.tipo_tarefa || item?.tipo || "Atividade").replace(/_/g, " ");

  return (
    <ItemDrawer
      open={!!item}
      onOpenChange={(open) => !open && onClose()}
      titulo={item?.titulo || "Detalhe da atividade"}
      processoId={processoId}
      processoNumero={processoNumero}
      partes={partes}
      corHeader={item ? corHeaderItem(item) : undefined}
      className="max-w-none sm:w-[min(1180px,96vw)] lg:w-[min(1180px,96vw)]"
    >
      {item && (
        <div className="flex h-full min-h-0 flex-col">
          <dl className="grid flex-shrink-0 grid-cols-2 gap-x-4 gap-y-3 border-b bg-muted/20 px-5 py-3 sm:grid-cols-3 lg:grid-cols-6">
            <ResumoCampo icon={ListChecks} rotulo="Tipo" valor={tipo} />
            <ResumoCampo icon={Flag} rotulo="Situação" valor={String(item.status ?? "Pendente").replace(/_/g, " ")} />
            <ResumoCampo icon={CalendarDays} rotulo="Data prevista" valor={formatarDataDetalhe(item.data_vencimento ?? item.data_inicio, true)} />
            <ResumoCampo icon={CalendarDays} rotulo="Data fatal" valor={formatarDataDetalhe(item.data_fatal, true)} />
            <ResumoCampo icon={UserRound} rotulo="Meu papel" valor={item._papel === "responsavel" ? "Responsável" : item._papel === "envolvido" ? "Envolvido" : "Participante"} />
            <ResumoCampo icon={MapPin} rotulo="Local / origem" valor={String(item.local ?? item.link_local ?? item.origem_registro ?? item.origem ?? "—").replace(/_/g, " ")} />
          </dl>

          <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0 border-b px-4 py-3">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
                <TabsTrigger value="atividade" className="gap-2 py-2"><ListChecks className="h-4 w-4" /> Atividade</TabsTrigger>
                <TabsTrigger value="processo" className="gap-2 py-2"><Briefcase className="h-4 w-4" /> Processo</TabsTrigger>
                <TabsTrigger value="publicacoes" className="gap-2 py-2"><Newspaper className="h-4 w-4" /> Publicações</TabsTrigger>
                <TabsTrigger value="workflow" className="gap-2 py-2"><GitBranch className="h-4 w-4" /> Workflow</TabsTrigger>
                <TabsTrigger value="documentos" className="gap-2 py-2"><FileText className="h-4 w-4" /> Documentos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="atividade" className="m-0 min-h-0 flex-1 overflow-hidden">
              <EdicaoItemPanel key={item.id} item={item} hideHeader onClose={onClose} onUpdate={onUpdate} />
            </TabsContent>

            <TabsContent value="processo" className="m-0 min-h-0 flex-1 overflow-hidden">
              {processoId ? (
                <ProcessoItensLateral
                  processoId={processoId}
                  processoNumero={processoNumero ?? ""}
                  hideHeader
                  onClose={onClose}
                  onNavigate={(id) => window.open(`/processos/${id}`, "_blank", "noopener,noreferrer")}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <Briefcase className="mb-3 h-10 w-10 text-muted-foreground" />
                  <h3 className="font-medium">Nenhum processo cadastrado</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Esta atividade não está vinculada a um processo do sistema.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="publicacoes" className="m-0 min-h-0 flex-1 overflow-y-auto">
              <PublicacoesItemResponsabilidade itemId={itemId} processoId={processoId} active={aba === "publicacoes"} />
            </TabsContent>

            <TabsContent value="workflow" className="m-0 min-h-0 flex-1 overflow-y-auto">
              <WorkflowItemResponsabilidade itemId={itemId} active={aba === "workflow"} />
            </TabsContent>

            <TabsContent value="documentos" className="m-0 min-h-0 flex-1 overflow-y-auto">
              <DocumentosProcessoResponsabilidade
                processoId={processoId}
                processoNumero={processoNumero}
                active={aba === "documentos"}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ItemDrawer>
  );
}
