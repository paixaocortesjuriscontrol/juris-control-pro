import { BarChart3, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts";
import { useRelatorioTarefasData } from "@/hooks/useRelatorioTarefasData";

interface RelatorioTarefasProps {
  isActive: boolean;
}

export function RelatorioTarefas({ isActive }: RelatorioTarefasProps) {
  const { data, isLoading, isError, refetch, isFetching } = useRelatorioTarefasData(isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Progress value={50} className="h-2 flex-1 max-w-xs" />
          <span className="text-xs text-muted-foreground">Carregando tarefas...</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
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
              <p className="font-medium text-lg">Erro ao carregar tarefas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tente novamente.
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
    atividadesPorArea = [],
    totalConcluidas = 0,
    totalPendentes = 0,
  } = data || {};

  const totalTarefas = totalConcluidas + totalPendentes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumo de Tarefas */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-gold" />
              Tarefas Concluídas x Pendentes
            </CardTitle>
            <CardDescription>Status geral das tarefas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-3xl font-bold text-green-500">{totalConcluidas}</p>
                <p className="text-sm text-muted-foreground mt-1">Concluídas</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-500/10">
                <p className="text-3xl font-bold text-amber-500">{totalPendentes}</p>
                <p className="text-sm text-muted-foreground mt-1">Pendentes</p>
              </div>
            </div>
            <div className="h-4 rounded-full overflow-hidden bg-muted flex">
              {totalTarefas > 0 && (
                <>
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${(totalConcluidas / totalTarefas) * 100}%` }}
                  />
                  <div 
                    className="h-full bg-amber-500"
                    style={{ width: `${(totalPendentes / totalTarefas) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{totalTarefas > 0 ? ((totalConcluidas / totalTarefas) * 100).toFixed(0) : 0}% concluídas</span>
              <span>{totalTarefas > 0 ? ((totalPendentes / totalTarefas) * 100).toFixed(0) : 0}% pendentes</span>
            </div>
          </CardContent>
        </Card>

        {/* Tarefas por Área */}
        <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gold" />
              Tarefas por Área
            </CardTitle>
            <CardDescription>Distribuição por área de atuação</CardDescription>
          </CardHeader>
          <CardContent>
            {atividadesPorArea.length === 0 || atividadesPorArea.every((a) => a.concluidas === 0 && a.pendentes === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhuma tarefa cadastrada
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
      </div>
    </div>
  );
}
