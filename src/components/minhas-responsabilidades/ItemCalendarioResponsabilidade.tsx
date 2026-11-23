import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CalendarDays, FileText, Flag, GitBranch, ListChecks, MapPin, Newspaper, Sparkles, UserRound } from "lucide-react";
import { ItemDrawer } from "@/components/agenda/ItemDrawer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ProcessoItensLateral } from "@/components/processos/ProcessoItensLateral";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { corHeaderItem } from "@/lib/tipoItemAgenda";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import { useContagensFichaResponsabilidade } from "@/hooks/useContagensFichaResponsabilidade";
import { ContagemAba } from "@/components/comum/ContagemAba";
import { formatarDataDetalhe, processoTemAcompanhamentoEspecial } from "@/lib/detalheItemResponsabilidade";
import { PublicacoesItemResponsabilidade } from "./PublicacoesItemResponsabilidade";
import { WorkflowItemResponsabilidade } from "./WorkflowItemResponsabilidade";
import { DocumentosProcessoResponsabilidade } from "./DocumentosProcessoResponsabilidade";
import { AtividadeDetalhesResponsabilidade } from "./AtividadeDetalhesResponsabilidade";
import { AcompanhamentoEspecialItemResponsabilidade } from "./AcompanhamentoEspecialItemResponsabilidade";
import { ProcessoVinculadoItemResponsabilidade, type ProcessoVinculoResumo } from "./ProcessoVinculadoItemResponsabilidade";

function ResumoCampo({ icon: Icon, rotulo, valor }: { icon?: typeof CalendarDays; rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-current opacity-60">
        {Icon && <Icon className="h-3 w-3 shrink-0" />} <span className="truncate">{rotulo}</span>
      </dt>
      <dd className="mt-0.5 truncate text-xs font-medium text-current" title={valor}>{valor}</dd>
    </div>
  );
}

interface Props {
  item: any | null;
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
  onItemChange: (item: any) => void;
}

/** Ficha ampla compartilhada por Minhas Responsabilidades e pelo calendário do Painel. */
export function ItemCalendarioResponsabilidade({ item, onClose, onUpdate, onItemChange }: Props) {
  const [aba, setAba] = useState("atividade");
  useEffect(() => setAba("atividade"), [item?.id]);

  const itemId = item?.id ? getItemRawId(String(item.id)) : "";
  const processoId = item?.processo?.id ?? item?.processo_id ?? null;
  const { totalPublicacoes, totalEtapasWorkflow, totalDocumentos } = useContagensFichaResponsabilidade({
    itemId,
    processoId,
  });
  const { data: processoDetalhe } = useQuery({
    queryKey: ["minhas-responsabilidades", "acompanhamento-especial-processo", processoId],
    enabled: !!processoId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo, reclamante, reclamados, autor, requerido, acompanhamento_especial, acompanhamento_ativado_em, acompanhamento_freq_diaria, acompanhamento_com_anexos")
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const processoNumero = processoDetalhe?.numero ?? item?.processo?.numero ?? item?.processo_numero ?? null;
  const partes = item && processoId ? {
    ativo: processoDetalhe?.polo_ativo ?? processoDetalhe?.reclamante ?? processoDetalhe?.autor ?? item.processo?.polo_ativo ?? item.partes_ativas ?? "",
    passivo: processoDetalhe?.polo_passivo ?? processoDetalhe?.reclamados ?? processoDetalhe?.requerido ?? item.processo?.polo_passivo ?? item.partes_passivas ?? "",
  } : null;
  const tipo = String(item?.tipo_tarefa || item?.tipo || "Atividade").replace(/_/g, " ");
  const acompanhamentoAtivo = processoTemAcompanhamentoEspecial(processoDetalhe ?? item?.processo);

  const aoMudarVinculo = (processo: ProcessoVinculoResumo | null) => {
    if (!item) return;
    onItemChange({
      ...item,
      processo_id: processo?.id ?? null,
      processo: processo ? { ...item.processo, ...processo } : null,
      ...(String(item.tipo ?? "") === "audiencia" ? {} : { processo_numero: processo?.numero ?? null }),
    });
  };

  const renderResumo = (classe: string) => (
    <dl className={cn("grid", classe)}>
      <ResumoCampo icon={ListChecks} rotulo="Tipo" valor={tipo} />
      <ResumoCampo icon={Flag} rotulo="Situação" valor={String(item.status ?? "Pendente").replace(/_/g, " ")} />
      <ResumoCampo icon={CalendarDays} rotulo="Data prevista" valor={formatarDataDetalhe(item.data_vencimento ?? item.data_inicio, true)} />
      <ResumoCampo icon={CalendarDays} rotulo="Data fatal" valor={formatarDataDetalhe(item.data_fatal, true)} />
      <ResumoCampo icon={UserRound} rotulo="Meu papel" valor={item._papel === "responsavel" ? "Responsável" : item._papel === "envolvido" ? "Envolvido" : "Participante"} />
      <ResumoCampo icon={MapPin} rotulo="Local / origem" valor={String(item.local ?? item.link_local ?? item.origem_registro ?? item.origem ?? "—").replace(/_/g, " ")} />
    </dl>
  );

  return (
    <ItemDrawer
      open={!!item}
      onOpenChange={(open) => !open && onClose()}
      titulo={item?.titulo || "Detalhe da atividade"}
      processoId={processoId}
      processoNumero={processoNumero}
      partes={partes}
      rotulosPartes={{ ativo: "Polo ativo", passivo: "Polo passivo" }}
      corHeader={item ? corHeaderItem(item) : undefined}
      resumoHeader={item ? renderResumo("ml-auto hidden w-[510px] max-w-[52%] shrink-0 grid-cols-3 gap-x-5 gap-y-2 lg:grid") : undefined}
      className="max-w-none sm:w-[min(1180px,96vw)] lg:w-[min(1180px,96vw)]"
    >
      {item && (
        <div className="flex h-full min-h-0 flex-col">
          {renderResumo("flex-shrink-0 grid-cols-2 gap-x-4 gap-y-3 border-b bg-muted/20 px-5 py-3 text-foreground sm:grid-cols-3 lg:hidden")}

          <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0 border-b px-4 py-2">
              <TabsList className={cn("grid h-auto w-full grid-cols-2 gap-1", acompanhamentoAtivo ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-5")}>
                <TabsTrigger value="atividade" className="gap-2 py-1.5"><ListChecks className="h-4 w-4" /> Atividade</TabsTrigger>
                <TabsTrigger value="processo" className="gap-2 py-1.5"><Briefcase className="h-4 w-4" /> Processo vinculado <ContagemAba valor={processoId ? 1 : 0} /></TabsTrigger>
                {acompanhamentoAtivo && (
                   <TabsTrigger value="acompanhamento" className="gap-2 py-1.5" title="Acompanhamento Especial"><Sparkles className="h-4 w-4" /> Acomp. Especial</TabsTrigger>
                )}
                <TabsTrigger value="publicacoes" className="gap-2 py-1.5"><Newspaper className="h-4 w-4" /> Publicações <ContagemAba valor={totalPublicacoes} /></TabsTrigger>
                <TabsTrigger value="workflow" className="gap-2 py-1.5"><GitBranch className="h-4 w-4" /> Workflow <ContagemAba valor={totalEtapasWorkflow} /></TabsTrigger>
                <TabsTrigger value="documentos" className="gap-2 py-1.5"><FileText className="h-4 w-4" /> Documentos <ContagemAba valor={totalDocumentos} /></TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="atividade" className="m-0 min-h-0 flex-1 overflow-hidden">
              <AtividadeDetalhesResponsabilidade
                item={item}
                itemId={itemId}
                processoId={processoId}
                onClose={onClose}
                onUpdate={onUpdate}
              />
            </TabsContent>

            <TabsContent value="processo" className="m-0 min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0 flex-col">
                <ProcessoVinculadoItemResponsabilidade
                  item={item}
                  processoId={processoId}
                  processoNumero={processoNumero}
                  onVinculoChange={aoMudarVinculo}
                  onUpdate={onUpdate}
                />
                {processoId && (
                  <div className="min-h-0 flex-1">
                    <ProcessoItensLateral
                      processoId={processoId}
                      processoNumero={processoNumero ?? ""}
                      hideHeader
                      onClose={onClose}
                      onNavigate={(id) => window.open(`/processos/${id}`, "_blank", "noopener,noreferrer")}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {acompanhamentoAtivo && (
              <TabsContent value="acompanhamento" className="m-0 min-h-0 flex-1 overflow-y-auto">
                <AcompanhamentoEspecialItemResponsabilidade
                  processo={processoDetalhe ?? { ...item.processo, id: processoId }}
                  active={aba === "acompanhamento"}
                />
              </TabsContent>
            )}

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
