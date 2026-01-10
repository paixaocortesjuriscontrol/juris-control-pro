import { useState, useEffect } from "react";
import { Plus, Users, Briefcase, MoreVertical, Mail, Phone, Share2, Trash2, ClipboardList, RefreshCw, ListChecks, Pencil, Check, X, Repeat } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { CoordenacaoDialog } from "@/components/coordenacoes/CoordenacaoDialog";
import { MembroDialog } from "@/components/coordenacoes/MembroDialog";
import { AtribuirProcessoDialog } from "@/components/coordenacoes/AtribuirProcessoDialog";
import { DistribuirProcessoDialog } from "@/components/coordenacoes/DistribuirProcessoDialog";
import { DelegarTarefaDialog } from "@/components/coordenacoes/DelegarTarefaDialog";
import { DelegarTarefaLoteDialog } from "@/components/coordenacoes/DelegarTarefaLoteDialog";
import { ReatribuirProcessoDialog } from "@/components/coordenacoes/ReatribuirProcessoDialog";
import { TransferirProcessosDialog } from "@/components/processos/TransferirProcessosDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
  const [selectedCoord, setSelectedCoord] = useState<any>(null);
  const [coordDialog, setCoordDialog] = useState(false);
  const [editCoord, setEditCoord] = useState<any>(null);
  const [membroDialog, setMembroDialog] = useState(false);
  const [atribuirDialog, setAtribuirDialog] = useState(false);
  const [distribuirDialog, setDistribuirDialog] = useState(false);
  const [delegarTarefaDialog, setDelegarTarefaDialog] = useState(false);
  const [delegarTarefaLoteDialog, setDelegarTarefaLoteDialog] = useState(false);
  const [reatribuirDialog, setReatribuirDialog] = useState(false);
  const [transferirDialog, setTransferirDialog] = useState(false);
  const [removeMembroId, setRemoveMembroId] = useState<string | null>(null);
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [editingCargoValue, setEditingCargoValue] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cargoOptions = [
    "Coordenador",
    "Advogado Sênior",
    "Advogado",
    "Estagiário",
    "Assistente",
    "Secretária",
  ];

  const handleUpdateCargo = async (membroId: string) => {
    try {
      const { error } = await supabase
        .from("membros_coordenacao")
        .update({ cargo: editingCargoValue })
        .eq("id", membroId);

      if (error) throw error;

      toast({ title: "Cargo atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar cargo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEditingCargoId(null);
      setEditingCargoValue("");
    }
  };

  useEffect(() => {
    if (coordenacoes && coordenacoes.length > 0 && !selectedCoord) {
      setSelectedCoord(coordenacoes[0]);
    } else if (selectedCoord && coordenacoes) {
      // Refresh selected coord data
      const updated = coordenacoes.find(c => c.id === selectedCoord.id);
      if (updated) setSelectedCoord(updated);
    }
  }, [coordenacoes, selectedCoord]);

  const handleRemoveMembro = async () => {
    if (!removeMembroId) return;
    
    try {
      const { error } = await supabase
        .from("membros_coordenacao")
        .delete()
        .eq("id", removeMembroId);

      if (error) throw error;

      toast({ title: "Membro removido da equipe" });
      queryClient.invalidateQueries({ queryKey: ["coordenacoes-full"] });
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coordinations List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Equipes</h2>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setDistribuirDialog(true)}
              >
                <Share2 className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Distribuir</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setTransferirDialog(true)}
              >
                <Repeat className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Transferir</span>
              </Button>
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90"
                onClick={() => {
                  setEditCoord(null);
                  setCoordDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Nova</span>
              </Button>
            </div>
          </div>

          {(!coordenacoes || coordenacoes.length === 0) ? (
            <div className="text-center py-12 border rounded-xl">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma coordenação</h3>
              <p className="text-muted-foreground text-sm mb-4">Crie coordenações para organizar sua equipe</p>
              <Button onClick={() => setCoordDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Coordenação
              </Button>
            </div>
          ) : (
            coordenacoes.map((coord, index) => (
              <Card 
                key={coord.id}
                className={cn(
                  "cursor-pointer transition-all border-l-4 hover:shadow-medium animate-slide-up",
                  areaColors[coord.area as keyof typeof areaColors],
                  selectedCoord?.id === coord.id && "ring-2 ring-primary/20"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => setSelectedCoord(coord)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{coord.nome}</h3>
                      <p className="text-sm text-muted-foreground">{coord.coordenador?.nome || "Sem coordenador"}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {areaLabels[coord.area as keyof typeof areaLabels]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Briefcase className="w-4 h-4" />
                      <span className="font-medium text-foreground">{coord.processCount}</span> processos
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="font-medium text-foreground">{coord.membros.length}</span> membros
                    </div>
                    {coord.unassignedCount > 0 && (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                        {coord.unassignedCount} não distribuídos
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Selected Coordination Details */}
        {selectedCoord && (
          <div className="lg:col-span-2 space-y-6">
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditCoord(selectedCoord);
                      setCoordDialog(true);
                    }}
                  >
                    Editar
                  </Button>
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
                    {selectedCoord.membros.map((member: any) => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
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
                                    <option key={cargo} value={cargo}>{cargo}</option>
                                  ))}
                                </select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-green-600"
                                  onClick={() => handleUpdateCargo(member.id)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => {
                                    setEditingCargoId(null);
                                    setEditingCargoValue("");
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 group"
                                onClick={() => {
                                  setEditingCargoId(member.id);
                                  setEditingCargoValue(member.cargo || "Advogado");
                                }}
                              >
                                {member.cargo || "Advogado"}
                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-semibold text-foreground">{member.processCount || 0}</p>
                            <p className="text-xs text-muted-foreground">processos</p>
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
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Process Distribution */}
            {selectedCoord.membros.length > 0 && selectedCoord.processCount > 0 && (
              <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Distribuição de Processos</CardTitle>
                  <CardDescription>
                    Visão geral da carga de trabalho da equipe ({selectedCoord.assignedCount} distribuídos de {selectedCoord.processCount} total)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Unassigned processes indicator */}
                    {selectedCoord.unassignedCount > 0 && (
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
                    
                    {selectedCoord.membros.map((member: any) => {
                      const percentage = selectedCoord.processCount > 0 
                        ? ((member.processCount || 0) / selectedCoord.processCount) * 100 
                        : 0;
                      return (
                        <div key={member.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{member.usuario?.nome || "Membro"}</span>
                            <span className="text-sm text-muted-foreground">
                              {member.processCount || 0} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                selectedCoord.area === "civil" && "bg-area-civil",
                                selectedCoord.area === "trabalhista" && "bg-area-trabalhista",
                                selectedCoord.area === "empresarial" && "bg-area-empresarial"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

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
    </MainLayout>
  );
};

export default Coordenacoes;
