import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Play, Pause, Trash2, History, Clock, Calendar, Settings2, RefreshCw } from "lucide-react";
import { useCofreSenhas } from "@/hooks/useCofreSenhas";
import { CapturaDialog } from "@/components/cofre/CapturaDialog";
import { HistoricoCapturaDialog } from "@/components/cofre/HistoricoCapturaDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
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

export default function CapturasIntimacoes() {
  const { capturas, credenciais, loadingCapturas, criarCaptura, atualizarCaptura, excluirCaptura, buscarHistorico } = useCofreSenhas();
  const [capturaDialogOpen, setCapturaDialogOpen] = useState(false);
  const [capturaParaEditar, setCapturaParaEditar] = useState<any>(null);
  const [capturaParaExcluir, setCapturaParaExcluir] = useState<string | null>(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [capturaHistorico, setCapturaHistorico] = useState<any>(null);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ativo: { label: "Ativo", variant: "default" },
      inativo: { label: "Inativo", variant: "secondary" },
      erro: { label: "Erro", variant: "destructive" },
      executando: { label: "Executando", variant: "outline" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getModoCapturaBadge = (modo: string) => {
    const modoConfig: Record<string, { label: string; icon: React.ReactNode }> = {
      agendado: { label: "Agendado", icon: <Clock className="h-3 w-3" /> },
      intervalo: { label: "Intervalo", icon: <RefreshCw className="h-3 w-3" /> },
      manual: { label: "Manual", icon: <Settings2 className="h-3 w-3" /> },
    };
    const config = modoConfig[modo] || { label: modo, icon: null };
    return (
      <Badge variant="outline" className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDiasSemana = (dias: number[] | null) => {
    if (!dias || dias.length === 0) return "Não configurado";
    if (dias.length === 7) return "Todos os dias";
    if (dias.length === 5 && !dias.includes(0) && !dias.includes(6)) return "Dias úteis";
    
    const nomesDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return dias.map(d => nomesDias[d]).join(", ");
  };

  const formatIntervalo = (minutos: number | null) => {
    if (!minutos) return "";
    if (minutos < 60) return `A cada ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `A cada ${horas}h${mins}min` : `A cada ${horas}h`;
  };

  const handleNovaCaptura = () => {
    setCapturaParaEditar(null);
    setCapturaDialogOpen(true);
  };

  const handleEditarCaptura = (captura: any) => {
    setCapturaParaEditar(captura);
    setCapturaDialogOpen(true);
  };

  const handleSalvarCaptura = async (data: any) => {
    try {
      if (capturaParaEditar) {
        await atualizarCaptura.mutateAsync({ id: capturaParaEditar.id, ...data });
        toast.success("Captura atualizada com sucesso!");
      } else {
        await criarCaptura.mutateAsync(data);
        toast.success("Captura criada com sucesso!");
      }
      setCapturaDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao salvar captura");
    }
  };

  const handleToggleCaptura = async (captura: any) => {
    try {
      await atualizarCaptura.mutateAsync({
        id: captura.id,
        ativo: !captura.ativo,
      });
      toast.success(captura.ativo ? "Captura pausada" : "Captura ativada");
    } catch (error) {
      toast.error("Erro ao alterar status da captura");
    }
  };

  const handleExcluirCaptura = async () => {
    if (!capturaParaExcluir) return;
    try {
      await excluirCaptura.mutateAsync(capturaParaExcluir);
      toast.success("Captura excluída com sucesso!");
      setCapturaParaExcluir(null);
    } catch (error) {
      toast.error("Erro ao excluir captura");
    }
  };

  const handleVerHistorico = (captura: any) => {
    setCapturaHistorico(captura);
    setHistoricoDialogOpen(true);
  };

  const handleExecutarCaptura = async (captura: any) => {
    toast.info("Executando captura...", { description: "Aguarde a conclusão" });
    // TODO: Implementar execução manual da captura
  };

  return (
    <MainLayout title="Capturas de Intimações" subtitle="Configure e gerencie a captura automática de intimações dos tribunais">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Capturas Configuradas
              </CardTitle>
              <CardDescription>
                Configure a captura automática de intimações dos portais dos tribunais
              </CardDescription>
            </div>
            <Button onClick={handleNovaCaptura} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Captura
            </Button>
          </CardHeader>
          <CardContent>
            {loadingCapturas ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : capturas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma captura configurada. Clique em "Nova Captura" para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sistema / Tribunal</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead>Última Captura</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capturas.map((captura) => (
                    <TableRow key={captura.id}>
                      <TableCell>
                        <div className="font-medium">{captura.justica}</div>
                        <div className="text-sm text-muted-foreground">{captura.orgao} - {captura.instancia}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{captura.oab_numero}/{captura.oab_uf}</Badge>
                      </TableCell>
                      <TableCell>
                        {getModoCapturaBadge(captura.modo_captura || 'agendado')}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {captura.modo_captura === 'intervalo' ? (
                            <span>{formatIntervalo(captura.intervalo_minutos)}</span>
                          ) : captura.modo_captura === 'manual' ? (
                            <span className="text-muted-foreground">Execução manual</span>
                          ) : (
                            <>
                              <div>{formatDiasSemana(captura.dias_semana)}</div>
                              <div className="text-muted-foreground">
                                {captura.horarios_execucao?.join(", ") || "Não configurado"}
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {captura.ultima_captura ? (
                          <div className="text-sm">
                            <div>{format(new Date(captura.ultima_captura), "dd/MM/yyyy", { locale: ptBR })}</div>
                            <div className="text-muted-foreground">
                              {format(new Date(captura.ultima_captura), "HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Nunca executada</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(captura.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExecutarCaptura(captura)}
                            title="Executar agora"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleCaptura(captura)}
                            title={captura.ativo ? "Pausar" : "Ativar"}
                          >
                            {captura.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVerHistorico(captura)}
                            title="Ver histórico"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditarCaptura(captura)}
                            title="Editar"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCapturaParaExcluir(captura.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CapturaDialog
        open={capturaDialogOpen}
        onOpenChange={setCapturaDialogOpen}
        captura={capturaParaEditar}
        credenciais={credenciais}
        onSave={handleSalvarCaptura}
      />

      <HistoricoCapturaDialog
        open={historicoDialogOpen}
        onOpenChange={setHistoricoDialogOpen}
        captura={capturaHistorico}
        buscarHistorico={buscarHistorico}
      />

      <AlertDialog open={!!capturaParaExcluir} onOpenChange={() => setCapturaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta captura? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirCaptura} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
