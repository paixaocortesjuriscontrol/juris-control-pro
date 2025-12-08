import { Scale, Briefcase, Users, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProcessCard, AreaType, StatusType } from "@/components/dashboard/ProcessCard";
import { CoordinationCard } from "@/components/dashboard/CoordinationCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { Button } from "@/components/ui/button";

const mockProcesses = [
  {
    numero: "0001234-12.2024.8.19.0001",
    cliente: "Empresa ABC Ltda",
    area: "civil" as AreaType,
    status: "active" as StatusType,
    advogado: "Dr. Silva",
    dataProximoEvento: "12/12/2025",
    descricao: "Ação de cobrança - valor R$ 150.000,00",
  },
  {
    numero: "0005678-45.2024.5.01.0034",
    cliente: "João da Silva",
    area: "trabalhista" as AreaType,
    status: "urgent" as StatusType,
    advogado: "Dra. Santos",
    dataProximoEvento: "09/12/2025",
    descricao: "Reclamação trabalhista - horas extras",
  },
  {
    numero: "0009012-78.2024.8.19.0042",
    cliente: "Tech Solutions S.A.",
    area: "empresarial" as AreaType,
    status: "pending" as StatusType,
    advogado: "Dr. Oliveira",
    dataProximoEvento: "15/12/2025",
    descricao: "Dissolução de sociedade",
  },
];

const mockCoordinations = [
  {
    name: "Coordenação Cível",
    coordinator: "Dr. Carlos Paixão",
    coordinatorInitials: "CP",
    processCount: 127,
    area: "civil" as const,
    teamMembers: [
      { name: "Ana Silva", initials: "AS" },
      { name: "Bruno Costa", initials: "BC" },
      { name: "Carla Dias", initials: "CD" },
      { name: "Daniel Lima", initials: "DL" },
      { name: "Eva Santos", initials: "ES" },
    ],
  },
  {
    name: "Coordenação Trabalhista",
    coordinator: "Dra. Marina Cortes",
    coordinatorInitials: "MC",
    processCount: 89,
    area: "trabalhista" as const,
    teamMembers: [
      { name: "Felipe Rocha", initials: "FR" },
      { name: "Gabriela Nunes", initials: "GN" },
      { name: "Hugo Pereira", initials: "HP" },
    ],
  },
  {
    name: "Coordenação Empresarial",
    coordinator: "Dr. Ricardo Alves",
    coordinatorInitials: "RA",
    processCount: 54,
    area: "empresarial" as const,
    teamMembers: [
      { name: "Isabela Melo", initials: "IM" },
      { name: "João Pedro", initials: "JP" },
      { name: "Karen Souza", initials: "KS" },
      { name: "Lucas Ferreira", initials: "LF" },
    ],
  },
];

const Index = () => {
  return (
    <MainLayout 
      title="Dashboard" 
      subtitle="Visão geral do escritório"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total de Processos"
          value="270"
          change="+12 este mês"
          changeType="positive"
          icon={Scale}
          iconColor="bg-primary"
          delay={0}
        />
        <StatCard
          title="Processos Ativos"
          value="183"
          change="67% do total"
          changeType="neutral"
          icon={Briefcase}
          iconColor="bg-area-civil"
          delay={50}
        />
        <StatCard
          title="Prazos Urgentes"
          value="8"
          change="Próximos 7 dias"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="bg-status-urgent"
          delay={100}
        />
        <StatCard
          title="Advogados Ativos"
          value="15"
          change="3 coordenações"
          changeType="neutral"
          icon={Users}
          iconColor="bg-gold"
          delay={150}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Processes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold text-foreground">Processos Recentes</h2>
              <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground">
                Ver todos
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {mockProcesses.map((processo, index) => (
                <ProcessCard key={processo.numero} {...processo} delay={index * 100} />
              ))}
            </div>
          </div>

          {/* Coordinations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold text-foreground">Coordenações</h2>
              <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground">
                Gerenciar
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {mockCoordinations.map((coord, index) => (
                <CoordinationCard key={coord.name} {...coord} delay={index * 100} />
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <RecentActivity />
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          <UpcomingDeadlines />
          
          {/* Quick Actions */}
          <div className="bg-card rounded-xl border border-border/50 shadow-soft p-5 animate-slide-up" style={{ animationDelay: "400ms" }}>
            <h2 className="font-serif text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
            <div className="space-y-2">
              <Button className="w-full justify-start bg-primary hover:bg-primary/90">
                <Scale className="w-4 h-4 mr-2" />
                Novo Processo
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Cadastrar Prazo
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
