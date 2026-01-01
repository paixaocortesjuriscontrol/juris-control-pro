import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Shield, Palette } from "lucide-react";
import { MonitoramentoRedistribuicoesCard } from "@/components/configuracoes/MonitoramentoRedistribuicoesCard";
import { MonitoramentoAndamentosCard } from "@/components/configuracoes/MonitoramentoAndamentosCard";
import { MonitoramentoDistribuicoesCard } from "@/components/configuracoes/MonitoramentoDistribuicoesCard";
import { MonitoramentoDjenCard } from "@/components/configuracoes/MonitoramentoDjenCard";
import { MonitoramentoDjenProcessosCard } from "@/components/configuracoes/MonitoramentoDjenProcessosCard";
import { RelatorioMonitoramentoCard } from "@/components/configuracoes/RelatorioMonitoramentoCard";
import { NotificacoesEmailCard } from "@/components/configuracoes/NotificacoesEmailCard";

export default function Configuracoes() {
  return (
    <MainLayout title="Configurações" subtitle="Gerencie as configurações do sistema">
      <div className="space-y-8">
        {/* Seção de Monitoramento */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Monitoramento Automático</h2>
          
          {/* Cards de Monitoramento - sempre visíveis */}
          <div className="grid gap-6 md:grid-cols-2">
            <MonitoramentoRedistribuicoesCard coordenacaoId="" />
            <MonitoramentoAndamentosCard coordenacaoId="" />
            <MonitoramentoDistribuicoesCard coordenacaoId="" />
            <MonitoramentoDjenCard coordenacaoId="" />
            <MonitoramentoDjenProcessosCard coordenacaoId="" />
          </div>
        </div>

        {/* Seção de Relatório de Monitoramento */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Relatórios de Monitoramento</h2>
          <RelatorioMonitoramentoCard />
        </div>

        {/* Seção de Preferências Pessoais */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Preferências Pessoais</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <NotificacoesEmailCard />
          </div>
        </div>

        {/* Seção de Configurações Gerais */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Configurações Gerais</h2>
          <div className="grid gap-6 md:grid-cols-2">
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
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Notificações</CardTitle>
                  <CardDescription>Configure alertas e lembretes</CardDescription>
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
        </div>
      </div>
    </MainLayout>
  );
}
