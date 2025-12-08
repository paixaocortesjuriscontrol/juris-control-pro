import { useState } from "react";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download, 
  Calendar, 
  Filter,
  FileText,
  Scale,
  Clock,
  Users
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
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
  LineChart,
  Line,
  Legend
} from "recharts";

const processosPerArea = [
  { name: "Cível", value: 127, color: "#3B82F6" },
  { name: "Trabalhista", value: 89, color: "#22C55E" },
  { name: "Empresarial", value: 54, color: "#8B5CF6" },
];

const processosMensais = [
  { mes: "Jul", novos: 18, encerrados: 12 },
  { mes: "Ago", novos: 22, encerrados: 15 },
  { mes: "Set", novos: 15, encerrados: 18 },
  { mes: "Out", novos: 28, encerrados: 20 },
  { mes: "Nov", novos: 24, encerrados: 16 },
  { mes: "Dez", novos: 12, encerrados: 8 },
];

const prazosStatus = [
  { name: "Cumpridos", value: 156, color: "#22C55E" },
  { name: "Pendentes", value: 23, color: "#EAB308" },
  { name: "Atrasados", value: 5, color: "#EF4444" },
];

const produtividadeAdvogados = [
  { nome: "Dr. Paixão", processos: 45, audiencias: 12, peticoes: 38 },
  { nome: "Dra. Cortes", processos: 38, audiencias: 18, peticoes: 42 },
  { nome: "Dr. Alves", processos: 32, audiencias: 8, peticoes: 28 },
  { nome: "Dra. Santos", processos: 28, audiencias: 15, peticoes: 35 },
  { nome: "Dr. Silva", processos: 25, audiencias: 10, peticoes: 22 },
];

const relatoriosDisponiveis = [
  { 
    id: "1", 
    name: "Processos por Área", 
    description: "Distribuição de processos por área de atuação",
    icon: PieChart,
  },
  { 
    id: "2", 
    name: "Movimentação Mensal", 
    description: "Novos processos vs encerrados por mês",
    icon: BarChart3,
  },
  { 
    id: "3", 
    name: "Controle de Prazos", 
    description: "Status de cumprimento de prazos processuais",
    icon: Clock,
  },
  { 
    id: "4", 
    name: "Produtividade da Equipe", 
    description: "Métricas de desempenho por advogado",
    icon: Users,
  },
];

const Relatorios = () => {
  const [periodo, setPeriodo] = useState("ultimo-mes");

  return (
    <MainLayout 
      title="Relatórios" 
      subtitle="Análise e métricas do escritório"
    >
      {/* Filters */}
      <Card className="mb-6 animate-fade-in">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
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
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Mais Filtros
            </Button>
            <div className="ml-auto">
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Exportar Relatórios
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {processosPerArea.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {processosPerArea.map((area) => (
                <div key={area.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="text-sm text-muted-foreground">{area.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Movimentação Mensal */}
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold" />
              Movimentação Mensal
            </CardTitle>
            <CardDescription>Novos processos vs encerrados</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Status de Prazos */}
        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" />
              Controle de Prazos
            </CardTitle>
            <CardDescription>Status de cumprimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {prazosStatus.map((status) => (
                <div 
                  key={status.name}
                  className="text-center p-4 rounded-lg"
                  style={{ backgroundColor: `${status.color}15` }}
                >
                  <p className="text-3xl font-bold" style={{ color: status.color }}>
                    {status.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{status.name}</p>
                </div>
              ))}
            </div>
            <div className="h-4 rounded-full overflow-hidden bg-muted flex">
              {prazosStatus.map((status) => {
                const total = prazosStatus.reduce((acc, s) => acc + s.value, 0);
                const percentage = (status.value / total) * 100;
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
          </CardContent>
        </Card>

        {/* Produtividade */}
        <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Users className="w-5 h-5 text-gold" />
              Produtividade da Equipe
            </CardTitle>
            <CardDescription>Top 5 advogados por volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {produtividadeAdvogados.map((adv, index) => (
                <div key={adv.nome} className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{adv.nome}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{adv.processos} processos</span>
                      <span>{adv.audiencias} audiências</span>
                      <span>{adv.peticoes} petições</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{adv.processos + adv.audiencias + adv.peticoes}</p>
                    <p className="text-xs text-muted-foreground">atividades</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Reports */}
      <Card className="animate-slide-up" style={{ animationDelay: "400ms" }}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold" />
            Relatórios Disponíveis
          </CardTitle>
          <CardDescription>Gere relatórios detalhados para exportação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatoriosDisponiveis.map((relatorio) => (
              <div 
                key={relatorio.id}
                className="p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center mb-3 group-hover:bg-gold/20 transition-colors">
                  <relatorio.icon className="w-5 h-5 text-gold" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">{relatorio.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{relatorio.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
};

export default Relatorios;
