import { 
  FileText, 
  Activity, 
  Users, 
  TrendingUp,
  PieChart,
  User
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
  Legend
} from "recharts";

interface RelatorioResumoProps {
  totalProcessos: number;
  processosAtivosAnoAtual: number;
  mediaEnvolvidos: string;
  totalMovimentacoes: number;
  processosPerArea: any[];
  processosPorTipoPessoa: any[];
  processosMensais: any[];
}

export function RelatorioResumo({
  totalProcessos,
  processosAtivosAnoAtual,
  mediaEnvolvidos,
  totalMovimentacoes,
  processosPerArea,
  processosPorTipoPessoa,
  processosMensais,
}: RelatorioResumoProps) {
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
        <Card className="animate-slide-up lg:col-span-2" style={{ animationDelay: "150ms" }}>
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
      </div>
    </div>
  );
}
