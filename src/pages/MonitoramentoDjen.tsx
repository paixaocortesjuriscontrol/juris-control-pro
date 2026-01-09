import { useState, useMemo } from "react";
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
  Filter,
  Search,
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
import { Input } from "@/components/ui/input";
import { MonitoramentoDialog } from "@/components/djen/MonitoramentoDialog";
import { BackfillJobsPanel } from "@/components/djen/BackfillJobsPanel";
import { AlertasCoordenacaoCard } from "@/components/djen/AlertasCoordenacaoCard";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { supabase } from "@/integrations/supabase/client";

const MonitoramentoDjen = () => {
  const [monitoramentoDialogOpen, setMonitoramentoDialogOpen] = useState(false);
  const [monitoramentoParaEditar, setMonitoramentoParaEditar] = useState<any>(null);
  const [backfillPanelOpen, setBackfillPanelOpen] = useState(false);
  
  // Filtros
  const [coordenacaoFilter, setCoordenacaoFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [tribunalFilter, setTribunalFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [termoSearch, setTermoSearch] = useState("");

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

  // Extrair tribunais únicos de todos os monitoramentos
  const tribunaisDisponiveis = useMemo(() => {
    const tribunaisSet = new Set<string>();
    todosMonitoramentos.forEach((m) => {
      if (m.tribunais && Array.isArray(m.tribunais)) {
        m.tribunais.forEach((t: string) => tribunaisSet.add(t));
      }
    });
    return Array.from(tribunaisSet).sort();
  }, [todosMonitoramentos]);

  // Extrair tipos únicos
  const tiposDisponiveis = useMemo(() => {
    const tiposSet = new Set<string>();
    todosMonitoramentos.forEach((m) => {
      if (m.tipo) tiposSet.add(m.tipo);
    });
    return Array.from(tiposSet).sort();
  }, [todosMonitoramentos]);

  // Aplicar todos os filtros
  const monitoramentos = useMemo(() => {
    return todosMonitoramentos.filter((m) => {
      // Filtro por coordenação
      if (coordenacaoFilter !== "todas" && m.coordenacao_id !== coordenacaoFilter) {
        return false;
      }
      
      // Filtro por tipo
      if (tipoFilter !== "todos" && m.tipo !== tipoFilter) {
        return false;
      }
      
      // Filtro por status
      if (statusFilter !== "todos") {
        if (statusFilter === "ativo" && !m.ativo) return false;
        if (statusFilter === "pausado" && m.ativo) return false;
      }
      
      // Filtro por tribunal
      if (tribunalFilter !== "todos") {
        if (tribunalFilter === "sem-tribunal") {
          if (m.tribunais && m.tribunais.length > 0) return false;
        } else {
          if (!m.tribunais || !m.tribunais.includes(tribunalFilter)) return false;
        }
      }
      
      // Filtro por termo de busca
      if (termoSearch.trim()) {
        const search = termoSearch.toLowerCase();
        const matchTermo = m.termo_busca?.toLowerCase().includes(search);
        const matchDescricao = m.descricao?.toLowerCase().includes(search);
        const matchOab = m.oab?.toLowerCase().includes(search);
        const matchUf = m.uf?.toLowerCase().includes(search);
        if (!matchTermo && !matchDescricao && !matchOab && !matchUf) {
          return false;
        }
      }
      
      return true;
    });
  }, [todosMonitoramentos, coordenacaoFilter, tipoFilter, statusFilter, tribunalFilter, termoSearch]);

  const limparFiltros = () => {
    setCoordenacaoFilter("todas");
    setTipoFilter("todos");
    setTribunalFilter("todos");
    setStatusFilter("todos");
    setTermoSearch("");
  };

  const filtrosAtivos = coordenacaoFilter !== "todas" || tipoFilter !== "todos" || 
    tribunalFilter !== "todos" || statusFilter !== "todos" || termoSearch.trim() !== "";

  return (
    <MainLayout
      title="Monitoramento DJEN"
      subtitle="Configure buscas automáticas no Diário de Justiça Eletrônico Nacional"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  Monitoramentos Automáticos
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Verificação automática 2x ao dia • {monitoramentos.length} de {todosMonitoramentos.length} monitoramentos
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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

            {/* Linha de Filtros */}
            <div className="flex flex-col lg:flex-row gap-2 p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filtros:</span>
              </div>
              
              <div className="flex flex-wrap gap-2 flex-1">
                {/* Busca por termo */}
                <div className="relative w-full sm:w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar termo, OAB..."
                    value={termoSearch}
                    onChange={(e) => setTermoSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                
                {/* Filtro por coordenação */}
                <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9">
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas coordenações</SelectItem>
                    {coordenacoes.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro por tipo */}
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] h-9">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos tipos</SelectItem>
                    {tiposDisponiveis.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro por tribunal */}
                <Select value={tribunalFilter} onValueChange={setTribunalFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9">
                    <SelectValue placeholder="Tribunal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos tribunais</SelectItem>
                    <SelectItem value="sem-tribunal">Sem tribunal (todos)</SelectItem>
                    {tribunaisDisponiveis.map((trib) => (
                      <SelectItem key={trib} value={trib}>{trib}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro por status */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="pausado">Pausados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Botão limpar filtros */}
                {filtrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
                    Limpar
                  </Button>
                )}
              </div>
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
              {filtrosAtivos ? (
                <>
                  <p>Nenhum monitoramento encontrado com os filtros aplicados</p>
                  <Button variant="link" onClick={limparFiltros} className="mt-2">
                    Limpar filtros
                  </Button>
                </>
              ) : (
                <>
                  <p>Nenhum monitoramento configurado</p>
                  <p className="text-sm mt-1">Crie um monitoramento para receber notificações de novas publicações</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tipo</TableHead>
                    <TableHead>Termo</TableHead>
                    <TableHead className="hidden sm:table-cell">OAB/UF</TableHead>
                    <TableHead className="hidden md:table-cell">Tribunais</TableHead>
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
                        <TableCell className="font-medium max-w-[200px]" title={`${mon.termo_busca}\n${mon.descricao || ''}`}>
                          <div className="truncate">{mon.termo_busca}</div>
                          {mon.descricao && (
                            <div className="text-xs text-muted-foreground truncate">{mon.descricao}</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {mon.oab && mon.uf ? `${mon.oab}/${mon.uf}` : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {mon.tribunais && mon.tribunais.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {mon.tribunais.length <= 2 ? (
                                mon.tribunais.map((t: string) => (
                                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                                ))
                              ) : (
                                <>
                                  <Badge variant="secondary" className="text-xs">{mon.tribunais[0]}</Badge>
                                  <Badge variant="secondary" className="text-xs">+{mon.tribunais.length - 1}</Badge>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Todos</span>
                          )}
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

      {/* Card de Alertas por Coordenação */}
      <AlertasCoordenacaoCard coordenacoes={coordenacoes} />

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
