import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfDay, isBefore, isAfter } from "date-fns";
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
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}

interface CoordenacaoReportData {
  id: string;
  nome: string;
  djen: number;
  redistribuicoes: number;
  andamentos: number;
  audiencias: number;
  intimacoes: number;
  total: number; // DJEN + Redistribuições + Andamentos + Audiências + Intimações (igual Dashboard)
  detalhes: {
    djen: any[];
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
  searchQuery = "",
}: Props) {
  const [selectedCoordenacoes, setSelectedCoordenacoes] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
  });

  // Helper para filtrar por busca (igual tela)
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  const fetchProcessosByNumero = async (numeros: string[]) => {
    const unique = Array.from(new Set(numeros.filter(Boolean)));
    if (unique.length === 0) return new Map<string, any>();

    const map = new Map<string, any>();
    const CHUNK = 200;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, coordenacao_id")
        .in("numero", chunk);
      if (error) throw error;
      for (const p of data || []) {
        map.set((p as any).numero, p);
      }
    }
    return map;
  };

  // Helper para filtrar por período - IGUAL ao Dashboard
  const matchesPeriodo = useMemo(() => {
    return (dateStr: string | null | undefined) => {
      if (!dateStr) return true;
      if (!periodoInicio && !periodoFim) return true;
      
      try {
        const date = startOfDay(parseISO(dateStr));
        if (periodoInicio && isBefore(date, startOfDay(periodoInicio))) return false;
        if (periodoFim && isAfter(date, startOfDay(periodoFim))) return false;
        return true;
      } catch {
        return true;
      }
    };
  }, [periodoInicio, periodoFim]);

  // Buscar audiências COM TODOS OS CAMPOS NECESSÁRIOS
  const { data: audienciasPendentes = [] } = useQuery({
    queryKey: ["audiencias-pdf-report", statusFilter, periodoInicio, periodoFim],
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
      const { data, error } = await query;
      if (error) throw error;

      const rows: any[] = data || [];
      // Corrigir casos onde processo_id é nulo (processo embed vem null), mas processo_numero existe
      const missingNums = rows
        .filter(r => !(r as any).processo && (r as any).processo_numero)
        .map(r => (r as any).processo_numero as string);

      if (missingNums.length === 0) return rows;

      const processosMap = await fetchProcessosByNumero(missingNums);
      return rows.map(r => {
        if ((r as any).processo || !(r as any).processo_numero) return r;
        const proc = processosMap.get((r as any).processo_numero);
        return proc ? { ...r, processo: proc } : r;
      });
    },
    enabled: open,
  });

  // Buscar advogados vinculados (tabela de junção) para não perder detalhes no PDF
  const { data: advogadosPorAudiencia = {} as Record<string, string[]> } = useQuery({
    queryKey: ["audiencias-advogados-pdf", audienciasPendentes.map((a: any) => a.id)],
    queryFn: async () => {
      if (!audienciasPendentes.length) return {} as Record<string, string[]>;

      const { data, error } = await supabase
        .from("audiencias_advogados")
        .select(`
          audiencia_id,
          profiles:advogado_id(nome)
        `)
        .in(
          "audiencia_id",
          audienciasPendentes.map((a: any) => a.id)
        );

      if (error) throw error;

      const map: Record<string, string[]> = {};
      for (const row of (data || []) as any[]) {
        const audId = row.audiencia_id as string;
        const nome = row.profiles?.nome as string | undefined;
        if (!nome) continue;
        map[audId] = map[audId] || [];
        map[audId].push(nome);
      }
      return map;
    },
    enabled: open,
  });

  // Buscar intimações
  const { data: intimacoesPendentes = [] } = useQuery({
    queryKey: ["intimacoes-pdf-report", statusFilter, periodoInicio, periodoFim],
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
      const { data, error } = await query;
      if (error) throw error;

      const rows: any[] = data || [];
      const missingNums = rows
        .filter(r => !(r as any).processo && (r as any).processo_numero)
        .map(r => (r as any).processo_numero as string);

      if (missingNums.length === 0) return rows;

      const processosMap = await fetchProcessosByNumero(missingNums);
      return rows.map(r => {
        if ((r as any).processo || !(r as any).processo_numero) return r;
        const proc = processosMap.get((r as any).processo_numero);
        return proc ? { ...r, processo: proc } : r;
      });
    },
    enabled: open,
  });

  // Buscar andamentos COM DESCRIÇÃO COMPLETA - aplicando filtro de período
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

  // Calcular dados do relatório - USANDO MESMA LÓGICA DO DASHBOARD
  const reportData = useMemo<CoordenacaoReportData[]>(() => {
    const coordsToInclude = selectAll 
      ? coordenacoes 
      : coordenacoes.filter(c => selectedCoordenacoes.includes(c.id));

    // DJEN - Aplicar filtro de status E período (usando created_at como no Dashboard)
    const publicacoesFiltradas = publicacoes.filter(p => {
      if (statusFilter !== "todas" && p.lida) return false;
      if (!matchesPeriodo(p.created_at)) return false;
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      return true;
    });

    // Redistribuições - já vem filtrado do hook, mas aplicar período também
    const redistribuicoesFiltradas = redistribuicoesData.filter(r => {
      if (!matchesPeriodo(r.data_redistribuicao)) return false;
      if (!matchesSearch((r as any).processo_numero)) return false;
      return true;
    });

    // Audiências - aplicar filtro de período
    const audienciasFiltradas = audienciasPendentes.filter(a => {
      if (!matchesPeriodo((a as any).data_audiencia)) return false;
      if (!matchesSearch((a as any).processo_numero) && !matchesSearch((a as any).processo?.numero) && !matchesSearch((a as any).tipo_audiencia)) return false;
      return true;
    });

    // Intimações - aplicar filtro de período
    const intimacoesFiltradas = intimacoesPendentes.filter(i => {
      if (!matchesPeriodo((i as any).data_intimacao)) return false;
      if (!matchesSearch((i as any).processo_numero) && !matchesSearch((i as any).processo?.numero) && !matchesSearch((i as any).tipo_intimacao)) return false;
      return true;
    });

    // Andamentos - aplicar filtro de período (usando created_at)
    const andamentosFiltrados = andamentosData.filter(a => {
      if (!matchesPeriodo((a as any).created_at)) return false;
      if (!matchesSearch((a as any).descricao) && !matchesSearch((a as any).processo?.numero) && !matchesSearch((a as any).tipo)) return false;
      return true;
    });

    return coordsToInclude.map(coord => {
      // DJEN: via monitoramento (igual Dashboard)
      const monIds = monitoramentosDjen
        .filter(m => m.coordenacao_id === coord.id)
        .map(m => m.id);
      const djenItems = publicacoesFiltradas.filter(p => monIds.includes(p.monitoramento_id));

      // Redistribuições: por nome da coordenação (igual Dashboard)
      const redistItems = redistribuicoesFiltradas.filter(r => r.coordenacao_nome === coord.nome);

      // Andamentos: por coordenacao_id do processo
      const andItems = andamentosFiltrados.filter(a => 
        (a.processo as any)?.coordenacao_id === coord.id
      );

      // Audiências: por coordenacao_id do processo
      const audItems = audienciasFiltradas.filter(a => 
        (a.processo as any)?.coordenacao_id === coord.id
      );

      // Intimações: por coordenacao_id do processo
      const intItems = intimacoesFiltradas.filter(i => 
        (i.processo as any)?.coordenacao_id === coord.id
      );

      // Total: IGUAL AO DASHBOARD - soma tudo
      // Dashboard usa: djen + distribuicoes + alertas360 + redistribuicoes + andamentos + prazos + tarefas + audiencias + intimacoes
      // PDF simplificado: djen + redistribuicoes + andamentos + audiencias + intimacoes
      const totalAlertas = djenItems.length + redistItems.length + andItems.length + audItems.length + intItems.length;

      return {
        id: coord.id,
        nome: coord.nome,
        djen: djenItems.length,
        redistribuicoes: redistItems.length,
        andamentos: andItems.length,
        audiencias: audItems.length,
        intimacoes: intItems.length,
        total: totalAlertas,
        detalhes: {
          djen: djenItems.slice(0, 50),
          redistribuicoes: redistItems.slice(0, 50),
          andamentos: andItems.slice(0, 100),
          audiencias: audItems.slice(0, 50),
          intimacoes: intItems.slice(0, 50),
        },
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [
    coordenacoes, selectedCoordenacoes, selectAll, publicacoes, monitoramentosDjen,
    redistribuicoesData, andamentosData, audienciasPendentes, intimacoesPendentes, 
    statusFilter, matchesPeriodo, matchesSearch
  ]);

  const totalGeral = useMemo(() => {
    return reportData.reduce((acc, c) => ({
      djen: acc.djen + c.djen,
      redistribuicoes: acc.redistribuicoes + c.redistribuicoes,
      andamentos: acc.andamentos + c.andamentos,
      audiencias: acc.audiencias + c.audiencias,
      intimacoes: acc.intimacoes + c.intimacoes,
      total: acc.total + c.total,
    }), {
      djen: 0, redistribuicoes: 0, andamentos: 0, audiencias: 0, intimacoes: 0, total: 0
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

          {/* Totais Gerais - Layout simples */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(5, 1fr)", 
            gap: "8px",
            marginBottom: "24px",
          }}>
            {[
              { label: "DJEN", value: totalGeral.djen },
              { label: "Andamentos", value: totalGeral.andamentos },
              { label: "Audiências", value: totalGeral.audiencias },
              { label: "Redistribuições", value: totalGeral.redistribuicoes },
              { label: "Intimações", value: totalGeral.intimacoes },
            ].map(item => (
              <div key={item.label} style={{
                border: "1px solid #e5e7eb",
                padding: "12px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1a1a2e" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela de Coordenações */}
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
            Visão por Coordenação
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ background: "#1a1a2e", color: "white" }}>
                <th style={{ padding: "8px", textAlign: "left", border: "1px solid #1a1a2e" }}>Coordenação</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>DJEN</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>Andamentos</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>Audiências</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>Redistribuições</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>Intimações</th>
                <th style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e", fontWeight: "bold" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((coord, idx) => (
                <tr key={coord.id} style={{ background: idx % 2 === 0 ? "#f8fafc" : "white" }}>
                  <td style={{ padding: "8px", fontWeight: "500", border: "1px solid #e5e7eb" }}>{coord.nome}</td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #e5e7eb" }}>{coord.djen}</td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #e5e7eb" }}>{coord.andamentos}</td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #e5e7eb" }}>{coord.audiencias}</td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #e5e7eb" }}>{coord.redistribuicoes}</td>
                  <td style={{ padding: "8px", textAlign: "center", border: "1px solid #e5e7eb" }}>{coord.intimacoes}</td>
                  <td style={{ padding: "8px", textAlign: "center", fontWeight: "bold", border: "1px solid #e5e7eb" }}>
                    {coord.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a1a2e", color: "white", fontWeight: "bold" }}>
                <td style={{ padding: "8px", border: "1px solid #1a1a2e" }}>TOTAL GERAL</td>
                <td style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.djen}</td>
                <td style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.andamentos}</td>
                <td style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.audiencias}</td>
                <td style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.redistribuicoes}</td>
                <td style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.intimacoes}</td>
                <td style={{ padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>
                  {totalGeral.total}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Detalhamento por Coordenação */}
        {reportData.map(coord => (
          <div key={coord.id} data-pdf-page={`coord-${coord.id}`} style={{ 
            padding: "24px", 
            fontFamily: "Arial, sans-serif",
            background: "white",
            pageBreakBefore: "always",
          }}>
            <div style={{ 
              borderBottom: "2px solid #1a1a2e", 
              paddingBottom: "8px", 
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1a1a2e", margin: 0 }}>
                {coord.nome}
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Total: {coord.total} alertas
              </span>
            </div>

            {/* ============ DJEN ============ */}
            {coord.detalhes.djen.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Publicações DJEN ({coord.djen})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Conteúdo</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb", width: "80px" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.djen.map((p: any, i: number) => {
                      const processoNumero = p.processo_numero || extractProcessoNumero(p.conteudo) || "Não identificado";
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", fontWeight: "500", whiteSpace: "nowrap" }}>{processoNumero}</td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b", lineHeight: "1.4" }}>
                            {(p.conteudo || "Sem conteúdo").substring(0, 300)}...
                          </td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center", color: "#64748b" }}>
                            {formatDate(p.data_publicacao || p.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {coord.djen > coord.detalhes.djen.length && (
                  <div style={{ fontStyle: "italic", marginTop: "4px", color: "#64748b", fontSize: "9px" }}>
                    ... e mais {coord.djen - coord.detalhes.djen.length} publicações
                  </div>
                )}
              </div>
            )}

            {/* ============ AUDIÊNCIAS ============ */}
            {coord.detalhes.audiencias.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Audiências ({coord.audiencias})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>Tipo</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data/Hora</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Local</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Parte</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Advogado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.audiencias.map((a: any, i: number) => {
                      const hora = a.hora_brasilia || a.hora || "";
                      const local = [a.local_audiencia, a.vara_camara, a.comarca].filter(Boolean).join(" - ") || "-";
                      const parte = a.cliente || a.polo_ativo || "-";
                      const advogadosVinculados = advogadosPorAudiencia[a.id]?.join(", ") || "";
                      const advogadoExibicao = a.advogado || advogadosVinculados || "-";
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", fontWeight: "500", whiteSpace: "nowrap" }}>{a.processo_numero}</td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{a.tipo_audiencia || "-"}</td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center", whiteSpace: "nowrap" }}>
                            {formatDate(a.data_audiencia)} {hora ? `${hora}` : ""}
                          </td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b" }}>{local}</td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b" }}>{parte}</td>
                          <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b" }}>{advogadoExibicao}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ============ INTIMAÇÕES ============ */}
            {coord.detalhes.intimacoes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Intimações ({coord.intimacoes})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>Tipo</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Descrição</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.intimacoes.map((int: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", fontWeight: "500", whiteSpace: "nowrap" }}>{int.processo_numero}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{int.tipo_intimacao || "-"}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b", lineHeight: "1.4" }}>
                          {int.descricao || "-"}
                        </td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{formatDate(int.data_intimacao)}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "500" }}>
                          {int.data_limite ? formatDate(int.data_limite) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ============ REDISTRIBUIÇÕES ============ */}
            {coord.detalhes.redistribuicoes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Redistribuições ({coord.redistribuicoes})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Vara Origem</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb", width: "30px" }}></th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Vara Destino</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Responsável</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.redistribuicoes.map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", fontWeight: "500", whiteSpace: "nowrap" }}>{r.processo_numero}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b" }}>{r.vara_antiga || "-"}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: "bold" }}>→</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b" }}>{r.vara_nova || "-"}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#64748b" }}>{r.advogado_nome || "-"}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center" }}>{formatDate(r.data_redistribuicao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ============ ANDAMENTOS ============ */}
            {coord.detalhes.andamentos.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Andamentos ({coord.andamentos})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb", width: "160px" }}>Processo</th>
                      <th style={{ padding: "6px", textAlign: "left", border: "1px solid #e5e7eb" }}>Descrição</th>
                      <th style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb", width: "80px" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.andamentos.map((a: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", fontWeight: "500" }}>{(a.processo as any)?.numero || "-"}</td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", color: "#374151", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                          {a.descricao || "Sem descrição"}
                        </td>
                        <td style={{ padding: "6px", border: "1px solid #e5e7eb", textAlign: "center", color: "#64748b" }}>
                          {formatDate(a.data_movimentacao)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {coord.andamentos > coord.detalhes.andamentos.length && (
                  <div style={{ fontStyle: "italic", marginTop: "4px", color: "#64748b", fontSize: "9px" }}>
                    ... e mais {coord.andamentos - coord.detalhes.andamentos.length} andamentos
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Rodapé */}
        <div data-pdf-page="footer" style={{
          padding: "24px",
          fontFamily: "Arial, sans-serif",
          background: "#1a1a2e",
          color: "white",
          textAlign: "center",
          minHeight: "60mm",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>
            Juris Control | Paixão Cortes Advogados
          </div>
          <div style={{ fontSize: "11px", opacity: 0.7 }}>
            Relatório gerado automaticamente em {dataAtual}
          </div>
          <div style={{ fontSize: "10px", opacity: 0.5, marginTop: "16px" }}>
            Este documento é confidencial e de uso exclusivo da diretoria.
          </div>
        </div>
      </div>
    </Dialog>
  );
}
