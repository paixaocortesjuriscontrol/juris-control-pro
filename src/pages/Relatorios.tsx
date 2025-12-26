import { useState } from "react";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download, 
  Calendar, 
  Filter,
  FileText,
  Clock,
  Users,
  Building2,
  User,
  Gavel,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import { useRelatoriosData } from "@/hooks/useRelatoriosData";
import { CacheIndicator } from "@/components/ui/cache-indicator";
import { useQueryClient } from "@tanstack/react-query";

const Relatorios = () => {
  const [periodo, setPeriodo] = useState("ultimo-mes");
  const { data, isLoading, isFetching, isStale, dataUpdatedAt, refetch } = useRelatoriosData();
  const queryClient = useQueryClient();

  const handleForceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
    refetch();
  };

  if (isLoading) {
    return (
      <MainLayout 
        title="Relatórios" 
        subtitle="Análise e métricas do escritório"
      >
        <div className="space-y-6">
          <Skeleton className="h-20 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  const { 
    processosPerArea = [], 
    prazosStatus = [], 
    produtividadeAdvogados = [], 
    processosMensais = [],
    processosPorCliente = [],
    processosPorTipoPessoa = [],
    processosAtivosAnoAtual = 0,
    mediaEnvolvidos = "0",
    processosPorVara = [],
    duracaoClientes = [],
    atividadesConcluidas = 0,
    atividadesNaoConcluidas = 0,
    atividadesPorArea = [],
    atividadesPorTarefa = [],
    evolucaoAndamentos = [],
    andamentosPorArea = [],
    totalProcessos = 0,
    totalPrazos = 0,
    totalMovimentacoes = 0,
  } = data || {};

  return (
    <MainLayout 
      title="Relatórios" 
      subtitle="Análise e métricas do escritório"
    >
      {/* Filters */}
      <Card className="mb-6 animate-fade-in">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <CacheIndicator
              isFetching={isFetching}
              isStale={isStale}
              dataUpdatedAt={dataUpdatedAt}
              onRefresh={handleForceRefresh}
            />
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultima-semana">Última semana</SelectItem>
                  <SelectItem value="ultimo-mes">Último mês</SelectItem>
                  <SelectItem value="ultimo-trimestre">Último trimestre</SelectItem>
                  <SelectItem value="ultimo-ano">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="hidden sm:flex">
              <Filter className="w-4 h-4 mr-2" />
              Mais Filtros
            </Button>
            <div className="ml-auto">
              <Button>
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Exportar Relatórios</span>
                <span className="sm:hidden">Exportar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalProcessos}</p>
                <p className="text-sm text-muted-foreground">Total de Processos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{processosAtivosAnoAtual}</p>
                <p className="text-sm text-muted-foreground">Ativos em {new Date().getFullYear()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mediaEnvolvidos}</p>
                <p className="text-sm text-muted-foreground">Média de Envolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMovimentacoes}</p>
                <p className="text-sm text-muted-foreground">Total de Andamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Processos por Área */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <PieChart className="w-5 h-5 text-gold" />
              Processos por Área
            </CardTitle>
            <CardDescription>Distribuição atual do portfólio</CardDescription>
          </CardHeader>
          <CardContent>
            {processosPerArea.every((p: any) => p.value === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum processo cadastrado
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={processosPerArea}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                      >
                        {processosPerArea.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {processosPerArea.map((area: any) => (
                    <div key={area.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: area.color }}
                      />
                      <span className="text-sm text-muted-foreground">{area.name} ({area.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Processos por Tipo de Pessoa */}
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <User className="w-5 h-5 text-gold" />
              Processos por Tipo de Pessoa
            </CardTitle>
            <CardDescription>Pessoa Física vs Pessoa Jurídica</CardDescription>
          </CardHeader>
          <CardContent>
            {processosPorTipoPessoa.every((p: any) => p.value === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum processo com cliente cadastrado
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={processosPorTipoPessoa}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${value}` : ""}
                      >
                        {processosPorTipoPessoa.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {processosPorTipoPessoa.map((tipo: any) => (
                    <div key={tipo.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tipo.color }}
                      />
                      <span className="text-sm text-muted-foreground">{tipo.name} ({tipo.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Movimentação Mensal */}
        <Card className="animate-slide-up" style={{ animationDelay: "150ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold" />
              Movimentação Mensal
            </CardTitle>
            <CardDescription>Novos processos vs encerrados</CardDescription>
          </CardHeader>
          <CardContent>
            {processosMensais.every((p: any) => p.novos === 0 && p.encerrados === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Sem dados de movimentação
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processosMensais}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="novos" name="Novos" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="encerrados" name="Encerrados" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução dos Andamentos por Ano */}
        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Activity className="w-5 h-5 text-gold" />
              Evolução dos Andamentos por Ano
            </CardTitle>
            <CardDescription>Quantidade de andamentos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {evolucaoAndamentos.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Sem dados de andamentos
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoAndamentos}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="ano" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      name="Andamentos"
                      stroke="#8B5CF6" 
                      strokeWidth={2}
                      dot={{ fill: "#8B5CF6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividades Concluídas vs Não Concluídas */}
        <Card className="animate-slide-up" style={{ animationDelay: "250ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-gold" />
              Atividades Concluídas x Não Concluídas
            </CardTitle>
            <CardDescription>Status das atividades/prazos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-3xl font-bold text-green-500">{atividadesConcluidas}</p>
                <p className="text-sm text-muted-foreground mt-1">Concluídas</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-500/10">
                <p className="text-3xl font-bold text-amber-500">{atividadesNaoConcluidas}</p>
                <p className="text-sm text-muted-foreground mt-1">Pendentes/Atrasadas</p>
              </div>
            </div>
            <div className="h-4 rounded-full overflow-hidden bg-muted flex">
              {totalPrazos > 0 && (
                <>
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${(atividadesConcluidas / totalPrazos) * 100}%` }}
                  />
                  <div 
                    className="h-full bg-amber-500"
                    style={{ width: `${(atividadesNaoConcluidas / totalPrazos) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{totalPrazos > 0 ? ((atividadesConcluidas / totalPrazos) * 100).toFixed(0) : 0}% concluídas</span>
              <span>{totalPrazos > 0 ? ((atividadesNaoConcluidas / totalPrazos) * 100).toFixed(0) : 0}% pendentes</span>
            </div>
          </CardContent>
        </Card>

        {/* Atividades por Área */}
        <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gold" />
              Atividades Concluídas x Pendentes por Área
            </CardTitle>
            <CardDescription>Distribuição por área de atuação</CardDescription>
          </CardHeader>
          <CardContent>
            {atividadesPorArea.every((a: any) => a.concluidas === 0 && a.pendentes === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhuma atividade cadastrada
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={atividadesPorArea}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="concluidas" name="Concluídas" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pendentes" name="Pendentes" fill="#EAB308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Andamentos por Área */}
        <Card className="animate-slide-up" style={{ animationDelay: "350ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <PieChart className="w-5 h-5 text-gold" />
              Quantidade de Andamentos por Área
            </CardTitle>
            <CardDescription>Distribuição de movimentações</CardDescription>
          </CardHeader>
          <CardContent>
            {andamentosPorArea.every((a: any) => a.value === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum andamento cadastrado
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={andamentosPorArea}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${value}` : ""}
                      >
                        {andamentosPorArea.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {andamentosPorArea.map((area: any) => (
                    <div key={area.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: area.color }}
                      />
                      <span className="text-sm text-muted-foreground">{area.name} ({area.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Status de Prazos */}
        <Card className="animate-slide-up" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" />
              Controle de Prazos
            </CardTitle>
            <CardDescription>Status de cumprimento</CardDescription>
          </CardHeader>
          <CardContent>
            {prazosStatus.every((p: any) => p.value === 0) ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum prazo cadastrado
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {prazosStatus.map((status: any) => (
                    <div 
                      key={status.name}
                      className="text-center p-4 rounded-lg"
                      style={{ backgroundColor: `${status.color}15` }}
                    >
                      <p className="text-2xl sm:text-3xl font-bold" style={{ color: status.color }}>
                        {status.value}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{status.name}</p>
                    </div>
                  ))}
                </div>
                <div className="h-4 rounded-full overflow-hidden bg-muted flex">
                  {prazosStatus.map((status: any) => {
                    const total = prazosStatus.reduce((acc: number, s: any) => acc + s.value, 0);
                    const percentage = total > 0 ? (status.value / total) * 100 : 0;
                    return (
                      <div 
                        key={status.name}
                        className="h-full"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: status.color,
                        }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Processos por Cliente - Relatório Completo */}
        <Card className="animate-slide-up" style={{ animationDelay: "450ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gold" />
              Relatório de Processos por Cliente
            </CardTitle>
            <CardDescription>Estatísticas detalhadas de processos por cliente</CardDescription>
          </CardHeader>
          <CardContent>
            {processosPorCliente.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum cliente com processos
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 rounded-lg bg-blue-500/10">
                    <p className="text-2xl font-bold text-blue-500">{processosPorCliente.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clientes Ativos</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-green-500/10">
                    <p className="text-2xl font-bold text-green-500">
                      {processosPorCliente.reduce((acc: number, c: any) => acc + c.ativos, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Processos Ativos</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-purple-500/10">
                    <p className="text-2xl font-bold text-purple-500">
                      {processosPorCliente.reduce((acc: number, c: any) => acc + c.encerrados, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Encerrados</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-amber-500/10">
                    <p className="text-2xl font-bold text-amber-500">
                      {processosPorCliente.reduce((acc: number, c: any) => acc + c.prazosPendentes, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Prazos Pendentes</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ativos</TableHead>
                      <TableHead className="text-right">Encerrados</TableHead>
                      <TableHead className="text-right">Prazos Pend.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processosPorCliente.map((cliente: any) => (
                      <TableRow key={cliente.nome}>
                        <TableCell className="font-medium truncate max-w-[200px]">{cliente.nome}</TableCell>
                        <TableCell>
                          <span className={cliente.tipo === "pessoa_fisica" ? "text-blue-500" : "text-purple-500"}>
                            {cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{cliente.total}</TableCell>
                        <TableCell className="text-right text-green-500">{cliente.ativos}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{cliente.encerrados}</TableCell>
                        <TableCell className="text-right text-amber-500">{cliente.prazosPendentes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Processos por Vara */}
        <Card className="animate-slide-up" style={{ animationDelay: "500ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Gavel className="w-5 h-5 text-gold" />
              Processos por Vara
            </CardTitle>
            <CardDescription>Distribuição por vara/órgão julgador</CardDescription>
          </CardHeader>
          <CardContent>
            {processosPorVara.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum processo com vara informada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vara</TableHead>
                    <TableHead className="text-right">Processos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processosPorVara.map((item: any) => (
                    <TableRow key={item.vara}>
                      <TableCell className="font-medium truncate max-w-[200px]">{item.vara}</TableCell>
                      <TableCell className="text-right">{item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Duração por Cliente */}
        <Card className="animate-slide-up" style={{ animationDelay: "550ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" />
              Duração dos Processos por Cliente
            </CardTitle>
            <CardDescription>Média de dias por cliente principal</CardDescription>
          </CardHeader>
          <CardContent>
            {duracaoClientes.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum cliente com processos
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Processos</TableHead>
                    <TableHead className="text-right">Média (dias)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duracaoClientes.map((cliente: any) => (
                    <TableRow key={cliente.nome}>
                      <TableCell className="font-medium truncate max-w-[150px]">{cliente.nome}</TableCell>
                      <TableCell className="text-right">{cliente.processos}</TableCell>
                      <TableCell className="text-right">{cliente.mediaDias}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Atividades por Tarefa */}
        <Card className="animate-slide-up" style={{ animationDelay: "600ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold" />
              Quantidade de Atividades por Tarefa
            </CardTitle>
            <CardDescription>Top 10 tipos de tarefas</CardDescription>
          </CardHeader>
          <CardContent>
            {atividadesPorTarefa.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhuma atividade cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">
                      <CheckCircle className="w-4 h-4 inline text-green-500" />
                    </TableHead>
                    <TableHead className="text-right">
                      <AlertTriangle className="w-4 h-4 inline text-red-500" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atividadesPorTarefa.map((tarefa: any) => (
                    <TableRow key={tarefa.titulo}>
                      <TableCell className="font-medium truncate max-w-[150px]">{tarefa.titulo}</TableCell>
                      <TableCell className="text-right">{tarefa.total}</TableCell>
                      <TableCell className="text-right text-green-500">{tarefa.concluidas}</TableCell>
                      <TableCell className="text-right text-red-500">{tarefa.atrasadas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Produtividade */}
        <Card className="animate-slide-up lg:col-span-2" style={{ animationDelay: "650ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Users className="w-5 h-5 text-gold" />
              Produtividade da Equipe
            </CardTitle>
            <CardDescription>Top advogados por volume de processos</CardDescription>
          </CardHeader>
          <CardContent>
            {produtividadeAdvogados.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum advogado com processos atribuídos
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {produtividadeAdvogados.map((adv: any, index: number) => (
                  <div key={adv.nome} className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{adv.nome}</p>
                      <p className="text-xs text-muted-foreground">{adv.processos} processos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Note about missing features */}
      <Card className="animate-slide-up" style={{ animationDelay: "700ms" }}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">Relatórios não disponíveis:</p>
              <p className="mt-1">
                <strong>Situação dos Atendimentos</strong> e <strong>Horas Lançadas por Apontamento</strong> 
                requerem tabelas adicionais no banco de dados (atendimentos e apontamentos de horas).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
};

export default Relatorios;
