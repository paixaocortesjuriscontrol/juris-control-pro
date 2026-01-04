import { useState, useRef } from "react";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Filter,
  AlertTriangle,
  Activity,
  Users,
  Loader2,
  FileDown
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
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
import { RelatorioResumo } from "@/components/relatorios/RelatorioResumo";
import { RelatorioAtividades } from "@/components/relatorios/RelatorioAtividades";
import { RelatorioClientes } from "@/components/relatorios/RelatorioClientes";
import { RelatorioPrintView } from "@/components/relatorios/RelatorioPrintView";
import { useRelatorioResumoData } from "@/hooks/useRelatorioResumoData";
import { useRelatorioAtividadesData } from "@/hooks/useRelatorioAtividadesData";
import { useRelatorioClientesData } from "@/hooks/useRelatorioClientesData";

const Relatorios = () => {
  const [periodo, setPeriodo] = useState("ultimo-mes");
  const [activeTab, setActiveTab] = useState("resumo");
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Carregar dados de todos os relatórios para exportação
  const { data: resumoData, isLoading: resumoLoading } = useRelatorioResumoData(true);
  const { data: atividadesData, isLoading: atividadesLoading } = useRelatorioAtividadesData(true);
  const { data: clientesData, isLoading: clientesLoading } = useRelatorioClientesData(true);

  const canExportPdf = Boolean(resumoData && atividadesData && clientesData);
  const loadingExportData = resumoLoading || atividadesLoading || clientesLoading;

  // Calcular percentual de carregamento (0 a 100)
  const loadedCount = [resumoData, atividadesData, clientesData].filter(Boolean).length;
  const loadingProgress = Math.round((loadedCount / 3) * 100);

  const handleExportPdf = () => {
    if (exporting || loadingExportData || !canExportPdf) return;

    setExporting(true);

    const finish = () => {
      setExporting(false);
      window.removeEventListener("afterprint", finish);
    };

    // Em alguns navegadores mobile o afterprint pode não disparar; mantemos fallback.
    window.addEventListener("afterprint", finish);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });

    setTimeout(finish, 8000);
  };

  return (
    <MainLayout 
      title="Relatórios" 
      subtitle="Análise e métricas do escritório"
    >
      {/* Filters */}
      <Card className="mb-6 animate-fade-in print:hidden">
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
            <Button variant="outline" className="hidden sm:flex">
              <Filter className="w-4 h-4 mr-2" />
              Mais Filtros
            </Button>
            <div className="ml-auto flex flex-col items-end gap-2">
              <Button onClick={handleExportPdf} disabled={exporting || loadingExportData || !canExportPdf}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">
                  {exporting ? "Gerando..." : loadingExportData || !canExportPdf ? "Carregando dados..." : "Exportar PDF"}
                </span>
                <span className="sm:hidden">
                  {exporting ? "..." : loadingExportData || !canExportPdf ? "Car..." : "PDF"}
                </span>
              </Button>
              {loadingExportData && (
                <div className="w-40 flex items-center gap-2">
                  <Progress value={loadingProgress} className="h-2" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{loadingProgress}%</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Componente de impressão - visível apenas ao imprimir */}
      <RelatorioPrintView 
        ref={printRef}
        resumoData={resumoData}
        atividadesData={atividadesData}
        clientesData={clientesData}
      />

      {/* Tabs - escondido na impressão */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 print:hidden">
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
          <RelatorioResumo isActive={activeTab === "resumo"} />
        </TabsContent>

        <TabsContent value="atividades" className="mt-6">
          <RelatorioAtividades isActive={activeTab === "atividades"} />
        </TabsContent>

        <TabsContent value="clientes" className="mt-6">
          <RelatorioClientes isActive={activeTab === "clientes"} />
        </TabsContent>
      </Tabs>

      {/* Note about missing features */}
      <Card className="mt-6 animate-slide-up print:hidden">
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
