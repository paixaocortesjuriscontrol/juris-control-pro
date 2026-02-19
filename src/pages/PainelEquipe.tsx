import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  BarChart3,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useEquipeTarefasStats,
  useEquipeTarefas,
  useMinhasCoordenacoes,
} from "@/hooks/useEquipeTarefas";
import { useUserRole } from "@/hooks/useUserRole";
import { TarefaDetalhesDialog } from "@/components/prazos/TarefaDetalhesDialog";
import type { Prazo } from "@/hooks/usePrazos";

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export default function PainelEquipe() {
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("all");
  const [selectedMembro, setSelectedMembro] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [selectedTarefa, setSelectedTarefa] = useState<Prazo | null>(null);
  const [detalhesDialogOpen, setDetalhesDialogOpen] = useState(false);

  const { isAdmin } = useUserRole();
  const { data: coordenacoes, isLoading: loadingCoord } = useMinhasCoordenacoes();

  // IDs de coordenações autorizadas do usuário logado
  const allCoordenacaoIds = useMemo(() =>
    coordenacoes?.map(c => c.id) || [],
    [coordenacoes]
  );

  // Coordenação efetiva: se selecionou uma específica, usa ela;
  // se não e tem apenas uma, auto-seleciona ela; senão "all"
  const effectiveCoordenacao = useMemo(() => {
    if (selectedCoordenacao !== "all") return selectedCoordenacao;
    if (!loadingCoord && allCoordenacaoIds.length === 1) return allCoordenacaoIds[0];
    return "all";
  }, [selectedCoordenacao, loadingCoord, allCoordenacaoIds]);

  // IDs que passamos aos hooks:
  // - Se uma coordenação específica foi selecionada: null (o hook recebe coordenacaoId diretamente)
  // - Se admin sem seleção específica: undefined (fallback global admin)
  // - Se usuário comum sem seleção específica: seus IDs específicos
  const coordIdsForHooks = useMemo(() => {
    if (effectiveCoordenacao !== "all") return undefined; // hook recebe via coordenacaoId
    if (isAdmin) return undefined; // admin: fallback global
    return allCoordenacaoIds; // usuário comum: restringe aos seus
  }, [effectiveCoordenacao, isAdmin, allCoordenacaoIds]);

  const { data: membrosStats, isLoading: loadingStats } = useEquipeTarefasStats(
    effectiveCoordenacao !== "all" ? effectiveCoordenacao : null,
    coordIdsForHooks,
    loadingCoord
  );

  const { data: tarefas, isLoading: loadingTarefas } = useEquipeTarefas(
    effectiveCoordenacao !== "all" ? effectiveCoordenacao : null,
    {
      membroId: selectedMembro !== "all" ? selectedMembro : undefined,
      status: statusFilter,
      prioridade: prioridadeFilter,
      search: searchQuery,
    },
    coordIdsForHooks,
    loadingCoord
  );

  // Totais
  const totals = useMemo(() => {
    if (!membrosStats) return { total: 0, pendentes: 0, atrasadas: 0, cumpridas: 0 };
    return membrosStats.reduce(
      (acc, m) => ({
        total: acc.total + m.total_tarefas,
        pendentes: acc.pendentes + m.pendentes,
        atrasadas: acc.atrasadas + m.atrasadas,
        cumpridas: acc.cumpridas + m.cumpridas,
      }),
      { total: 0, pendentes: 0, atrasadas: 0, cumpridas: 0 }
    );
  }, [membrosStats]);

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const getPrioridadeBadge = (prioridade: string) => {
    const variants: Record<string, string> = {
      baixa: "bg-muted text-muted-foreground",
      media: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      alta: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      urgente: "bg-destructive/10 text-destructive",
    };
    return (
      <Badge className={cn("font-medium text-xs", variants[prioridade])}>
        {prioridadeLabels[prioridade]}
      </Badge>
    );
  };

  const getStatusBadge = (tarefa: any) => {
    if (tarefa.status === "cumprido") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Cumprido
        </Badge>
      );
    }
    if (tarefa.data_vencimento) {
      const today = startOfDay(new Date());
      const dataVencimento = parseISO(tarefa.data_vencimento);
      if (isAfter(today, dataVencimento)) {
        return (
          <Badge className="bg-destructive/10 text-destructive text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Atrasado
          </Badge>
        );
      }
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getDiasRestantes = (tarefa: any) => {
    if (tarefa.status === "cumprido" || !tarefa.data_vencimento) return null;
    const today = startOfDay(new Date());
    const dataVencimento = parseISO(tarefa.data_vencimento);
    const dias = differenceInDays(dataVencimento, today);
    if (dias < 0) return <span className="text-destructive font-medium">{Math.abs(dias)}d atraso</span>;
    if (dias === 0) return <span className="text-amber-600 font-medium">Hoje</span>;
    if (dias <= 3) return <span className="text-amber-600">{dias}d</span>;
    return <span className="text-muted-foreground">{dias}d</span>;
  };

  // Mostra seletor de coordenação:
  // - Admin sempre vê
  // - Usuário comum vê só se tiver mais de 1 coordenação
  const showCoordenacaoSelector = isAdmin || allCoordenacaoIds.length > 1;

  if (loadingCoord) {
    return (
      <MainLayout title="Painel da Equipe" subtitle="Carregando...">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Painel da Equipe" subtitle="Visão geral das tarefas da sua equipe">
      {/* Seletor de Coordenação */}
      {showCoordenacaoSelector && (
        <div className="mb-6">
          <Select value={effectiveCoordenacao} onValueChange={setSelectedCoordenacao}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Selecionar coordenação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as coordenações</SelectItem>
              {coordenacoes?.map((coord) => (
                <SelectItem key={coord.id} value={coord.id}>
                  {coord.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-card border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Membros</p>
                <p className="text-2xl font-bold">{membrosStats?.length || 0}</p>
              </div>
              <Users className="w-8 h-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("bg-card border-border/50 cursor-pointer transition-all hover:shadow-md select-none", statusFilter === "all" && activeTab === "tarefas" && "ring-2 ring-blue-500")}
          onClick={() => { setStatusFilter("all"); setActiveTab("tarefas"); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tarefas</p>
                <p className="text-2xl font-bold">{totals.total}</p>
              </div>
              <ListTodo className="w-8 h-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("bg-card border-border/50 cursor-pointer transition-all hover:shadow-md select-none", statusFilter === "pendente" && "ring-2 ring-amber-500")}
          onClick={() => { setStatusFilter("pendente"); setActiveTab("tarefas"); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{totals.pendentes}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("bg-card border-border/50 cursor-pointer transition-all hover:shadow-md select-none", statusFilter === "atrasado" && "ring-2 ring-destructive")}
          onClick={() => { setStatusFilter("atrasado"); setActiveTab("tarefas"); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold text-destructive">{totals.atrasadas}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("bg-card border-border/50 cursor-pointer transition-all hover:shadow-md select-none", statusFilter === "cumprido" && "ring-2 ring-emerald-500")}
          onClick={() => { setStatusFilter("cumprido"); setActiveTab("tarefas"); }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cumpridas</p>
                <p className="text-2xl font-bold text-emerald-600">{totals.cumpridas}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-2">
            <ListTodo className="w-4 h-4" />
            Tarefas
          </TabsTrigger>
        </TabsList>

        {/* Aba Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-4">
          {loadingStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {membrosStats?.map((membro) => {
                const taxaConclusao = membro.total_tarefas > 0
                  ? Math.round((membro.cumpridas / membro.total_tarefas) * 100)
                  : 0;
                return (
                  <Card
                    key={membro.usuario_id}
                    className={cn(
                      "bg-card border-border/50 hover:shadow-md transition-shadow cursor-pointer",
                      membro.atrasadas > 0 && "border-l-4 border-l-destructive"
                    )}
                    onClick={() => { setSelectedMembro(membro.usuario_id); setActiveTab("tarefas"); }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(membro.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{membro.nome}</h4>
                          <p className="text-xs text-muted-foreground truncate">{membro.cargo || "Membro"}</p>
                        </div>
                        {membro.atrasadas > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {membro.atrasadas} atrasada{membro.atrasadas > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Conclusão</span>
                          <span className="font-medium">{taxaConclusao}%</span>
                        </div>
                        <Progress value={taxaConclusao} className="h-2" />
                        <div className="grid grid-cols-4 gap-2 pt-2">
                          <div className="text-center">
                            <p className="text-lg font-bold">{membro.total_tarefas}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-amber-600">{membro.pendentes}</p>
                            <p className="text-xs text-muted-foreground">Pend.</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-destructive">{membro.atrasadas}</p>
                            <p className="text-xs text-muted-foreground">Atras.</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-emerald-600">{membro.cumpridas}</p>
                            <p className="text-xs text-muted-foreground">Cumpr.</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(!membrosStats || membrosStats.length === 0) && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum membro encontrado</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Aba Tarefas */}
        <TabsContent value="tarefas" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tarefa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedMembro} onValueChange={setSelectedMembro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Membro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os membros</SelectItem>
                {membrosStats?.map((m) => (
                  <SelectItem key={m.usuario_id} value={m.usuario_id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cumprido">Cumprido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingTarefas ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarefas?.map((tarefa) => (
                    <TableRow
                      key={tarefa.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => { setSelectedTarefa(tarefa as Prazo); setDetalhesDialogOpen(true); }}
                    >
                      <TableCell>
                        <div className="max-w-[250px]">
                          <p className="font-medium truncate">{tarefa.titulo}</p>
                          {tarefa.descricao && (
                            <p className="text-xs text-muted-foreground truncate">{tarefa.descricao}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {tarefa.responsavel ? getInitials(tarefa.responsavel.nome) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate max-w-[120px]">
                            {tarefa.responsavel?.nome || "Não atribuído"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {tarefa.processo?.numero || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tarefa.data_vencimento
                          ? format(parseISO(tarefa.data_vencimento), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>{getDiasRestantes(tarefa)}</TableCell>
                      <TableCell>{getPrioridadeBadge(tarefa.prioridade)}</TableCell>
                      <TableCell>{getStatusBadge(tarefa)}</TableCell>
                    </TableRow>
                  ))}
                  {(!tarefas || tarefas.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        Nenhuma tarefa encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <TarefaDetalhesDialog
        open={detalhesDialogOpen}
        onOpenChange={setDetalhesDialogOpen}
        prazo={selectedTarefa}
      />
    </MainLayout>
  );
}
