import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Download,
  Loader2,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
}

interface CoordenacaoReportData {
  id: string;
  nome: string;
  djen: number;
  distribuicoes: number;
  alertas360: number;
  redistribuicoes: number;
  andamentos: number;
  prazos: number;
  tarefas: number;
  audiencias: number;
  intimacoes: number;
  total: number;
  detalhes: {
    djen: any[];
    distribuicoes: any[];
    alertas360: any[];
    redistribuicoes: any[];
    andamentos: any[];
    audiencias: any[];
    intimacoes: any[];
  };
}

// Helper para extrair número do processo do conteúdo
const extractProcessoNumero = (conteudo: string | null | undefined): string | null => {
  if (!conteudo) return null;
  const match = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
  return match ? match[1] : null;
};

export function GerarRelatorioPdfDialog({
  open,
  onOpenChange,
  periodoInicio,
  periodoFim,
  statusFilter = "pendente",
}: Props) {
  const [selectedCoordenacoes, setSelectedCoordenacoes] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
  });
  const { prazosUrgentes } = useNotificacoes();

  // Buscar tarefas
  const { data: tarefasPendentes = [] } = useQuery({
    queryKey: ["tarefas-pdf-report", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id, titulo, status, data_vencimento, prioridade,
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id)
        `);
      if (statusFilter !== "todas" && statusFilter !== "concluido") {
        query = query.eq("status", statusFilter as "pendente" | "cumprido" | "atrasado");
      } else if (statusFilter === "concluido") {
        query = query.eq("status", "cumprido");
      }
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  // Buscar audiências COM TODOS OS CAMPOS NECESSÁRIOS
  const { data: audienciasPendentes = [] } = useQuery({
    queryKey: ["audiencias-pdf-report", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("audiencias_detectadas")
        .select(`
          id, processo_numero, data_audiencia, hora, hora_brasilia, tipo_audiencia, status, 
          local_audiencia, polo_ativo, cliente, vara_camara, comarca, advogado,
          processo:processos!audiencias_detectadas_processo_id_fkey(id, numero, coordenacao_id)
        `);
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  // Buscar intimações
  const { data: intimacoesPendentes = [] } = useQuery({
    queryKey: ["intimacoes-pdf-report", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("intimacoes_detectadas")
        .select(`
          id, processo_numero, data_intimacao, tipo_intimacao, status, data_limite, descricao,
          processo:processos!intimacoes_detectadas_processo_id_fkey(id, numero, coordenacao_id)
        `);
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  // Buscar andamentos COM DESCRIÇÃO COMPLETA
  const { data: andamentosData = [] } = useQuery({
    queryKey: ["andamentos-pdf-report", periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("movimentacoes")
        .select(`
          id, descricao, data_movimentacao, created_at, tipo,
          processo:processos!movimentacoes_processo_id_fkey(id, numero, coordenacao_id, polo_ativo)
        `)
        .neq("tipo", "Redistribuição")
        .order("created_at", { ascending: false });
      
      if (periodoInicio) {
        query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      }
      if (periodoFim) {
        const fimMaisUm = new Date(periodoFim);
        fimMaisUm.setDate(fimMaisUm.getDate() + 1);
        query = query.lt("created_at", format(fimMaisUm, "yyyy-MM-dd"));
      }
      
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  // Calcular dados do relatório
  const reportData = useMemo<CoordenacaoReportData[]>(() => {
    const coordsToInclude = selectAll 
      ? coordenacoes 
      : coordenacoes.filter(c => selectedCoordenacoes.includes(c.id));

    return coordsToInclude.map(coord => {
      // DJEN
      const monIds = monitoramentosDjen
        .filter(m => m.coordenacao_id === coord.id)
        .map(m => m.id);
      const djenItems = publicacoes.filter(p => 
        monIds.includes(p.monitoramento_id) && (statusFilter === "todas" || !p.lida)
      );

      // Distribuições
      const distItems = distribuicoesEncontradas.filter(d => 
        (d as any).monitoramento?.coordenacao_id === coord.id &&
        (statusFilter === "todas" || d.status === 'pendente')
      );

      // Alertas 360
      const alertasItems = alertas.filter(a => 
        a.processo?.coordenacao_id === coord.id &&
        (statusFilter === "todas" || a.status === 'pendente')
      );

      // Redistribuições
      const redistItems = redistribuicoesData.filter(r => r.coordenacao_nome === coord.nome);

      // Andamentos
      const andItems = andamentosData.filter(a => 
        (a.processo as any)?.coordenacao_id === coord.id
      );

      // Audiências
      const audItems = audienciasPendentes.filter(a => 
        (a.processo as any)?.coordenacao_id === coord.id
      );

      // Intimações
      const intItems = intimacoesPendentes.filter(i => 
        (i.processo as any)?.coordenacao_id === coord.id
      );

      // Prazos
      const prazosItems = prazosUrgentes.filter(p => p.processo?.coordenacao_id === coord.id);

      // Tarefas
      const tarefasItems = tarefasPendentes.filter(t => 
        (t.processo as any)?.coordenacao_id === coord.id
      );

      return {
        id: coord.id,
        nome: coord.nome,
        djen: djenItems.length,
        distribuicoes: distItems.length,
        alertas360: alertasItems.length,
        redistribuicoes: redistItems.length,
        andamentos: andItems.length,
        prazos: prazosItems.length,
        tarefas: tarefasItems.length,
        audiencias: audItems.length,
        intimacoes: intItems.length,
        total: djenItems.length + distItems.length + alertasItems.length + 
               redistItems.length + andItems.length + prazosItems.length + 
               tarefasItems.length + audItems.length + intItems.length,
        detalhes: {
          djen: djenItems.slice(0, 10),
          distribuicoes: distItems.slice(0, 10),
          alertas360: alertasItems.slice(0, 10),
          redistribuicoes: redistItems.slice(0, 10),
          andamentos: andItems.slice(0, 15),
          audiencias: audItems.slice(0, 10),
          intimacoes: intItems.slice(0, 10),
        },
      };
    }).filter(c => c.total > 0);
  }, [
    coordenacoes, selectedCoordenacoes, selectAll, publicacoes, monitoramentosDjen,
    distribuicoesEncontradas, alertas, redistribuicoesData, andamentosData,
    audienciasPendentes, intimacoesPendentes, prazosUrgentes, tarefasPendentes, statusFilter
  ]);

  const totalGeral = useMemo(() => {
    return reportData.reduce((acc, c) => ({
      djen: acc.djen + c.djen,
      distribuicoes: acc.distribuicoes + c.distribuicoes,
      alertas360: acc.alertas360 + c.alertas360,
      redistribuicoes: acc.redistribuicoes + c.redistribuicoes,
      andamentos: acc.andamentos + c.andamentos,
      prazos: acc.prazos + c.prazos,
      tarefas: acc.tarefas + c.tarefas,
      audiencias: acc.audiencias + c.audiencias,
      intimacoes: acc.intimacoes + c.intimacoes,
      total: acc.total + c.total,
    }), {
      djen: 0, distribuicoes: 0, alertas360: 0, redistribuicoes: 0,
      andamentos: 0, prazos: 0, tarefas: 0, audiencias: 0, intimacoes: 0, total: 0
    });
  }, [reportData]);

  // Calcular contagem de alertas por coordenação para exibir no dialog
  const getCoordenacaoAlertCount = useMemo(() => {
    return (coordId: string) => {
      const found = reportData.find(r => r.id === coordId);
      return found?.total || 0;
    };
  }, [reportData]);

  const handleSelectAll = () => {
    setSelectAll(true);
    setSelectedCoordenacoes([]);
  };

  const handleToggleCoordenacao = (id: string) => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedCoordenacoes(coordenacoes.filter(c => c.id !== id).map(c => c.id));
    } else {
      setSelectedCoordenacoes(prev =>
        prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
      );
    }
  };

  const handleGeneratePdf = async () => {
    if (reportData.length === 0) {
      toast.error("Nenhum dado para gerar o relatório");
      return;
    }

    setGenerating(true);
    setProgress(10);

    try {
      const element = printRef.current;
      if (!element) throw new Error("Elemento não encontrado");

      // Tornar visível para captura
      element.style.display = "block";
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.top = "0";
      element.style.width = "210mm";
      element.style.background = "white";
      element.style.zIndex = "-1";

      await new Promise(r => setTimeout(r, 500));
      setProgress(30);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = 10;
      const marginTop = 10;
      const contentWidth = pdfWidth - 20;

      // Capturar cada página
      const pages = Array.from(element.querySelectorAll("[data-pdf-page]")) as HTMLElement[];
      const pageElements = pages.length > 0 ? pages : [element];

      let isFirstPage = true;
      const progressPerPage = 60 / pageElements.length;

      for (let i = 0; i < pageElements.length; i++) {
        const page = pageElements[i];

        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        if (!isFirstPage) {
          pdf.addPage();
        }

        // Se a imagem for maior que uma página, dividir
        let remainingHeight = imgHeight;
        let sourceY = 0;
        const pageContentHeight = pdfHeight - 20;

        while (remainingHeight > 0) {
          if (sourceY > 0) {
            pdf.addPage();
          }

          const sliceHeight = Math.min(remainingHeight, pageContentHeight);
          const sourceHeight = (sliceHeight * canvas.height) / imgHeight;

          // Criar canvas temporário para a fatia
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = canvas.width;
          tempCanvas.height = sourceHeight;
          const ctx = tempCanvas.getContext("2d")!;
          ctx.drawImage(
            canvas,
            0, (sourceY * canvas.height) / imgHeight,
            canvas.width, sourceHeight,
            0, 0,
            canvas.width, sourceHeight
          );

          const sliceData = tempCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", marginLeft, marginTop, imgWidth, sliceHeight);

          sourceY += sliceHeight;
          remainingHeight -= sliceHeight;
        }

        isFirstPage = false;
        setProgress(30 + (i + 1) * progressPerPage);
      }

      setProgress(95);

      // Download
      const dataStr = format(new Date(), "yyyy-MM-dd");
      pdf.save(`relatorio-notificacoes-${dataStr}.pdf`);

      element.style.display = "none";
      setProgress(100);
      toast.success("Relatório PDF gerado com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar o relatório PDF");
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const periodoLabel = periodoInicio && periodoFim
    ? `${format(periodoInicio, "dd/MM/yyyy")} a ${format(periodoFim, "dd/MM/yyyy")}`
    : "Período atual";

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Relatório PDF
          </DialogTitle>
          <DialogDescription>
            Selecione as coordenações para incluir no relatório da diretoria
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de coordenações */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Coordenações</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className={selectAll ? "text-primary" : ""}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {selectAll ? "Todas selecionadas" : "Selecionar todas"}
              </Button>
            </div>

            <ScrollArea className="h-48 border rounded-md p-3">
              <div className="space-y-2">
                {coordenacoes.map(coord => {
                  const isSelected = selectAll || selectedCoordenacoes.includes(coord.id);
                  const alertCount = getCoordenacaoAlertCount(coord.id);
                  
                  return (
                    <div
                      key={coord.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleToggleCoordenacao(coord.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} />
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{coord.nome}</span>
                      </div>
                      {alertCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {alertCount} alertas
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Resumo */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Resumo do Relatório</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-2xl font-bold text-primary">{reportData.length}</div>
                <div className="text-xs text-muted-foreground">Coordenações</div>
              </div>
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-2xl font-bold text-amber-600">{totalGeral.total}</div>
                <div className="text-xs text-muted-foreground">Total Alertas</div>
              </div>
              <div className="text-center p-2 bg-background rounded-md">
                <div className="text-lg font-medium text-muted-foreground">{periodoLabel}</div>
                <div className="text-xs text-muted-foreground">Período</div>
              </div>
            </div>
          </div>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando relatório...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button onClick={handleGeneratePdf} disabled={generating || reportData.length === 0}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Conteúdo para impressão (hidden) */}
      <div ref={printRef} style={{ display: "none" }}>
        {/* Capa */}
        <div data-pdf-page="cover" style={{ 
          padding: "40px", 
          fontFamily: "Arial, sans-serif",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          color: "white",
          minHeight: "297mm",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <div style={{
            width: "80px",
            height: "80px",
            background: "linear-gradient(135deg, #d4a015 0%, #eab308 100%)",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32px",
            fontSize: "40px",
          }}>
            ⚖️
          </div>
          <h1 style={{ 
            fontSize: "32px", 
            fontWeight: "bold", 
            marginBottom: "8px",
            textAlign: "center",
          }}>
            RELATÓRIO EXECUTIVO
          </h1>
          <h2 style={{ 
            fontSize: "20px", 
            opacity: 0.9, 
            marginBottom: "32px",
            textAlign: "center",
          }}>
            Central de Notificações
          </h2>
          <div style={{ 
            background: "rgba(255,255,255,0.1)", 
            padding: "24px 48px", 
            borderRadius: "12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "14px", opacity: 0.7, marginBottom: "4px" }}>Período</div>
            <div style={{ fontSize: "18px", fontWeight: "500" }}>{periodoLabel}</div>
          </div>
          <div style={{ marginTop: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "16px", fontWeight: "600" }}>Juris Control</div>
            <div style={{ fontSize: "12px", opacity: 0.7 }}>Paixão Cortes Advogados</div>
            <div style={{ fontSize: "12px", opacity: 0.5, marginTop: "8px" }}>{dataAtual}</div>
          </div>
        </div>

        {/* Sumário Executivo */}
        <div data-pdf-page="summary" style={{ 
          padding: "30px", 
          fontFamily: "Arial, sans-serif",
          background: "white",
          color: "#1a1a2e",
        }}>
          <div style={{ 
            borderBottom: "3px solid #eab308", 
            paddingBottom: "16px", 
            marginBottom: "24px" 
          }}>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#1a1a2e", margin: 0 }}>
              Sumário Executivo
            </h2>
          </div>

          {/* Totais Gerais */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(5, 1fr)", 
            gap: "12px",
            marginBottom: "32px",
          }}>
            {[
              { label: "DJEN", value: totalGeral.djen, color: "#eab308" },
              { label: "Andamentos", value: totalGeral.andamentos, color: "#8b5cf6" },
              { label: "Audiências", value: totalGeral.audiencias, color: "#0ea5e9" },
              { label: "Redistribuições", value: totalGeral.redistribuicoes, color: "#f97316" },
              { label: "Intimações", value: totalGeral.intimacoes, color: "#7c3aed" },
            ].map(item => (
              <div key={item.label} style={{
                background: "#f8fafc",
                border: `2px solid ${item.color}`,
                borderRadius: "8px",
                padding: "16px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: item.color }}>
                  {item.value}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela de Coordenações */}
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>
            Visão por Coordenação
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#1a1a2e", color: "white" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>Coordenação</th>
                <th style={{ padding: "10px", textAlign: "center" }}>DJEN</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Andamentos</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Audiências</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Redistribuições</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Intimações</th>
                <th style={{ padding: "10px", textAlign: "center", background: "#eab308", color: "#1a1a2e" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((coord, idx) => (
                <tr key={coord.id} style={{ background: idx % 2 === 0 ? "#f8fafc" : "white" }}>
                  <td style={{ padding: "10px", fontWeight: "500" }}>{coord.nome}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{coord.djen}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{coord.andamentos}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{coord.audiencias}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{coord.redistribuicoes}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{coord.intimacoes}</td>
                  <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold", color: "#eab308" }}>
                    {coord.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a1a2e", color: "white", fontWeight: "bold" }}>
                <td style={{ padding: "10px" }}>TOTAL GERAL</td>
                <td style={{ padding: "10px", textAlign: "center" }}>{totalGeral.djen}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>{totalGeral.andamentos}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>{totalGeral.audiencias}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>{totalGeral.redistribuicoes}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>{totalGeral.intimacoes}</td>
                <td style={{ padding: "10px", textAlign: "center", background: "#eab308", color: "#1a1a2e" }}>
                  {totalGeral.total}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Detalhamento por Coordenação */}
        {reportData.map(coord => (
          <div key={coord.id} data-pdf-page={`coord-${coord.id}`} style={{ 
            padding: "30px", 
            fontFamily: "Arial, sans-serif",
            background: "white",
            pageBreakBefore: "always",
          }}>
            <div style={{ 
              borderBottom: "3px solid #eab308", 
              paddingBottom: "12px", 
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a2e", margin: 0 }}>
                {coord.nome}
              </h2>
              <div style={{ 
                background: "#eab308", 
                color: "#1a1a2e", 
                padding: "6px 16px", 
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "bold",
              }}>
                {coord.total} alertas
              </div>
            </div>

            {/* Cards de estatísticas */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(4, 1fr)", 
              gap: "10px",
              marginBottom: "24px",
            }}>
              {[
                { label: "DJEN", value: coord.djen, color: "#eab308" },
                { label: "Andamentos", value: coord.andamentos, color: "#8b5cf6" },
                { label: "Audiências", value: coord.audiencias, color: "#0ea5e9" },
                { label: "Redistribuições", value: coord.redistribuicoes, color: "#f97316" },
              ].filter(i => i.value > 0).map(item => (
                <div key={item.label} style={{
                  background: "#f8fafc",
                  borderLeft: `4px solid ${item.color}`,
                  padding: "12px",
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* ============ DJEN - Com número do processo extraído ============ */}
            {coord.detalhes.djen.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "600", color: "#eab308", marginBottom: "8px" }}>
                  📰 Publicações DJEN ({coord.djen})
                </h4>
                <div style={{ fontSize: "10px", color: "#333" }}>
                  {coord.detalhes.djen.map((p: any, i: number) => {
                    // Priorizar processo_numero, senão extrair do conteúdo
                    const processoNumero = p.processo_numero || extractProcessoNumero(p.conteudo) || "Número não identificado";
                    return (
                      <div key={i} style={{ 
                        padding: "8px", 
                        borderBottom: "1px solid #e5e7eb",
                        background: i % 2 === 0 ? "#fafafa" : "white",
                      }}>
                        <div style={{ fontWeight: "600", color: "#1a1a2e", marginBottom: "4px" }}>
                          {processoNumero}
                        </div>
                        <div style={{ color: "#64748b", lineHeight: "1.4" }}>
                          {(p.conteudo || "Sem conteúdo").substring(0, 200)}...
                        </div>
                        {p.data_publicacao && (
                          <div style={{ marginTop: "4px", color: "#94a3b8", fontSize: "9px" }}>
                            Publicado em: {formatDate(p.data_publicacao)} | Fonte: {p.fonte || "-"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {coord.djen > 10 && (
                    <div style={{ fontStyle: "italic", marginTop: "8px", color: "#64748b" }}>
                      ... e mais {coord.djen - 10} publicações
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ ANDAMENTOS - Descrição COMPLETA ============ */}
            {coord.detalhes.andamentos.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "600", color: "#8b5cf6", marginBottom: "8px" }}>
                  📋 Andamentos ({coord.andamentos})
                </h4>
                <div style={{ fontSize: "10px", color: "#333" }}>
                  {coord.detalhes.andamentos.map((a: any, i: number) => (
                    <div key={i} style={{ 
                      padding: "8px", 
                      borderBottom: "1px solid #e5e7eb",
                      background: i % 2 === 0 ? "#fafafa" : "white",
                    }}>
                      <div style={{ fontWeight: "600", color: "#1a1a2e", marginBottom: "4px" }}>
                        {(a.processo as any)?.numero || "Processo não identificado"}
                      </div>
                      {/* DESCRIÇÃO COMPLETA - Sem corte */}
                      <div style={{ color: "#374151", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                        {a.descricao || "Sem descrição"}
                      </div>
                      <div style={{ marginTop: "4px", color: "#94a3b8", fontSize: "9px" }}>
                        Data: {formatDate(a.data_movimentacao)} | Tipo: {a.tipo || "-"}
                      </div>
                    </div>
                  ))}
                  {coord.andamentos > 15 && (
                    <div style={{ fontStyle: "italic", marginTop: "8px", color: "#64748b" }}>
                      ... e mais {coord.andamentos - 15} andamentos
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ AUDIÊNCIAS - Com TODOS os detalhes ============ */}
            {coord.detalhes.audiencias.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "600", color: "#0ea5e9", marginBottom: "8px" }}>
                  📅 Audiências ({coord.audiencias})
                </h4>
                <div style={{ fontSize: "10px", color: "#333" }}>
                  {coord.detalhes.audiencias.map((a: any, i: number) => {
                    const hora = a.hora_brasilia || a.hora;
                    const local = [a.local_audiencia, a.vara_camara, a.comarca].filter(Boolean).join(" - ");
                    const parte = a.cliente || a.polo_ativo;
                    return (
                      <div key={i} style={{ 
                        padding: "10px", 
                        borderBottom: "1px solid #e5e7eb",
                        background: i % 2 === 0 ? "#f0f9ff" : "white",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontWeight: "600", color: "#1a1a2e" }}>
                            {a.processo_numero}
                          </span>
                          <span style={{ 
                            background: a.tipo_audiencia ? "#0ea5e9" : "#94a3b8", 
                            color: "white", 
                            padding: "2px 8px", 
                            borderRadius: "10px",
                            fontSize: "9px",
                          }}>
                            {a.tipo_audiencia || "Audiência"}
                          </span>
                        </div>
                        
                        {/* Data e Hora */}
                        <div style={{ color: "#0369a1", fontWeight: "500", marginBottom: "4px" }}>
                          🗓️ {formatDate(a.data_audiencia)} {hora ? `às ${hora}` : ""}
                        </div>
                        
                        {/* Local */}
                        {local && (
                          <div style={{ color: "#64748b", marginBottom: "2px" }}>
                            📍 {local}
                          </div>
                        )}
                        
                        {/* Cliente/Parte */}
                        {parte && (
                          <div style={{ color: "#64748b", marginBottom: "2px" }}>
                            👤 Parte: {parte}
                          </div>
                        )}
                        
                        {/* Advogado */}
                        {a.advogado && (
                          <div style={{ color: "#64748b" }}>
                            ⚖️ Advogado: {a.advogado}
                          </div>
                        )}
                        
                        {/* Status */}
                        <div style={{ marginTop: "4px" }}>
                          <span style={{
                            background: a.status === "pendente" ? "#fef3c7" : "#d1fae5",
                            color: a.status === "pendente" ? "#92400e" : "#065f46",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "9px",
                          }}>
                            {a.status === "pendente" ? "Pendente" : a.status === "tratado" ? "Tratado" : a.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============ REDISTRIBUIÇÕES - Com LOCAL (Vara origem → destino) ============ */}
            {coord.detalhes.redistribuicoes.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "600", color: "#f97316", marginBottom: "8px" }}>
                  🔄 Redistribuições ({coord.redistribuicoes})
                </h4>
                <div style={{ fontSize: "10px", color: "#333" }}>
                  {coord.detalhes.redistribuicoes.map((r: any, i: number) => (
                    <div key={i} style={{ 
                      padding: "10px", 
                      borderBottom: "1px solid #e5e7eb",
                      background: i % 2 === 0 ? "#fff7ed" : "white",
                    }}>
                      <div style={{ fontWeight: "600", color: "#1a1a2e", marginBottom: "6px" }}>
                        {r.processo_numero}
                      </div>
                      
                      {/* Vara origem → destino */}
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px",
                        background: "#fef3c7",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        marginBottom: "6px",
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "9px", color: "#92400e", marginBottom: "2px" }}>ORIGEM</div>
                          <div style={{ fontWeight: "500", color: "#78350f" }}>{r.vara_antiga || "Não informada"}</div>
                        </div>
                        <div style={{ fontSize: "16px", color: "#f97316" }}>→</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "9px", color: "#065f46", marginBottom: "2px" }}>DESTINO</div>
                          <div style={{ fontWeight: "500", color: "#064e3b" }}>{r.vara_nova || "Não informada"}</div>
                        </div>
                      </div>
                      
                      {/* Advogado responsável */}
                      {r.advogado_nome && (
                        <div style={{ color: "#64748b", fontSize: "9px" }}>
                          ⚖️ Responsável: {r.advogado_nome}
                        </div>
                      )}
                      
                      {/* Data */}
                      <div style={{ color: "#94a3b8", fontSize: "9px", marginTop: "4px" }}>
                        Data: {formatDate(r.data_redistribuicao)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Intimações */}
            {coord.detalhes.intimacoes.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed", marginBottom: "8px" }}>
                  ⚠️ Intimações ({coord.intimacoes})
                </h4>
                <div style={{ fontSize: "10px", color: "#333" }}>
                  {coord.detalhes.intimacoes.map((int: any, i: number) => (
                    <div key={i} style={{ 
                      padding: "8px", 
                      borderBottom: "1px solid #e5e7eb",
                      background: i % 2 === 0 ? "#faf5ff" : "white",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "600", color: "#1a1a2e" }}>
                          {int.processo_numero}
                        </span>
                        {int.tipo_intimacao && (
                          <span style={{ 
                            background: "#7c3aed", 
                            color: "white", 
                            padding: "2px 8px", 
                            borderRadius: "10px",
                            fontSize: "9px",
                          }}>
                            {int.tipo_intimacao}
                          </span>
                        )}
                      </div>
                      {int.descricao && (
                        <div style={{ color: "#64748b", marginBottom: "4px", lineHeight: "1.4" }}>
                          {int.descricao}
                        </div>
                      )}
                      <div style={{ color: "#94a3b8", fontSize: "9px" }}>
                        Data: {formatDate(int.data_intimacao)}
                        {int.data_limite && ` | Prazo: ${formatDate(int.data_limite)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Rodapé */}
        <div data-pdf-page="footer" style={{ 
          padding: "30px", 
          fontFamily: "Arial, sans-serif",
          background: "#1a1a2e",
          color: "white",
          textAlign: "center",
          minHeight: "100px",
        }}>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
            Juris Control | Paixão Cortes Advogados
          </div>
          <div style={{ fontSize: "11px", opacity: 0.7 }}>
            Relatório gerado automaticamente em {dataAtual}
          </div>
          <div style={{ fontSize: "10px", opacity: 0.5, marginTop: "8px" }}>
            juriscontrol.adv.br
          </div>
        </div>
      </div>
    </Dialog>
  );
}
