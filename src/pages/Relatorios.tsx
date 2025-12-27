import { useState } from "react";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Filter,
  AlertTriangle,
  FileText,
  Activity,
  Users
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRelatoriosData } from "@/hooks/useRelatoriosData";
import { CacheIndicator } from "@/components/ui/cache-indicator";
import { useQueryClient } from "@tanstack/react-query";
import { RelatorioResumo } from "@/components/relatorios/RelatorioResumo";
import { RelatorioAtividades } from "@/components/relatorios/RelatorioAtividades";
import { RelatorioClientes } from "@/components/relatorios/RelatorioClientes";

const Relatorios = () => {
  const [periodo, setPeriodo] = useState("ultimo-mes");
  const [activeTab, setActiveTab] = useState("resumo");
  const { data, isLoading, isFetching, isStale, dataUpdatedAt, refetch } = useRelatoriosData();
  const queryClient = useQueryClient();

  const handleForceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
    refetch();
  };

  if (isLoading) {
    return (
      <MainLayout 
        title="Relatórios" 
        subtitle="Análise e métricas do escritório"
      >
        <div className="space-y-6">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-12 w-96 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  const { 
    processosPerArea = [], 
    prazosStatus = [], 
    produtividadeAdvogados = [], 
    processosMensais = [],
    processosPorCliente = [],
    processosPorTipoPessoa = [],
    processosAtivosAnoAtual = 0,
    mediaEnvolvidos = "0",
    processosPorVara = [],
    duracaoClientes = [],
    atividadesConcluidas = 0,
    atividadesNaoConcluidas = 0,
    atividadesPorArea = [],
    atividadesPorTarefa = [],
    evolucaoAndamentos = [],
    andamentosPorArea = [],
    totalProcessos = 0,
    totalPrazos = 0,
    totalMovimentacoes = 0,
  } = data || {};

  return (
    <MainLayout 
      title="Relatórios" 
      subtitle="Análise e métricas do escritório"
    >
      {/* Filters */}
      <Card className="mb-6 animate-fade-in">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <CacheIndicator
              isFetching={isFetching}
              isStale={isStale}
              dataUpdatedAt={dataUpdatedAt}
              onRefresh={handleForceRefresh}
            />
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
            <Button variant="outline" className="hidden sm:flex">
              <Filter className="w-4 h-4 mr-2" />
              Mais Filtros
            </Button>
            <div className="ml-auto">
              <Button>
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Exportar Relatórios</span>
                <span className="sm:hidden">Exportar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="resumo" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="atividades" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Atividades</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-6">
          <RelatorioResumo
            totalProcessos={totalProcessos}
            processosAtivosAnoAtual={processosAtivosAnoAtual}
            mediaEnvolvidos={mediaEnvolvidos}
            totalMovimentacoes={totalMovimentacoes}
            processosPerArea={processosPerArea}
            processosPorTipoPessoa={processosPorTipoPessoa}
            processosMensais={processosMensais}
          />
        </TabsContent>

        <TabsContent value="atividades" className="mt-6">
          <RelatorioAtividades
            totalPrazos={totalPrazos}
            prazosStatus={prazosStatus}
            atividadesConcluidas={atividadesConcluidas}
            atividadesNaoConcluidas={atividadesNaoConcluidas}
            atividadesPorArea={atividadesPorArea}
            evolucaoAndamentos={evolucaoAndamentos}
            andamentosPorArea={andamentosPorArea}
          />
        </TabsContent>

        <TabsContent value="clientes" className="mt-6">
          <RelatorioClientes
            processosPorCliente={processosPorCliente}
            processosPorVara={processosPorVara}
            duracaoClientes={duracaoClientes}
            atividadesPorTarefa={atividadesPorTarefa}
            produtividadeAdvogados={produtividadeAdvogados}
          />
        </TabsContent>
      </Tabs>

      {/* Note about missing features */}
      <Card className="mt-6 animate-slide-up">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">Relatórios não disponíveis:</p>
              <p className="mt-1">
                <strong>Situação dos Atendimentos</strong> e <strong>Horas Lançadas por Apontamento</strong> 
                requerem tabelas adicionais no banco de dados (atendimentos e apontamentos de horas).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
};

export default Relatorios;
