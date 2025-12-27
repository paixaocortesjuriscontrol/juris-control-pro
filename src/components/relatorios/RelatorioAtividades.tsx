import { 
  CheckCircle,
  BarChart3,
  Clock,
  Activity,
  PieChart
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Legend,
  LineChart,
  Line
} from "recharts";

interface RelatorioAtividadesProps {
  totalPrazos: number;
  prazosStatus: any[];
  atividadesConcluidas: number;
  atividadesNaoConcluidas: number;
  atividadesPorArea: any[];
  evolucaoAndamentos: any[];
  andamentosPorArea: any[];
}

export function RelatorioAtividades({
  totalPrazos,
  prazosStatus,
  atividadesConcluidas,
  atividadesNaoConcluidas,
  atividadesPorArea,
  evolucaoAndamentos,
  andamentosPorArea,
}: RelatorioAtividadesProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividades Concluídas vs Não Concluídas */}
        <Card className="animate-slide-up">
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

        {/* Status de Prazos */}
        <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
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

        {/* Atividades por Área */}
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
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
        <Card className="animate-slide-up" style={{ animationDelay: "150ms" }}>
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

        {/* Evolução dos Andamentos por Ano */}
        <Card className="animate-slide-up lg:col-span-2" style={{ animationDelay: "200ms" }}>
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
      </div>
    </div>
  );
}
