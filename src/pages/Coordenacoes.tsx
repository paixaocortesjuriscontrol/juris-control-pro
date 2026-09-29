import { useState, useEffect } from "react";
import { Plus, Users, Briefcase, MoreVertical, Mail, Phone, Share2, Trash2, ClipboardList, RefreshCw, ListChecks, Pencil, Check, X, Repeat, Globe, FileSpreadsheet, FileType, ShieldCheck, ArrowUpRight, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { CoordenacaoDialog } from "@/components/coordenacoes/CoordenacaoDialog";
import { MembroDialog } from "@/components/coordenacoes/MembroDialog";
import { AtribuirProcessoDialog } from "@/components/coordenacoes/AtribuirProcessoDialog";
import { DistribuirProcessoDialog } from "@/components/coordenacoes/DistribuirProcessoDialog";
import { DelegarTarefaDialog } from "@/components/coordenacoes/DelegarTarefaDialog";
import { DelegarTarefaLoteDialog } from "@/components/coordenacoes/DelegarTarefaLoteDialog";
import { ReatribuirProcessoDialog } from "@/components/coordenacoes/ReatribuirProcessoDialog";
import { PautasExcelDialog } from "@/components/coordenacoes/PautasExcelDialog";
import { NivelAcessoDialog } from "@/components/coordenacoes/NivelAcessoDialog";
import { ResponsaveisFixosTipoDialog } from "@/components/coordenacoes/ResponsaveisFixosTipoDialog";
import { PermissoesSituacaoDialog } from "@/components/coordenacoes/PermissoesSituacaoDialog";
import { PermissoesReagendamentoDialog } from "@/components/coordenacoes/PermissoesReagendamentoDialog";
import { AlteracaoItensTerceirosDialog } from "@/components/coordenacoes/AlteracaoItensTerceirosDialog";
import { ConfigAcompanhamentoEspecialDialog } from "@/components/coordenacoes/ConfigAcompanhamentoEspecialDialog";
import { TransferirProcessosDialog } from "@/components/processos/TransferirProcessosDialog";
import { supabase } from "@/integrations/supabase/client";
import { exportarCoordenacoesExcel } from "@/lib/exportCoordenacoesExcel";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BeatrizCostaImportTab } from "@/components/importar/BeatrizCostaImportTab";
import { COORDENACAO_BEATRIZ_COSTA_ID } from "@/constants/coordenacoesEspeciais";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const areaColors = {
  civil: "border-l-area-civil bg-area-civil/5",
  trabalhista: "border-l-area-trabalhista bg-area-trabalhista/5",
  empresarial: "border-l-area-empresarial bg-area-empresarial/5",
};

const areaLabels = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const Coordenacoes = () => {
  const { data: coordenacoes, isLoading } = useCoordenacoesFull();
  const { isAdmin, isAdminOrCoordinator } = useUserRole();
  const [selectedCoord, setSelectedCoord] = useState<any>(null);
  const [coordDialog, setCoordDialog] = useState(false);
  const [editCoord, setEditCoord] = useState<any>(null);
  const [membroDialog, setMembroDialog] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [atribuirDialog, setAtribuirDialog] = useState(false);
  const [distribuirDialog, setDistribuirDialog] = useState(false);
  const [delegarTarefaDialog, setDelegarTarefaDialog] = useState(false);
  const [delegarTarefaLoteDialog, setDelegarTarefaLoteDialog] = useState(false);
  const [reatribuirDialog, setReatribuirDialog] = useState(false);
  const [pautasExcelDialog, setPautasExcelDialog] = useState(false);
  const [transferirDialog, setTransferirDialog] = useState(false);
  const [respFixosDialog, setRespFixosDialog] = useState(false);
  const [permSituacaoDialog, setPermSituacaoDialog] = useState(false);
  const [permReagendamentoDialog, setPermReagendamentoDialog] = useState(false);
  const [altTerceirosDialog, setAltTerceirosDialog] = useState(false);
  const [configAcompDialog, setConfigAcompDialog] = useState(false);
  const [nivelAcessoMembro, setNivelAcessoMembro] = useState<any>(null);
  const [removeMembroId, setRemoveMembroId] = useState<string | null>(null);
  const [deleteCoordId, setDeleteCoordId] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [importSelCoord, setImportSelCoord] = useState("");
  const [importSelMembro, setImportSelMembro] = useState("");
  const [importSelCliente, setImportSelCliente] = useState("");
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [editingCargoValue, setEditingCargoValue] = useState<string>("");
  const [savingCargoId, setSavingCargoId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteCoordenacao = async () => {
    if (!deleteCoordId) return;
    try {
      const { error } = await supabase
        .from("coordenacoes")
        .delete()
        .eq("id", deleteCoordId);
      if (error) throw error;
      toast({ title: "Coordenação excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      if (selectedCoord?.id === deleteCoordId) setSelectedCoord(null);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir coordenação",
        description: error.message?.includes("foreign key") 
          ? "Esta coordenação possui processos, membros ou monitoramentos vinculados. Transfira-os antes de excluir."
          : error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteCoordId(null);
    }
  };

  const cargoOptions = [
    { value: "coordenador", label: "Coordenador" },
    { value: "assistente_coordenador", label: "Assistente Coordenador" },
    { value: "advogado_senior", label: "Advogado Sênior" },
    { value: "advogado", label: "Advogado" },
    { value: "estagiario", label: "Estagiário" },
    { value: "assistente", label: "Assistente" },
    { value: "secretaria", label: "Secretária" },
  ];

  const normalizeCargo = (cargo?: string | null) => {
    const normalized = String(cargo || "advogado")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    return cargoOptions.some((option) => option.value === normalized) ? normalized : "advogado";
  };

  const cargoLabel = (cargo?: string | null) =>
    cargoOptions.find((option) => option.value === normalizeCargo(cargo))?.label || "Advogado";

  const handleUpdateCargo = async (membroId: string) => {
    setSavingCargoId(membroId);
    try {
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .update({ cargo: editingCargoValue })
        .eq("id", membroId)
        .select("id, cargo")
        .maybeSingle();

      if (error) throw error;
      if (!data || normalizeCargo(data.cargo) !== editingCargoValue) {
        throw new Error("A alteração não foi autorizada para esta coordenação.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] }),
        queryClient.invalidateQueries({ queryKey: ["usuarios-coordenacao", "v2", selectedCoord?.id] }),
      ]);
      toast({ title: "Cargo atualizado com sucesso" });
      setEditingCargoId(null);
      setEditingCargoValue("");
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar cargo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingCargoId(null);
    }
  };

  useEffect(() => {
    if (!selectedCoord || !coordenacoes) return;
    const updated = coordenacoes.find((coord) => coord.id === selectedCoord.id);
    if (updated && updated !== selectedCoord) setSelectedCoord(updated);
  }, [coordenacoes, selectedCoord]);

  const handleRemoveMembro = async () => {
    if (!removeMembroId) return;
    
    try {
      const { error } = await supabase
        .from("membros_coordenacao")
        .delete()
        .eq("id", removeMembroId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
      toast({ title: "Membro removido da equipe" });
    } catch (error: any) {
      toast({
        title: "Erro ao remover membro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemoveMembroId(null);
    }
  };

  if (isLoading) {
    return (
      <MainLayout 
        title="Coordenações" 
        subtitle="Gestão de equipes e distribuição de processos"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      </MainLayout>
    );
  }

  const getInitials = (name: string) => {
    return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "ND";
  };

  return (
    <MainLayout 
      title="Coordenações" 
      subtitle="Gestão de equipes e distribuição de processos"
    >
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">Equipes</h2>
            <p className="text-sm text-muted-foreground">{coordenacoes?.length || 0} coordenações cadastradas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDistribuirDialog(true)}>
              <Share2 className="w-4 h-4 mr-1.5" />Distribuir
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTransferirDialog(true)}>
              <Repeat className="w-4 h-4 mr-1.5" />Transferir
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={exportando}
              onClick={async () => {
                setExportando(true);
                try {
                  await exportarCoordenacoesExcel();
                  toast({ title: "Relatório de coordenações exportado!" });
                } catch (error: any) {
                  toast({ title: "Erro ao exportar relatório", description: error.message, variant: "destructive" });
                } finally {
                  setExportando(false);
                }
              }}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />{exportando ? "Gerando..." : "Relatório"}
            </Button>
            <Button size="sm" onClick={() => { setEditCoord(null); setCoordDialog(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />Nova coordenação
            </Button>
          </div>
        </div>

        {(!coordenacoes || coordenacoes.length === 0) ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma coordenação</h3>
            <p className="text-muted-foreground text-sm mb-4">Crie coordenações para organizar sua equipe</p>
            <Button onClick={() => setCoordDialog(true)}><Plus className="w-4 h-4 mr-2" />Criar Coordenação</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {coordenacoes.map((coord, index) => (
              <Card
                key={coord.id}
                role="button"
                tabIndex={0}
                aria-label={`Abrir coordenação ${coord.nome}`}
                className={cn(
                  "group cursor-pointer border-l-4 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-slide-up",
                  areaColors[coord.area as keyof typeof areaColors]
                )}
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                onClick={() => setSelectedCoord(coord)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedCoord(coord);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="secondary" className="mb-2 text-[11px]">
                        {areaLabels[coord.area as keyof typeof areaLabels]}
                      </Badge>
                      <h3 className="font-serif font-semibold leading-snug text-foreground line-clamp-2">{coord.nome}</h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{coord.coordenador?.nome || "Sem coordenador"}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
                    <div><p className="text-lg font-semibold text-foreground">{coord.processCount}</p><p className="text-[11px] text-muted-foreground">processos</p></div>
                    <div><p className="text-lg font-semibold text-foreground">{coord.membros.length}</p><p className="text-[11px] text-muted-foreground">membros</p></div>
                  </div>
                  <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1.5">
                    {coord.unassignedCount > 0 && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-200">{coord.unassignedCount} Não distribuídos</Badge>}
                    {coord.monitorar_redistribuicoes && <Badge variant="outline" className="text-[10px] gap-1"><RefreshCw className="w-3 h-3" />Redist.</Badge>}
                    {coord.monitorar_distribuicoes && <Badge variant="outline" className="text-[10px] gap-1"><Globe className="w-3 h-3" />Distrib.</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Sheet open={!!selectedCoord} onOpenChange={(open) => { if (!open) setSelectedCoord(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[min(920px,calc(100vw-3rem))]">
          {selectedCoord && (
            <div className="space-y-5 p-5 pr-6 sm:p-7 sm:pr-8">
              <SheetHeader className="pr-8">
                <SheetTitle className="sr-only">{selectedCoord.nome}</SheetTitle>
                <SheetDescription className="sr-only">Dados e gestão da equipe selecionada</SheetDescription>
              </SheetHeader>
            {/* Coordinator Info */}
            <Card className="animate-fade-in">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                        {getInitials(selectedCoord.coordenador?.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="font-serif">{selectedCoord.nome}</CardTitle>
                      <CardDescription className="mt-1">
                        Coordenador: {selectedCoord.coordenador?.nome || "Não definido"}
                      </CardDescription>
                      {selectedCoord.coordenador && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
                          {selectedCoord.coordenador.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span className="truncate max-w-[200px]">{selectedCoord.coordenador.email}</span>
                            </span>
                          )}
                          {selectedCoord.coordenador.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {selectedCoord.coordenador.telefone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditCoord(selectedCoord);
                        setCoordDialog(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    {isAdmin && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteCoordId(selectedCoord.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Team Members */}
            <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="font-serif text-lg">Membros da Equipe</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {selectedCoord.membros.length > 0 && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setAtribuirDialog(true)}
                        >
                          <Briefcase className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Atribuir</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setReatribuirDialog(true)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Reatribuir</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setDelegarTarefaDialog(true)}
                        >
                          <ClipboardList className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Delegar Tarefa</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setDelegarTarefaLoteDialog(true)}
                        >
                          <ListChecks className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Tarefa em Lote</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPautasExcelDialog(true)}
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Pautas Excel</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRespFixosDialog(true)}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Responsáveis Fixos</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPermSituacaoDialog(true)}
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Permissões de Situação</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPermReagendamentoDialog(true)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Quem Pode Reagendar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAltTerceirosDialog(true)}
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Alterar Itens de Outros</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfigAcompDialog(true)}
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Acompanhamento Especial</span>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/modelos-titulo">
                            <FileType className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Modelos de Título</span>
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setMembroDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Adicionar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedCoord.membros.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>Nenhum membro cadastrado nesta coordenação</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => setMembroDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Membro
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCoord.membros.map((member: any) => {
                      const percentage = selectedCoord.processCount > 0
                        ? ((member.processCount || 0) / selectedCoord.processCount) * 100
                        : 0;
                      return (
                      <div 
                        key={member.id}
                        className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                       <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {getInitials(member.usuario?.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{member.usuario?.nome || "Membro"}</p>
                            {editingCargoId === member.id ? (
                              <div className="flex items-center gap-1 mt-1">
                                <select
                                  value={editingCargoValue}
                                  onChange={(e) => setEditingCargoValue(e.target.value)}
                                  className="text-sm border rounded px-2 py-1 bg-background"
                                  autoFocus
                                >
                                  {cargoOptions.map((cargo) => (
                                    <option key={cargo.value} value={cargo.value}>{cargo.label}</option>
                                  ))}
                                </select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-green-600"
                                  disabled={savingCargoId === member.id}
                                  onClick={() => handleUpdateCargo(member.id)}
                                  title="Salvar cargo"
                                >
                                  {savingCargoId === member.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => {
                                    setEditingCargoId(null);
                                    setEditingCargoValue("");
                                  }}
                                  title="Cancelar alteração"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="group -ml-2 h-7 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingCargoId(member.id);
                                  setEditingCargoValue(normalizeCargo(member.cargo));
                                }}
                              >
                                {cargoLabel(member.cargo)}
                                <Pencil className="ml-1 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-foreground">{member.processCount || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              processos{selectedCoord.processCount > 0 ? ` (${percentage.toFixed(0)}%)` : ""}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setAtribuirDialog(true)}>
                                <Briefcase className="w-4 h-4 mr-2" />
                                Atribuir processo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setReatribuirDialog(true)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reatribuir processos
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDelegarTarefaDialog(true)}>
                                <ClipboardList className="w-4 h-4 mr-2" />
                                Delegar tarefa
                              </DropdownMenuItem>
                              {isAdminOrCoordinator && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setNivelAcessoMembro(member)}>
                                    <ShieldCheck className="w-4 h-4 mr-2" />
                                    Nível de Acesso
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setRemoveMembroId(member.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remover da equipe
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                       </div>
                       {selectedCoord.processCount > 0 && (
                         <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                           <div
                             className={cn(
                               "h-full rounded-full transition-all duration-500",
                               "bg-primary",
                               selectedCoord.area === "civil" && "bg-area-civil",
                               selectedCoord.area === "trabalhista" && "bg-area-trabalhista",
                               selectedCoord.area === "empresarial" && "bg-area-empresarial"
                             )}
                             style={{ width: `${percentage}%` }}
                           />
                         </div>
                       )}
                      </div>
                      );
                    })}
                    {selectedCoord.processCount > 0 && selectedCoord.unassignedCount > 0 && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Não distribuídos</span>
                          <span className="text-sm text-amber-600 dark:text-amber-500">
                            {selectedCoord.unassignedCount} ({((selectedCoord.unassignedCount / selectedCoord.processCount) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${(selectedCoord.unassignedCount / selectedCoord.processCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <CoordenacaoDialog 
        open={coordDialog} 
        onOpenChange={setCoordDialog} 
        coordenacao={editCoord}
      />

      {selectedCoord && (
        <>
          <MembroDialog
            open={membroDialog}
            onOpenChange={setMembroDialog}
            coordenacaoId={selectedCoord.id}
            membrosAtuais={selectedCoord.membros.map((m: any) => m.usuario?.id).filter(Boolean)}
          />

          <AtribuirProcessoDialog
            open={atribuirDialog}
            onOpenChange={setAtribuirDialog}
            coordenacaoId={selectedCoord.id}
            membros={selectedCoord.membros}
          />

          <DelegarTarefaDialog
            open={delegarTarefaDialog}
            onOpenChange={setDelegarTarefaDialog}
            coordenacaoId={selectedCoord.id}
            membros={selectedCoord.membros}
          />

          <DelegarTarefaLoteDialog
            open={delegarTarefaLoteDialog}
            onOpenChange={setDelegarTarefaLoteDialog}
            coordenacaoId={selectedCoord.id}
            membros={selectedCoord.membros}
          />

          <ReatribuirProcessoDialog
            open={reatribuirDialog}
            onOpenChange={setReatribuirDialog}
            coordenacaoId={selectedCoord.id}
            membros={selectedCoord.membros}
          />

          <PautasExcelDialog
            open={pautasExcelDialog}
            onOpenChange={setPautasExcelDialog}
            coordenacaoId={selectedCoord.id}
            coordenacaoNome={selectedCoord.nome}
          />

          <ResponsaveisFixosTipoDialog
            open={respFixosDialog}
            onOpenChange={setRespFixosDialog}
            coordenacaoId={selectedCoord.id}
            coordenacaoNome={selectedCoord.nome}
            membros={selectedCoord.membros}
          />

          <PermissoesSituacaoDialog
            open={permSituacaoDialog}
            onOpenChange={setPermSituacaoDialog}
            coordenacaoId={selectedCoord.id}
            coordenacaoNome={selectedCoord.nome}
          />

          <AlteracaoItensTerceirosDialog
            open={altTerceirosDialog}
            onOpenChange={setAltTerceirosDialog}
            coordenacaoId={selectedCoord.id}
            coordenacaoNome={selectedCoord.nome}
          />

          <PermissoesReagendamentoDialog
            open={permReagendamentoDialog}
            onOpenChange={setPermReagendamentoDialog}
            coordenacaoId={selectedCoord.id}
            coordenacaoNome={selectedCoord.nome}
          />

          <ConfigAcompanhamentoEspecialDialog
            open={configAcompDialog}
            onOpenChange={setConfigAcompDialog}
            coordenacaoId={selectedCoord.id}
            coordenacaoNome={selectedCoord.nome}
          />

        </>
      )}

      <DistribuirProcessoDialog
        open={distribuirDialog}
        onOpenChange={setDistribuirDialog}
      />

      <TransferirProcessosDialog
        open={transferirDialog}
        onOpenChange={setTransferirDialog}
      />

      <NivelAcessoDialog
        open={!!nivelAcessoMembro}
        onOpenChange={(open) => !open && setNivelAcessoMembro(null)}
        usuarioId={nivelAcessoMembro?.usuario?.id ?? null}
        usuarioNome={nivelAcessoMembro?.usuario?.nome ?? null}
        membroEhAdmin={String(nivelAcessoMembro?.cargo || "").toLowerCase().includes("admin")}
        membroEhCoordenador={String(nivelAcessoMembro?.cargo || "").toLowerCase().includes("coordenador")}
      />

      {/* Confirm Remove Member Dialog */}
      <AlertDialog open={!!removeMembroId} onOpenChange={() => setRemoveMembroId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro da equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover o membro desta coordenação. Os processos atribuídos a ele permanecerão sob sua responsabilidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMembro} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Coordination Dialog */}
      <AlertDialog open={!!deleteCoordId} onOpenChange={() => setDeleteCoordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coordenação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A coordenação será excluída permanentemente.
              Certifique-se de que não há processos, membros ou monitoramentos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCoordenacao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Coordenacoes;
