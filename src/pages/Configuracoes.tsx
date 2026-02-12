import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Shield, Palette, RefreshCw, Activity, Globe, Newspaper, FileSearch, Radar, BarChart3, Settings, KeyRound, LayoutDashboard, SlidersHorizontal, FlaskConical, Server } from "lucide-react";
import { MonitoramentoRedistribuicoesCard } from "@/components/configuracoes/MonitoramentoRedistribuicoesCard";
import { MonitoramentoAndamentosCard } from "@/components/configuracoes/MonitoramentoAndamentosCard";
import { MonitoramentoDistribuicoesCard } from "@/components/configuracoes/MonitoramentoDistribuicoesCard";
import { MonitoramentoDjenCard } from "@/components/configuracoes/MonitoramentoDjenCard";
import { BotaoSincronizarDjen } from "@/components/djen/BotaoSincronizarDjen";
import { DjenAdvogadoDiagnosticoDialog } from "@/components/djen/DjenAdvogadoDiagnosticoDialog";
import { MonitoramentoDjenProcessosCard } from "@/components/configuracoes/MonitoramentoDjenProcessosCard";
import { MonitoramentoTermosCard } from "@/components/configuracoes/MonitoramentoTermosCard";
import { RelatorioMonitoramentoCard } from "@/components/configuracoes/RelatorioMonitoramentoCard";
import { MonitoringDashboard } from "@/components/configuracoes/MonitoringDashboard";
import { ParametrosDjenCard } from "@/components/configuracoes/ParametrosDjenCard";
import { MonitoramentosAtivosPanel } from "@/components/configuracoes/MonitoramentosAtivosPanel";
import { FilaExecucoesPanel } from "@/components/configuracoes/FilaExecucoesPanel";
import CofreSenhasPage from "@/pages/CofreSenhas";
import RelatorioExecucoesPage from "@/pages/RelatorioExecucoes";
import ComparacaoDjenDje from "@/components/configuracoes/ComparacaoDjenDje";
import WorkersDjenVpsPanel from "@/components/configuracoes/WorkersDjenVpsPanel";
// MonitoramentoDataJudCard removido - agora integrado no Dashboard via DataJudDashboardCard

export default function Configuracoes() {
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <MainLayout title="Configurações" subtitle="Gerencie as configurações do sistema">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="redistribuicoes" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Redistribuições</span>
          </TabsTrigger>
          <TabsTrigger value="andamentos" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Andamentos</span>
          </TabsTrigger>
          <TabsTrigger value="distribuicoes" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Distribuições</span>
          </TabsTrigger>
          <TabsTrigger value="djen" className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            <span className="hidden sm:inline">DJEN</span>
          </TabsTrigger>
          <TabsTrigger value="djen-processos" className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            <span className="hidden sm:inline">DJEN Processos</span>
          </TabsTrigger>
          <TabsTrigger value="monitoracao-360" className="flex items-center gap-2">
            <Radar className="h-4 w-4" />
            <span className="hidden sm:inline">Monitoração 360</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Rel. Monitoramento</span>
          </TabsTrigger>
          <TabsTrigger value="execucoes" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Rel. Execuções</span>
          </TabsTrigger>
          <TabsTrigger value="cofre" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Cofre de Senhas</span>
          </TabsTrigger>
          <TabsTrigger value="preferencias" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Preferências</span>
          </TabsTrigger>
          <TabsTrigger value="parametros-djen" className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Parâmetros DJEN</span>
          </TabsTrigger>
          <TabsTrigger value="dje-pdf" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">DJE-PDF (Experimental)</span>
          </TabsTrigger>
          <TabsTrigger value="vps-workers" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">VPS Workers</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba Dashboard - Profissional */}
        <TabsContent value="dashboard" className="space-y-4">
          <MonitoringDashboard onNavigateToTab={setActiveTab} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <MonitoramentosAtivosPanel />
            <FilaExecucoesPanel />
          </div>
        </TabsContent>

        {/* Aba Redistribuições */}
        <TabsContent value="redistribuicoes" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Monitoramento de Redistribuições</h2>
            <p className="text-sm text-muted-foreground">
              Verifica automaticamente mudanças de vara nos processos cadastrados
            </p>
          </div>
          <MonitoramentoRedistribuicoesCard coordenacaoId="" />
        </TabsContent>

        {/* Aba Andamentos */}
        <TabsContent value="andamentos" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Monitoramento de Andamentos</h2>
            <p className="text-sm text-muted-foreground">
              Busca novos andamentos processuais via API dos tribunais
            </p>
          </div>
          <MonitoramentoAndamentosCard coordenacaoId="" />
        </TabsContent>

        {/* Aba Distribuições */}
        <TabsContent value="distribuicoes" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Monitoramento de Distribuições</h2>
            <p className="text-sm text-muted-foreground">
              Detecta novas distribuições de processos nos tribunais configurados
            </p>
          </div>
          <MonitoramentoDistribuicoesCard coordenacaoId="" />
        </TabsContent>

        {/* Aba DJEN */}
        <TabsContent value="djen" className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monitoramento DJEN</h2>
              <p className="text-sm text-muted-foreground">
                Busca publicações no Diário de Justiça Eletrônico Nacional
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDiagnostico(true)}
                className="gap-2"
              >
                <FlaskConical className="h-4 w-4" />
                Diagnóstico OAB
              </Button>
              <BotaoSincronizarDjen />
            </div>
          </div>
          <MonitoramentoDjenCard coordenacaoId="" />
          <DjenAdvogadoDiagnosticoDialog 
            open={showDiagnostico} 
            onOpenChange={setShowDiagnostico} 
          />
        </TabsContent>

        {/* Aba DJEN Processos */}
        <TabsContent value="djen-processos" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Busca DJEN por Processo</h2>
            <p className="text-sm text-muted-foreground">
              Busca publicações específicas para processos cadastrados
            </p>
          </div>
          <MonitoramentoDjenProcessosCard coordenacaoId="" />
        </TabsContent>

        {/* Aba Monitoração 360 */}
        <TabsContent value="monitoracao-360" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Monitoração 360º</h2>
            <p className="text-sm text-muted-foreground">
              Varredura automática de termos estratégicos nas movimentações
            </p>
          </div>
          <MonitoramentoTermosCard coordenacaoId="" />
        </TabsContent>

        {/* Aba Relatórios de Monitoramento */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Relatórios de Monitoramento</h2>
            <p className="text-sm text-muted-foreground">
              Histórico e estatísticas das execuções de monitoramento
            </p>
          </div>
          <RelatorioMonitoramentoCard />
        </TabsContent>

        {/* Aba Relatório de Execuções (nova) */}
        <TabsContent value="execucoes" className="space-y-4">
          <RelatorioExecucoesPage embedded />
        </TabsContent>

        {/* Aba Cofre de Senhas (nova) */}
        <TabsContent value="cofre" className="space-y-4">
          <CofreSenhasPage embedded />
        </TabsContent>

        {/* Aba Preferências */}
        <TabsContent value="preferencias" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Preferências Pessoais</h2>
            <p className="text-sm text-muted-foreground">
              Configure suas preferências de aparência e acesso
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Perfil</CardTitle>
                  <CardDescription>Gerencie suas informações pessoais</CardDescription>
                </div>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Segurança</CardTitle>
                  <CardDescription>Altere sua senha e configurações de acesso</CardDescription>
                </div>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Aparência</CardTitle>
                  <CardDescription>Personalize o tema e visual do sistema</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        {/* Aba Parâmetros DJEN */}
        <TabsContent value="parametros-djen" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Parâmetros de Processamento DJEN</h2>
            <p className="text-sm text-muted-foreground">
              Configure estratégia, concorrência e delays do monitoramento DJEN
            </p>
          </div>
          <ParametrosDjenCard />
        </TabsContent>

        {/* Aba DJE-PDF Experimental */}
        <TabsContent value="dje-pdf" className="space-y-4">
          <ComparacaoDjenDje />
        </TabsContent>

        {/* Aba VPS Workers - Busca distribuída */}
        <TabsContent value="vps-workers" className="space-y-4">
          <WorkersDjenVpsPanel />
        </TabsContent>

      </Tabs>
    </MainLayout>
  );
}
