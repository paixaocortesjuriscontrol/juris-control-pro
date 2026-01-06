import { Activity, PieChart, RefreshCw, AlertCircle } from "lucide-react";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useRelatorioAndamentosData } from "@/hooks/useRelatorioAndamentosData";

interface RelatorioAndamentosProps {
  isActive: boolean;
}

export function RelatorioAndamentos({ isActive }: RelatorioAndamentosProps) {
  const { data, isLoading, isError, refetch, isFetching } = useRelatorioAndamentosData(isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Progress value={50} className="h-2 flex-1 max-w-xs" />
          <span className="text-xs text-muted-foreground">Carregando andamentos...</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(3)].map((_, i) => (
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
              <p className="font-medium text-lg">Erro ao carregar andamentos</p>
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
    totalAndamentos = 0,
    evolucaoAndamentos = [],
    andamentosPorArea = [],
  } = data || {};

  return (
    <div className="space-y-6">
      {/* Card de Total */}
      <Card className="animate-slide-up">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-4">
            <Activity className="w-8 h-8 text-gold" />
            <div className="text-center">
              <p className="text-4xl font-bold">{totalAndamentos.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total de Andamentos Registrados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Andamentos por Área */}
        <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <PieChart className="w-5 h-5 text-gold" />
              Andamentos por Área
            </CardTitle>
            <CardDescription>Distribuição de movimentações</CardDescription>
          </CardHeader>
          <CardContent>
            {andamentosPorArea.length === 0 || andamentosPorArea.every((a) => a.value === 0) ? (
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
                        {andamentosPorArea.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {andamentosPorArea.map((area) => (
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

        {/* Evolução dos Andamentos por Ano */}
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Activity className="w-5 h-5 text-gold" />
              Evolução Anual
            </CardTitle>
            <CardDescription>Quantidade de andamentos por ano</CardDescription>
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
      </div>
    </div>
  );
}
