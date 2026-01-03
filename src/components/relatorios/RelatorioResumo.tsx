import { 
  FileText, 
  Activity, 
  Users, 
  TrendingUp,
  PieChart,
  User,
  RefreshCw,
  AlertCircle,
  Gavel
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import { useRelatorioResumoData } from "@/hooks/useRelatorioResumoData";

interface RelatorioResumoProps {
  isActive: boolean;
}

export function RelatorioResumo({ isActive }: RelatorioResumoProps) {
  const { data, isLoading, isError, refetch, isFetching } = useRelatorioResumoData(isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <p className="font-medium text-lg">Erro ao carregar relatório</p>
              <p className="text-sm text-muted-foreground mt-1">
                O relatório está demorando mais que o esperado. Tente novamente.
              </p>
            </div>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Carregando...' : 'Tentar Novamente'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    totalProcessos,
    processosAtivosAnoAtual,
    mediaEnvolvidos,
    totalMovimentacoes,
    processosPerArea,
    processosPorTipoPessoa,
    processosMensais,
    processosMptStatus,
  } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Processos MPT por Status */}
        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Gavel className="w-5 h-5 text-gold" />
              Processos do Ministério Público por Situação
            </CardTitle>
            <CardDescription>Distribuição por status (matéria MPT)</CardDescription>
          </CardHeader>
          <CardContent>
            {!processosMptStatus || processosMptStatus.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum processo do Ministério Público cadastrado
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={processosMptStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                      >
                        {processosMptStatus.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {processosMptStatus.map((status: any) => (
                    <div key={status.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-sm text-muted-foreground">{status.name} ({status.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
