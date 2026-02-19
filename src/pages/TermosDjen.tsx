import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Newspaper, Filter, Search, Users, Power, PowerOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";
import { MonitoramentoDialog } from "@/components/djen/MonitoramentoDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Hook para buscar coordenações do usuário logado (ou todas se admin)
function useCoordenacoesFiltradas(isAdmin: boolean, userId: string | undefined) {
  return useQuery({
    queryKey: ["coordenacoes-usuario", userId, isAdmin],
    queryFn: async () => {
      if (!userId) return [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from("coordenacoes")
          .select("id, nome, area")
          .order("nome");
        if (error) throw error;
        return data || [];
      }

      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id, coordenacoes(id, nome, area)")
        .eq("usuario_id", userId);

      if (error) throw error;

      const coordenacoes = (data || [])
        .map((m: any) => m.coordenacoes)
        .filter(Boolean);

      const seen = new Set<string>();
      return coordenacoes.filter((c: any) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    },
    enabled: !!userId,
  });
}

export default function TermosDjen() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: coordenacoes = [], isLoading: loadingCoordenacoes } = useCoordenacoesFiltradas(
    isAdmin,
    user?.id
  );

  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("__all__");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [tribunalFiltro, setTribunalFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMonitoramento, setEditingMonitoramento] = useState<MonitoramentoDjen | null>(null);

  const {
    monitoramentos: todosMonitoramentos,
    contagensPublicacoes,
    isLoading,
    atualizarMonitoramento,
    excluirMonitoramento,
  } = useMonitoramentosDjen();

  // IDs de coordenações permitidas para este usuário
  const coordenacoesPermitidas = new Set(coordenacoes.map((c: any) => c.id));

  // Criar mapa de nomes de coordenações
  const coordNomeMap = new Map<string, string>(
    coordenacoes.map((c: any) => [c.id, c.nome])
  );

  // Extrair tribunais únicos
  const tribunaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    todosMonitoramentos.forEach((m) => {
      if (m.tribunais && Array.isArray(m.tribunais)) {
        m.tribunais.forEach((t: string) => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [todosMonitoramentos]);

  // Extrair tipos únicos
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    todosMonitoramentos.forEach((m) => { if (m.tipo) set.add(m.tipo); });
    return Array.from(set).sort();
  }, [todosMonitoramentos]);

  // Filtrar monitoramentos pelas coordenações do usuário + filtros ativos
  const monitoramentosFiltrados = useMemo(() => {
    return todosMonitoramentos.filter((m) => {
      // Controle de acesso por coordenação
      if (!m.coordenacao_id) return isAdmin;
      if (!isAdmin && !coordenacoesPermitidas.has(m.coordenacao_id)) return false;

      // Filtro de coordenação selecionado
      if (coordenacaoFiltro !== "__all__" && m.coordenacao_id !== coordenacaoFiltro) return false;

      // Filtro de tipo
      if (tipoFiltro !== "todos" && m.tipo !== tipoFiltro) return false;

      // Filtro de status
      if (statusFiltro === "ativo" && !m.ativo) return false;
      if (statusFiltro === "pausado" && m.ativo) return false;

      // Filtro de tribunal
      if (tribunalFiltro !== "todos") {
        if (tribunalFiltro === "sem-tribunal") {
          if (m.tribunais && m.tribunais.length > 0) return false;
        } else {
          if (!m.tribunais || !m.tribunais.includes(tribunalFiltro)) return false;
        }
      }

      // Busca por termo
      if (termoBusca.trim()) {
        const s = termoBusca.toLowerCase();
        const ok = m.termo_busca?.toLowerCase().includes(s)
          || m.oab?.toLowerCase().includes(s)
          || m.uf?.toLowerCase().includes(s);
        if (!ok) return false;
      }

      return true;
    });
  }, [todosMonitoramentos, isAdmin, coordenacoesPermitidas, coordenacaoFiltro, tipoFiltro, statusFiltro, tribunalFiltro, termoBusca]);

  const filtrosAtivos =
    coordenacaoFiltro !== "__all__" ||
    tipoFiltro !== "todos" ||
    tribunalFiltro !== "todos" ||
    statusFiltro !== "todos" ||
    termoBusca.trim() !== "";

  const limparFiltros = () => {
    setCoordenacaoFiltro("__all__");
    setTipoFiltro("todos");
    setTribunalFiltro("todos");
    setStatusFiltro("todos");
    setTermoBusca("");
  };

  const handleNovo = () => {
    setEditingMonitoramento(null);
    setDialogOpen(true);
  };

  const handleEditar = (m: MonitoramentoDjen) => {
    setEditingMonitoramento(m);
    setDialogOpen(true);
  };

  return (
    <MainLayout
      title="Termos DJEN"
      subtitle="Gerencie os monitoramentos do Diário de Justiça Eletrônico Nacional por termos, advogado ou processo"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Newspaper className="h-5 w-5" />
                  Monitoramentos Cadastrados
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {isAdmin
                    ? `Exibindo todos os monitoramentos de todas as coordenações • ${monitoramentosFiltrados.length} de ${todosMonitoramentos.length}`
                    : `Exibindo monitoramentos das suas coordenações • ${monitoramentosFiltrados.length} de ${todosMonitoramentos.filter(m => m.coordenacao_id && coordenacoesPermitidas.has(m.coordenacao_id)).length}`}
                </CardDescription>
              </div>
              <Button onClick={handleNovo} size="sm" className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Novo Monitoramento
              </Button>
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
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>

                {/* Filtro por coordenação */}
                {coordenacoes.length > 1 && (
                  <Select value={coordenacaoFiltro} onValueChange={setCoordenacaoFiltro}>
                    <SelectTrigger className="w-full sm:w-[200px] h-9">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Coordenação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as coordenações</SelectItem>
                      {coordenacoes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Filtro por tipo */}
                <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
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
                <Select value={tribunalFiltro} onValueChange={setTribunalFiltro}>
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
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="pausado">Pausados</SelectItem>
                  </SelectContent>
                </Select>

                {filtrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading || loadingCoordenacoes ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : monitoramentosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              {filtrosAtivos ? (
                <>
                  <p className="text-muted-foreground font-medium">Nenhum monitoramento encontrado com os filtros aplicados</p>
                  <Button variant="link" onClick={limparFiltros} className="mt-2">Limpar filtros</Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground font-medium">Nenhum monitoramento cadastrado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em "Novo Monitoramento" para começar a configurar alertas do DJEN.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tipo</TableHead>
                    <TableHead>Termo</TableHead>
                    <TableHead className="hidden sm:table-cell">OAB/UF</TableHead>
                    <TableHead className="hidden md:table-cell">Coordenação</TableHead>
                    <TableHead className="hidden md:table-cell">Tribunais</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Publicações</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoramentosFiltrados.map((m) => {
                    const contagem = contagensPublicacoes.find(c => c.monitoramento_id === m.id);
                    const pubCount = contagem?.total || 0;
                    const naoLidas = contagem?.nao_lidas || 0;

                    return (
                      <TableRow key={m.id}>
                        <TableCell className="pl-6">
                          <Badge variant="outline">{m.tipo}</Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px]">
                          <div className="truncate" title={m.termo_busca}>{m.termo_busca}</div>
                          {m.descricao && (
                            <div className="text-xs text-muted-foreground truncate" title={m.descricao}>
                              {m.descricao}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {m.oab && m.uf ? `${m.oab}/${m.uf}` : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {m.coordenacao_id
                            ? coordNomeMap.get(m.coordenacao_id) || m.coordenacao_id.slice(0, 8) + "…"
                            : <span className="text-muted-foreground text-xs">Sem coordenação</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {m.tribunais && m.tribunais.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {m.tribunais.length <= 2 ? (
                                m.tribunais.map((t: string) => (
                                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                                ))
                              ) : (
                                <>
                                  <Badge variant="secondary" className="text-xs">{m.tribunais[0]}</Badge>
                                  <Badge variant="secondary" className="text-xs">+{m.tribunais.length - 1}</Badge>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Todos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.ativo ? "default" : "secondary"}>
                            {m.ativo ? "Ativo" : "Pausado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {pubCount > 0 ? (
                            <span className="flex items-center gap-1">
                              {pubCount}
                              {naoLidas > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {naoLidas} nova{naoLidas > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditar(m)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => atualizarMonitoramento.mutate({ id: m.id, ativo: !m.ativo })}
                              title={m.ativo ? "Pausar" : "Ativar"}
                            >
                              {m.ativo ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Excluir">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir monitoramento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O monitoramento <strong>"{m.termo_busca}"</strong> será excluído
                                    permanentemente, junto com todas as publicações associadas.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => excluirMonitoramento.mutate(m.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        monitoramento={editingMonitoramento}
        coordenacoesOverride={coordenacoes}
      />
    </MainLayout>
  );
}
