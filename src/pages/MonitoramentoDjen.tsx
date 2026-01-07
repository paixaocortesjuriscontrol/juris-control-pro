import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  Plus,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  History,
  Users,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonitoramentoDialog } from "@/components/djen/MonitoramentoDialog";
import { BackfillJobsPanel } from "@/components/djen/BackfillJobsPanel";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { supabase } from "@/integrations/supabase/client";

const MonitoramentoDjen = () => {
  const [monitoramentoDialogOpen, setMonitoramentoDialogOpen] = useState(false);
  const [monitoramentoParaEditar, setMonitoramentoParaEditar] = useState<any>(null);
  const [backfillPanelOpen, setBackfillPanelOpen] = useState(false);
  const [coordenacaoFilter, setCoordenacaoFilter] = useState("todas");

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ['coordenacoes-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coordenacoes')
        .select('id, nome')
        .order('nome');
      return data || [];
    },
  });

  const { 
    monitoramentos: todosMonitoramentos, 
    publicacoes: publicacoesMonitoradas,
    atualizarMonitoramento, 
    excluirMonitoramento,
    isLoading
  } = useMonitoramentosDjen();

  // Filtrar monitoramentos por coordenação
  const monitoramentos = coordenacaoFilter === "todas"
    ? todosMonitoramentos
    : todosMonitoramentos.filter(m => m.coordenacao_id === coordenacaoFilter);

  return (
    <MainLayout
      title="Monitoramento DJEN"
      subtitle="Configure buscas automáticas no Diário de Justiça Eletrônico Nacional"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                Monitoramentos Automáticos
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Verificação automática 2x ao dia
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações</SelectItem>
                  {coordenacoes.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => setBackfillPanelOpen(!backfillPanelOpen)} 
                variant="outline" 
                size="sm" 
                className="w-full sm:w-auto"
              >
                <History className="w-4 h-4 mr-2" />
                {backfillPanelOpen ? "Ocultar Backfill" : "Backfill Histórico"}
              </Button>
              <Button onClick={() => setMonitoramentoDialogOpen(true)} size="sm" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Novo Monitoramento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backfill Jobs Panel */}
          {backfillPanelOpen && (
            <BackfillJobsPanel monitoramentos={monitoramentos} enabled={backfillPanelOpen} />
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Carregando monitoramentos...</p>
            </div>
          ) : monitoramentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum monitoramento configurado</p>
              <p className="text-sm mt-1">Crie um monitoramento para receber notificações de novas publicações</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tipo</TableHead>
                    <TableHead>Termo</TableHead>
                    <TableHead className="hidden sm:table-cell">OAB/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Publicações</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoramentos.map((mon) => {
                    const pubCount = publicacoesMonitoradas.filter(p => p.monitoramento_id === mon.id).length;
                    const naoLidas = publicacoesMonitoradas.filter(p => p.monitoramento_id === mon.id && !p.lida).length;
                    
                    return (
                      <TableRow key={mon.id}>
                        <TableCell className="pl-6">
                          <Badge variant="outline">{mon.tipo}</Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={mon.descricao || mon.termo_busca}>
                          {mon.descricao || mon.termo_busca}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {mon.oab && mon.uf ? `${mon.oab}/${mon.uf}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mon.ativo ? "default" : "secondary"}>
                            {mon.ativo ? "Ativo" : "Pausado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {pubCount > 0 && (
                            <span className="flex items-center gap-1">
                              {pubCount} 
                              {naoLidas > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {naoLidas} nova{naoLidas > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </span>
                          )}
                          {pubCount === 0 && <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setMonitoramentoParaEditar(mon);
                                setMonitoramentoDialogOpen(true);
                              }}
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => atualizarMonitoramento.mutate({ 
                                id: mon.id, 
                                ativo: !mon.ativo 
                              })}
                              title={mon.ativo ? "Pausar" : "Ativar"}
                            >
                              {mon.ativo ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => excluirMonitoramento.mutate(mon.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MonitoramentoDialog
        open={monitoramentoDialogOpen}
        onOpenChange={(open) => {
          setMonitoramentoDialogOpen(open);
          if (!open) setMonitoramentoParaEditar(null);
        }}
        monitoramento={monitoramentoParaEditar}
      />
    </MainLayout>
  );
};

export default MonitoramentoDjen;
