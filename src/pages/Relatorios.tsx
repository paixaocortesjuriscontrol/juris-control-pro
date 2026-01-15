import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  BarChart3,
  Calendar,
  Filter,
  AlertTriangle,
  Activity,
  Users,
  Loader2,
  FileDown,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { toast as sonnerToast } from "@/components/ui/sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RelatorioResumo } from "@/components/relatorios/RelatorioResumo";
import { RelatorioPrazos } from "@/components/relatorios/RelatorioPrazos";
import { RelatorioTarefas } from "@/components/relatorios/RelatorioTarefas";
import { RelatorioAndamentos } from "@/components/relatorios/RelatorioAndamentos";
import { RelatorioClientes } from "@/components/relatorios/RelatorioClientes";
import { RelatorioPrintView } from "@/components/relatorios/RelatorioPrintView";
import { useRelatorioResumoData } from "@/hooks/useRelatorioResumoData";
import { useRelatorioPrazosData } from "@/hooks/useRelatorioPrazosData";
import { useRelatorioTarefasData } from "@/hooks/useRelatorioTarefasData";
import { useRelatorioAndamentosData } from "@/hooks/useRelatorioAndamentosData";
import { useRelatorioClientesData } from "@/hooks/useRelatorioClientesData";
import { useRelatorioCompletoData } from "@/hooks/useRelatorioCompletoData";

type ExportMode = "completo" | "resumo" | "atividades" | "clientes";

const exportModeLabel: Record<ExportMode, string> = {
  completo: "Completo",
  resumo: "Resumo",
  atividades: "Atividades",
  clientes: "Clientes",
};

const Relatorios = () => {
  const [periodo, setPeriodo] = useState("ultimo-mes");
  const [activeTab, setActiveTab] = useState("resumo");
  const [activeSubTab, setActiveSubTab] = useState("prazos");

  const [exportMode, setExportMode] = useState<ExportMode>("completo");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [printOverride, setPrintOverride] = useState<
    | null
    | {
        resumoData?: any;
        atividadesData?: any;
        clientesData?: any;
      }
  >(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Carregar dados de todos os relatórios para exportação
  const { data: resumoData, isLoading: resumoLoading, refetch: refetchResumo } =
    useRelatorioResumoData(true);
  const { data: prazosData, isLoading: prazosLoading, refetch: refetchPrazos } =
    useRelatorioPrazosData(true);
  const { data: tarefasData, isLoading: tarefasLoading, refetch: refetchTarefas } =
    useRelatorioTarefasData(true);
  const {
    data: andamentosData,
    isLoading: andamentosLoading,
    refetch: refetchAndamentos,
  } = useRelatorioAndamentosData(true);
  const {
    data: clientesData,
    isLoading: clientesLoading,
    refetch: refetchClientes,
  } = useRelatorioClientesData(true);
  const {
    data: completoData,
    isLoading: completoLoading,
    refetch: refetchCompleto,
  } = useRelatorioCompletoData(true);
  // Mostrar loading inicial (apenas na primeira carga)
  const allLoading = [
    resumoLoading,
    prazosLoading,
    tarefasLoading,
    andamentosLoading,
    clientesLoading,
  ];
  const initialLoading = allLoading.some(Boolean);

  // Calcular percentual de carregamento inicial
  const loadedCount = allLoading.filter((loading) => !loading).length;
  const initialProgress = Math.round((loadedCount / 5) * 100);

  const exportTasks = useMemo(() => {
    const tasks: Array<{ key: string; label: string; fn: () => Promise<any> }> = [];

    if (exportMode === "completo" || exportMode === "resumo") {
      tasks.push({ key: "resumo", label: "Resumo", fn: refetchResumo });
    }

    if (exportMode === "completo" || exportMode === "atividades") {
      tasks.push({ key: "prazos", label: "Prazos", fn: refetchPrazos });
      tasks.push({ key: "tarefas", label: "Tarefas", fn: refetchTarefas });
      tasks.push({ key: "andamentos", label: "Andamentos", fn: refetchAndamentos });
    }

    if (exportMode === "completo" || exportMode === "clientes") {
      tasks.push({ key: "clientes", label: "Clientes", fn: refetchClientes });
    }

    return tasks;
  }, [exportMode, refetchAndamentos, refetchClientes, refetchPrazos, refetchResumo, refetchTarefas]);

  const handleExportPdf = async () => {
    if (exporting) return;

    const tasks = exportTasks;
    if (tasks.length === 0) return;

    setExporting(true);
    setExportProgress(0);

    const totalSteps = tasks.length + 2; // +2 para render e geração do PDF
    let completed = 0;

    const results = await Promise.all(
      tasks.map(async (t) => {
        try {
          const r = await t.fn();
          return { ...t, ok: true as const, data: (r as any)?.data };
        } catch (e) {
          return { ...t, ok: false as const, error: e };
        } finally {
          completed++;
          setExportProgress(Math.round((completed / totalSteps) * 100));
        }
      })
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      sonnerToast.error(
        `Falha ao carregar: ${failed.map((f) => f.label).join(", ")}. Tente novamente.`
      );
      setExporting(false);
      setExportProgress(0);
      return;
    }

    const pick = (key: string, fallback: any) => {
      const found = results.find((r) => r.key === key && r.ok);
      return found && "data" in found ? found.data : fallback;
    };

    const nextResumo = pick("resumo", resumoData);
    const nextPrazos = pick("prazos", prazosData);
    const nextTarefas = pick("tarefas", tarefasData);
    const nextAndamentos = pick("andamentos", andamentosData);
    const nextClientes = pick("clientes", clientesData);

    const nextAtividadesData = {
      totalPrazos: nextPrazos?.totalPrazos ?? 0,
      prazosStatus: nextPrazos?.prazosStatus ?? [],
      atividadesConcluidas: nextTarefas?.totalConcluidas ?? 0,
      atividadesNaoConcluidas: nextTarefas?.totalPendentes ?? 0,
      atividadesPorArea: nextTarefas?.atividadesPorArea ?? [],
      evolucaoAndamentos: nextAndamentos?.evolucaoAndamentos ?? [],
      andamentosPorArea: nextAndamentos?.andamentosPorArea ?? [],
    };

    setPrintOverride({
      resumoData: nextResumo,
      atividadesData: nextAtividadesData,
      clientesData: nextClientes,
    });

    // Aguarda render completo
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await new Promise((resolve) => setTimeout(resolve, 500));
    completed++;
    setExportProgress(Math.round((completed / totalSteps) * 100));

    // Gerar PDF com html2canvas + jsPDF
    try {
      const element = printRef.current;
      if (!element) {
        throw new Error("Elemento de impressão não encontrado");
      }

      // Tornar visível e posicionar fora da tela para captura
      const originalClassName = element.className;
      element.className = element.className.replace('pdf-capture-hidden', 'pdf-capture-visible');
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.top = "0";
      element.style.width = "210mm"; // A4 width
      element.style.background = "white";
      element.style.zIndex = "-1";
      element.style.display = "block";

      // Aguarda render completo de todos os gráficos e seções
      await new Promise((resolve) => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 794, // A4 width in pixels at 96 DPI
      });

      // Restaurar estado original
      element.className = originalClassName;
      element.style.position = "";
      element.style.left = "";
      element.style.top = "";
      element.style.width = "";
      element.style.background = "";
      element.style.zIndex = "";
      element.style.display = "";

      completed++;
      setExportProgress(Math.round((completed / totalSteps) * 100));

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Margens em mm - aumentadas para evitar cortes
      const marginLeft = 15;
      const marginTop = 20;
      const marginRight = 15;
      const marginBottom = 20;

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfWidth - marginLeft - marginRight;
      const contentHeight = pdfHeight - marginTop - marginBottom;

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      let heightLeft = scaledHeight;
      let sourceY = 0;
      let page = 0;

      // Altura em pixels por página
      const pageHeightInPx = contentHeight / ratio;

      while (heightLeft > 0) {
        if (page > 0) {
          pdf.addPage();
        }

        // Criar canvas parcial para cada página
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pageHeightInPx, canvas.height - sourceY);
        
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, sourceY,
            canvas.width, pageCanvas.height,
            0, 0,
            canvas.width, pageCanvas.height
          );
        }

        const pageImgData = pageCanvas.toDataURL("image/png");
        const pageScaledHeight = (pageCanvas.height * ratio);

        pdf.addImage(
          pageImgData,
          "PNG",
          marginLeft,
          marginTop,
          contentWidth,
          pageScaledHeight
        );

        sourceY += pageHeightInPx;
        heightLeft -= contentHeight;
        page++;
      }

      // Gerar nome do arquivo
      const dataAtual = format(new Date(), "ddMMyyyy");
      const sufixo = exportMode === "completo" ? "Relatorio_Gerencial" : `Relatorio_${exportModeLabel[exportMode]}`;
      const nomeArquivo = `Juris_Control_${sufixo}_${dataAtual}.pdf`;

      // Download automático
      pdf.save(nomeArquivo);

      sonnerToast.success(`PDF "${nomeArquivo}" gerado com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      sonnerToast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setExporting(false);
      setExportProgress(0);
      setPrintOverride(null);
    }
  };

  // Dados padrão (tela) — usados quando não há override de exportação
  const atividadesData = {
    totalPrazos: prazosData?.totalPrazos ?? 0,
    prazosStatus: prazosData?.prazosStatus ?? [],
    atividadesConcluidas: tarefasData?.totalConcluidas ?? 0,
    atividadesNaoConcluidas: tarefasData?.totalPendentes ?? 0,
    atividadesPorArea: tarefasData?.atividadesPorArea ?? [],
    evolucaoAndamentos: andamentosData?.evolucaoAndamentos ?? [],
    andamentosPorArea: andamentosData?.andamentosPorArea ?? [],
  };

  const printResumoData = printOverride?.resumoData ?? resumoData;
  const printAtividadesData = printOverride?.atividadesData ?? atividadesData;
  const printClientesData = printOverride?.clientesData ?? clientesData;

  return (
    <MainLayout title="Relatórios" subtitle="Análise e métricas do escritório">
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
              <div className="flex items-center gap-2">
                <Select value={exportMode} onValueChange={(v) => setExportMode(v as ExportMode)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Exportação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completo">PDF Completo</SelectItem>
                    <SelectItem value="resumo">Somente Resumo</SelectItem>
                    <SelectItem value="atividades">Somente Atividades</SelectItem>
                    <SelectItem value="clientes">Somente Clientes</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleExportPdf} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">{exporting ? "Gerando..." : "Exportar PDF"}</span>
                  <span className="sm:hidden">{exporting ? "..." : "PDF"}</span>
                </Button>
              </div>

              {(initialLoading || exporting) && (
                <div className="w-40 flex items-center gap-2">
                  <Progress value={exporting ? exportProgress : initialProgress} className="h-2" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {exporting ? exportProgress : initialProgress}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Componente de impressão - visível apenas ao imprimir */}
      <RelatorioPrintView
        ref={printRef}
        mode={exportMode}
        resumoData={printResumoData}
        atividadesData={printAtividadesData}
        clientesData={printClientesData}
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
          {/* Sub-tabs para Atividades */}
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="prazos" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Prazos</span>
                {prazosLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </TabsTrigger>
              <TabsTrigger value="tarefas" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Tarefas</span>
                {tarefasLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </TabsTrigger>
              <TabsTrigger value="andamentos" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Andamentos</span>
                {andamentosLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prazos" className="mt-6">
              <RelatorioPrazos isActive={activeTab === "atividades" && activeSubTab === "prazos"} />
            </TabsContent>

            <TabsContent value="tarefas" className="mt-6">
              <RelatorioTarefas isActive={activeTab === "atividades" && activeSubTab === "tarefas"} />
            </TabsContent>

            <TabsContent value="andamentos" className="mt-6">
              <RelatorioAndamentos isActive={activeTab === "atividades" && activeSubTab === "andamentos"} />
            </TabsContent>
          </Tabs>
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

