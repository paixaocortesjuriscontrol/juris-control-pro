import { useState } from "react";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Filter,
  AlertTriangle,
  Activity,
  Users,
  Loader2,
  Printer
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

const Relatorios = () => {
  const [periodo, setPeriodo] = useState("ultimo-mes");
  const [activeTab, setActiveTab] = useState("resumo");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExportPdf = () => {
    setExporting(true);
    
    toast({
      title: "Preparando impressão...",
      description: "Use 'Salvar como PDF' na caixa de impressão.",
    });

    // Pequeno delay para garantir que o toast apareça
    setTimeout(() => {
      window.print();
      setExporting(false);
    }, 500);
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
            <div className="ml-auto">
              <Button onClick={handleExportPdf} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">{exporting ? "Preparando..." : "Imprimir / PDF"}</span>
                <span className="sm:hidden">{exporting ? "..." : "PDF"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Header - only visible when printing */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold text-center">Relatório Geral</h1>
        <p className="text-center text-sm text-muted-foreground">
          Gerado em: {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid print:hidden">
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

        {/* Mostrar conteúdo ativo na tela, mas imprimir todas as seções */}
        <div className="print:space-y-8">
          <TabsContent value="resumo" className="mt-6 print:block print:mt-0">
            <div className="hidden print:block print:mb-4">
              <h2 className="text-xl font-semibold border-b pb-2">Resumo</h2>
            </div>
            <RelatorioResumo isActive={activeTab === "resumo"} />
          </TabsContent>

          <TabsContent value="atividades" className="mt-6 print:block print:mt-0 print:break-before-page">
            <div className="hidden print:block print:mb-4">
              <h2 className="text-xl font-semibold border-b pb-2">Atividades</h2>
            </div>
            <RelatorioAtividades isActive={activeTab === "atividades"} />
          </TabsContent>

          <TabsContent value="clientes" className="mt-6 print:block print:mt-0 print:break-before-page">
            <div className="hidden print:block print:mb-4">
              <h2 className="text-xl font-semibold border-b pb-2">Clientes</h2>
            </div>
            <RelatorioClientes isActive={activeTab === "clientes"} />
          </TabsContent>
        </div>
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
