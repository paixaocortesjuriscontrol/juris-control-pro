import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User, Bell, Shield, Palette, Building2 } from "lucide-react";
import { MonitoramentoRedistribuicoesCard } from "@/components/configuracoes/MonitoramentoRedistribuicoesCard";
import { MonitoramentoAndamentosCard } from "@/components/configuracoes/MonitoramentoAndamentosCard";
import { MonitoramentoDistribuicoesCard } from "@/components/configuracoes/MonitoramentoDistribuicoesCard";
import { MonitoramentoDjenCard } from "@/components/configuracoes/MonitoramentoDjenCard";
import { RelatorioMonitoramentoCard } from "@/components/configuracoes/RelatorioMonitoramentoCard";
import { NotificacoesEmailCard } from "@/components/configuracoes/NotificacoesEmailCard";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";

export default function Configuracoes() {
  const { data: coordenacoes = [], isLoading: loadingCoordenacoes } = useCoordenacoesFull();
  const [coordenacaoSelecionada, setCoordenacaoSelecionada] = useState<string | null>(null);

  return (
    <MainLayout title="Configurações" subtitle="Gerencie as configurações do sistema">
      <div className="space-y-8">
        {/* Seção de Monitoramento */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Monitoramento Automático</h2>
          
          {/* Seletor de Coordenação */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Coordenação</CardTitle>
                <CardDescription>
                  Selecione a coordenação para configurar o monitoramento
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="coordenacao">Coordenação</Label>
                <Select 
                  value={coordenacaoSelecionada || ''} 
                  onValueChange={(value) => setCoordenacaoSelecionada(value || null)}
                  disabled={loadingCoordenacoes}
                >
                  <SelectTrigger id="coordenacao">
                    <SelectValue placeholder="Selecione uma coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordenacoes.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id}>
                        {coord.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Monitoramento */}
          {coordenacaoSelecionada ? (
            <div className="grid gap-6 md:grid-cols-2">
              <MonitoramentoRedistribuicoesCard coordenacaoId={coordenacaoSelecionada} />
              <MonitoramentoAndamentosCard coordenacaoId={coordenacaoSelecionada} />
              <MonitoramentoDistribuicoesCard coordenacaoId={coordenacaoSelecionada} />
              <MonitoramentoDjenCard coordenacaoId={coordenacaoSelecionada} />
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Selecione uma coordenação
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha uma coordenação acima para configurar o monitoramento
                </p>
              </CardContent>
            </Card>
          )}
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
