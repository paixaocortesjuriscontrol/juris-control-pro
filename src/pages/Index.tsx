import { Scale, Briefcase, Users, AlertTriangle, UserCheck, FolderX } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProcessCard } from "@/components/dashboard/ProcessCard";
import { CoordinationCard } from "@/components/dashboard/CoordinationCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { ProcessosDistribuicaoChart } from "@/components/dashboard/ProcessosDistribuicaoChart";
import { ProcessosStatusChart } from "@/components/dashboard/ProcessosStatusChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useRecentProcessos, useCoordenacoes } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentProcessos, isLoading: processosLoading } = useRecentProcessos(3);
  const { data: coordenacoes, isLoading: coordenacoesLoading } = useCoordenacoes();

  const mapStatus = (status: string) => {
    const statusMap: Record<string, "active" | "pending" | "urgent" | "closed"> = {
      ativo: "active",
      pendente: "pending",
      urgente: "urgent",
      encerrado: "closed",
      arquivado: "closed",
    };
    return statusMap[status] || "active";
  };

  // Prepare chart data
  const distribuicaoData = coordenacoes?.map(coord => ({
    nome: coord.nome,
    total: coord.processCount,
    distribuidos: coord.processosDistribuidos || 0,
    naoDistribuidos: coord.processosNaoDistribuidos || 0,
    area: coord.area, // Agora aceita qualquer área (string)
  })) || [];

  const statusData = stats?.statusCount ? [
    { name: "Ativos", value: stats.statusCount.ativo, color: "hsl(var(--status-active))" },
    { name: "Pendentes", value: stats.statusCount.pendente, color: "hsl(var(--status-pending))" },
    { name: "Urgentes", value: stats.statusCount.urgente, color: "hsl(var(--status-urgent))" },
    { name: "Encerrados", value: stats.statusCount.encerrado, color: "hsl(var(--muted))" },
    { name: "Arquivados", value: stats.statusCount.arquivado, color: "hsl(var(--border))" },
  ] : [];

  const taxaDistribuicao = stats?.totalProcessos 
    ? Math.round((stats.processosDistribuidos / stats.totalProcessos) * 100) 
    : 0;

  return (
    <MainLayout 
      title="Dashboard" 
      subtitle="Visão geral do escritório"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {statsLoading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Total de Processos"
              value={String(stats?.totalProcessos || 0)}
              change="Cadastrados no sistema"
              changeType="neutral"
              icon={Scale}
              iconColor="bg-primary"
              delay={0}
            />
            <StatCard
              title="Processos Ativos"
              value={String(stats?.processosAtivos || 0)}
              change={`${stats?.totalProcessos ? Math.round((stats.processosAtivos / stats.totalProcessos) * 100) : 0}% do total`}
              changeType="neutral"
              icon={Briefcase}
              iconColor="bg-area-civil"
              delay={50}
            />
            <StatCard
              title="Distribuídos"
              value={String(stats?.processosDistribuidos || 0)}
              change={`${taxaDistribuicao}% atribuídos`}
              changeType={taxaDistribuicao >= 80 ? "positive" : taxaDistribuicao >= 50 ? "neutral" : "negative"}
              icon={UserCheck}
              iconColor="bg-green-600"
              delay={100}
            />
            <StatCard
              title="Sem Coordenação"
              value={String(stats?.processosSemCoordenacao || 0)}
              change="Aguardando atribuição"
              changeType={stats?.processosSemCoordenacao && stats.processosSemCoordenacao > 0 ? "negative" : "neutral"}
              icon={FolderX}
              iconColor="bg-orange-500"
              delay={150}
            />
            <StatCard
              title="Prazos Urgentes"
              value={String(stats?.prazosUrgentes || 0)}
              change="Próximos 7 dias"
              changeType={stats?.prazosUrgentes && stats.prazosUrgentes > 0 ? "negative" : "neutral"}
              icon={AlertTriangle}
              iconColor="bg-status-urgent"
              delay={200}
            />
            <StatCard
              title="Advogados"
              value={String(stats?.totalAdvogados || 0)}
              change={`${stats?.totalCoordenacoes || 0} coordenações`}
              changeType="neutral"
              icon={Users}
              iconColor="bg-gold"
              delay={250}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      {!coordenacoesLoading && !statsLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ProcessosDistribuicaoChart data={distribuicaoData} />
          <ProcessosStatusChart data={statusData} />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Processes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold text-foreground">Processos Recentes</h2>
              <Button 
                variant="ghost" 
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/processos")}
              >
                Ver todos
              </Button>
            </div>
            {processosLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : recentProcessos && recentProcessos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {recentProcessos.map((processo, index) => (
                  <ProcessCard 
                    key={processo.id} 
                    numero={processo.numero}
                    cliente={processo.polo_ativo || "Não informado"}
                    area={processo.area}
                    status={mapStatus(processo.status)}
                    advogado={processo.advogado_responsavel?.nome || "Não atribuído"}
                    descricao={processo.assunto || "Sem descrição"}
                    delay={index * 100} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-card rounded-xl border border-border/50">
                <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum processo cadastrado</p>
                <Button className="mt-4" onClick={() => navigate("/importar")}>
                  Importar Processos
                </Button>
              </div>
            )}
          </div>

          {/* Coordinations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold text-foreground">Coordenações</h2>
              <Button 
                variant="ghost" 
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/coordenacoes")}
              >
                Gerenciar
              </Button>
            </div>
            {coordenacoesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : coordenacoes && coordenacoes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {coordenacoes.map((coord, index) => (
                  <CoordinationCard 
                    key={coord.id} 
                    name={coord.nome}
                    coordinator={coord.coordenador?.nome || "Não definido"}
                    coordinatorInitials={coord.coordenador?.nome?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "ND"}
                    processCount={coord.processCount}
                    distributedCount={coord.processosDistribuidos || 0}
                    area={coord.area}
                    teamMembers={coord.membros.map((m: any) => ({
                      name: m.usuario?.nome || "Membro",
                      initials: m.usuario?.nome?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "M",
                    }))}
                    delay={index * 100} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-card rounded-xl border border-border/50">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma coordenação cadastrada</p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <RecentActivity />
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          <UpcomingDeadlines />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
