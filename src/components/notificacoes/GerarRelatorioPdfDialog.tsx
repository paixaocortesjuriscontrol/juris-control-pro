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
import { useNotificacoesCountsByCoordenacao, type NotificacoesCounts } from "@/hooks/useNotificacoesCounts";
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
  counts: NotificacoesCounts;
  detalhes: {
    djen: any[];
    redistribuicoes: any[];
    andamentos: any[];
    audiencias: any[];
    intimacoes: any[];
    distribuicoes: any[];
    alertas360: any[];
    prazos: any[];
    tarefas: any[];
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

  // Filtros de tipo de notificação
  const [tiposDjen, setTiposDjen] = useState(true);
  const [tiposDistribuicoes, setTiposDistribuicoes] = useState(true);
  const [tiposAlertas360, setTiposAlertas360] = useState(true);
  const [tiposRedistribuicoes, setTiposRedistribuicoes] = useState(true);
  const [tiposPrazos, setTiposPrazos] = useState(true);
  const [tiposTarefas, setTiposTarefas] = useState(true);
  const [tiposAudiencias, setTiposAudiencias] = useState(true);
  const [tiposIntimacoes, setTiposIntimacoes] = useState(true);
  const [tiposAndamentos, setTiposAndamentos] = useState(true);

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  
  // IDs de todas as coordenações para a query RPC
  const allCoordIds = useMemo(() => coordenacoes.map(c => c.id), [coordenacoes]);
  
  // =============== USAR O MESMO RPC DA CENTRAL DE NOTIFICAÇÕES ===============
  // Isso garante que os totalizadores batam 100% (mesma lógica de dedup/filtros)
  const { data: countsByCoord = {} } = useNotificacoesCountsByCoordenacao({
    coordenacaoIds: allCoordIds,
    periodoInicio,
    periodoFim,
    statusFilter,
    searchQuery,
  });

  // Helper para filtrar por busca
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  // Helper para filtrar por período
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

  // =============== DETALHES (para o PDF) ===============
  // Buscar detalhes apenas para as categorias que serão exibidas
  
  // DJEN
  const { data: djenDetails = [] } = useQuery({
    queryKey: ["pdf-djen-details", periodoInicio, periodoFim, statusFilter, searchQuery],
    enabled: open && tiposDjen,
    queryFn: async () => {
      let query = supabase
        .from('publicacoes_djen')
        .select(`
          id, processo_numero, conteudo, created_at, lida, data_publicacao,
          monitoramento:monitoramentos_djen(id, coordenacao_id)
        `)
        .order('created_at', { ascending: false });
      
      if (periodoInicio) query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) {
        const fimMaisUm = new Date(periodoFim);
        fimMaisUm.setDate(fimMaisUm.getDate() + 1);
        query = query.lt("created_at", format(fimMaisUm, "yyyy-MM-dd"));
      }
      if (statusFilter === "pendente") query = query.eq("lida", false);
      
      const { data } = await query.limit(500);
      return (data || []).filter(p => 
        !searchQuery || matchesSearch(p.conteudo) || matchesSearch(p.processo_numero)
      );
    },
  });

  // Redistribuições
  const { data: redistDetails = [] } = useQuery({
    queryKey: ["pdf-redist-details", periodoInicio, periodoFim, searchQuery],
    enabled: open && tiposRedistribuicoes,
    queryFn: async () => {
      let query = supabase
        .from('movimentacoes')
        .select(`
          id, descricao, data_movimentacao, created_at,
          processo:processos(id, numero, coordenacao_id, vara, coordenacoes(nome), advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(nome))
        `)
        .eq('tipo', 'Redistribuição')
        .order('created_at', { ascending: false });
      
      if (periodoInicio) query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) {
        const fimMaisUm = new Date(periodoFim);
        fimMaisUm.setDate(fimMaisUm.getDate() + 1);
        query = query.lt("created_at", format(fimMaisUm, "yyyy-MM-dd"));
      }
      
      const { data } = await query.limit(500);
      return (data || []).filter(r => 
        !searchQuery || matchesSearch(r.processo?.numero) || matchesSearch(r.descricao)
      );
    },
  });

  // Andamentos
  const { data: andamentosDetails = [] } = useQuery({
    queryKey: ["pdf-andamentos-details", periodoInicio, periodoFim, searchQuery],
    enabled: open && tiposAndamentos,
    queryFn: async () => {
      let query = supabase
        .from('movimentacoes')
        .select(`
          id, descricao, data_movimentacao, created_at, tipo,
          processo:processos(id, numero, coordenacao_id, polo_ativo)
        `)
        .neq('tipo', 'Redistribuição')
        .order('created_at', { ascending: false });
      
      if (periodoInicio) query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) {
        const fimMaisUm = new Date(periodoFim);
        fimMaisUm.setDate(fimMaisUm.getDate() + 1);
        query = query.lt("created_at", format(fimMaisUm, "yyyy-MM-dd"));
      }
      
      const { data } = await query.limit(500);
      return (data || []).filter(a => 
        !searchQuery || matchesSearch(a.processo?.numero) || matchesSearch(a.descricao)
      );
    },
  });

  // Audiências
  const { data: audienciasDetails = [] } = useQuery({
    queryKey: ["pdf-audiencias-details", periodoInicio, periodoFim, statusFilter, searchQuery],
    enabled: open && tiposAudiencias,
    queryFn: async () => {
      let query = supabase
        .from('audiencias_detectadas')
        .select(`
          id, processo_numero, data_audiencia, hora, hora_brasilia, tipo_audiencia, status, 
          local_audiencia, polo_ativo, cliente, vara_camara, comarca, advogado,
          processo:processos!audiencias_detectadas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .order('data_audiencia', { ascending: false });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      if (periodoInicio) query = query.gte("data_audiencia", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) query = query.lte("data_audiencia", format(periodoFim, "yyyy-MM-dd"));
      
      const { data } = await query.limit(300);
      return (data || []).filter(a => 
        !searchQuery || matchesSearch(a.processo_numero) || matchesSearch(a.tipo_audiencia)
      );
    },
  });

  // Intimações
  const { data: intimacoesDetails = [] } = useQuery({
    queryKey: ["pdf-intimacoes-details", periodoInicio, periodoFim, statusFilter, searchQuery],
    enabled: open && tiposIntimacoes,
    queryFn: async () => {
      let query = supabase
        .from('intimacoes_detectadas')
        .select(`
          id, processo_numero, data_intimacao, tipo_intimacao, status, data_limite, descricao,
          processo:processos!intimacoes_detectadas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .order('data_intimacao', { ascending: false });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      if (periodoInicio) query = query.gte("data_intimacao", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) query = query.lte("data_intimacao", format(periodoFim, "yyyy-MM-dd"));
      
      const { data } = await query.limit(300);
      return (data || []).filter(i => 
        !searchQuery || matchesSearch(i.processo_numero) || matchesSearch(i.tipo_intimacao)
      );
    },
  });

  // Distribuições
  const { data: distribuicoesDetails = [] } = useQuery({
    queryKey: ["pdf-distribuicoes-details", periodoInicio, periodoFim, statusFilter, searchQuery],
    enabled: open && tiposDistribuicoes,
    queryFn: async () => {
      let query = supabase
        .from('distribuicoes_encontradas')
        .select(`
          id, numero_processo, data_distribuicao, polo_ativo, polo_passivo, vara, tribunal, status,
          processo:processos(id, numero, coordenacao_id)
        `)
        .order('data_distribuicao', { ascending: false });
      
      if (statusFilter === "pendente") query = query.eq("status", "pendente");
      if (periodoInicio) query = query.gte("data_distribuicao", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) query = query.lte("data_distribuicao", format(periodoFim, "yyyy-MM-dd"));
      
      const { data } = await query.limit(300);
      return (data || []).filter(d => 
        !searchQuery || matchesSearch(d.numero_processo) || matchesSearch(d.polo_ativo)
      );
    },
  });

  // Alertas 360
  const { data: alertas360Details = [] } = useQuery({
    queryKey: ["pdf-alertas360-details", periodoInicio, periodoFim, statusFilter, searchQuery],
    enabled: open && tiposAlertas360,
    queryFn: async () => {
      let query = supabase
        .from('alertas_monitoramento')
        .select(`
          id, termo_encontrado, contexto, prioridade, status, created_at,
          processo:processos(id, numero, coordenacao_id)
        `)
        .order('created_at', { ascending: false });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      if (periodoInicio) query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) {
        const fimMaisUm = new Date(periodoFim);
        fimMaisUm.setDate(fimMaisUm.getDate() + 1);
        query = query.lt("created_at", format(fimMaisUm, "yyyy-MM-dd"));
      }
      
      const { data } = await query.limit(300);
      return (data || []).filter(a => 
        !searchQuery || matchesSearch(a.termo_encontrado) || matchesSearch(a.processo?.numero)
      );
    },
  });

  // Tarefas
  const { data: tarefasDetails = [] } = useQuery({
    queryKey: ["pdf-tarefas-details", periodoInicio, periodoFim, statusFilter, searchQuery],
    enabled: open && tiposTarefas,
    queryFn: async () => {
      let query = supabase
        .from('tarefas')
        .select(`
          id, titulo, data_vencimento, prioridade, status,
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .order('data_vencimento', { ascending: true });
      
      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as any);
      }
      if (periodoInicio) query = query.gte("data_vencimento", format(periodoInicio, "yyyy-MM-dd"));
      if (periodoFim) query = query.lte("data_vencimento", format(periodoFim, "yyyy-MM-dd"));
      
      const { data } = await query.limit(500);
      return (data || []).filter(t => 
        !searchQuery || matchesSearch(t.titulo)
      );
    },
  });

  // Prazos (tarefas pendentes nos próximos 6 dias)
  const { data: prazosDetails = [] } = useQuery({
    queryKey: ["pdf-prazos-details", searchQuery],
    enabled: open && tiposPrazos,
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const daquiCincoDias = new Date(hoje);
      daquiCincoDias.setDate(daquiCincoDias.getDate() + 5);
      
      const { data } = await supabase
        .from('tarefas')
        .select(`
          id, titulo, data_vencimento, data_fatal, data_base, prioridade,
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .eq("status", "pendente")
        .gte("data_vencimento", format(hoje, "yyyy-MM-dd"))
        .lte("data_vencimento", format(daquiCincoDias, "yyyy-MM-dd"))
        .order('data_vencimento', { ascending: true })
        .limit(500);
      
      return (data || []).filter(p => 
        !searchQuery || matchesSearch(p.titulo)
      );
    },
  });

  // =============== REPORT DATA: unir counts do RPC com detalhes ===============
  const reportData = useMemo<CoordenacaoReportData[]>(() => {
    const coordsToInclude = selectAll 
      ? coordenacoes 
      : coordenacoes.filter(c => selectedCoordenacoes.includes(c.id));

    return coordsToInclude.map(coord => {
      const counts = countsByCoord[coord.id] || {
        djen: 0, distribuicoes: 0, alertas360: 0, redistribuicoes: 0,
        andamentos: 0, prazos: 0, tarefas: 0, audiencias: 0, intimacoes: 0, total: 0
      };

      // Filtrar detalhes por coordenação
      const djenItems = djenDetails.filter(p => p.monitoramento?.coordenacao_id === coord.id);
      const redistItems = redistDetails.filter(r => r.processo?.coordenacao_id === coord.id);
      const andItems = andamentosDetails.filter(a => a.processo?.coordenacao_id === coord.id);
      const audItems = audienciasDetails.filter(a => a.processo?.coordenacao_id === coord.id);
      const intItems = intimacoesDetails.filter(i => i.processo?.coordenacao_id === coord.id);
      const distItems = distribuicoesDetails.filter(d => d.processo?.coordenacao_id === coord.id);
      const alertaItems = alertas360Details.filter(a => a.processo?.coordenacao_id === coord.id);
      const tarefaItems = tarefasDetails.filter(t => t.processo?.coordenacao_id === coord.id);
      const prazoItems = prazosDetails.filter(p => p.processo?.coordenacao_id === coord.id);

      return {
        id: coord.id,
        nome: coord.nome,
        counts,
        detalhes: {
          djen: tiposDjen ? djenItems.slice(0, 50) : [],
          redistribuicoes: tiposRedistribuicoes ? redistItems.slice(0, 50) : [],
          andamentos: tiposAndamentos ? andItems.slice(0, 100) : [],
          audiencias: tiposAudiencias ? audItems.slice(0, 50) : [],
          intimacoes: tiposIntimacoes ? intItems.slice(0, 50) : [],
          distribuicoes: tiposDistribuicoes ? distItems.slice(0, 50) : [],
          alertas360: tiposAlertas360 ? alertaItems.slice(0, 50) : [],
          tarefas: tiposTarefas ? tarefaItems.slice(0, 100) : [],
          prazos: tiposPrazos ? prazoItems.slice(0, 100) : [],
        },
      };
    }).filter(c => c.counts.total > 0).sort((a, b) => b.counts.total - a.counts.total);
  }, [
    coordenacoes, selectedCoordenacoes, selectAll, countsByCoord,
    djenDetails, redistDetails, andamentosDetails, audienciasDetails, intimacoesDetails,
    distribuicoesDetails, alertas360Details, tarefasDetails, prazosDetails,
    tiposDjen, tiposRedistribuicoes, tiposAndamentos, tiposAudiencias, tiposIntimacoes,
    tiposDistribuicoes, tiposAlertas360, tiposTarefas, tiposPrazos
  ]);

  // Totais gerais (soma dos counts do RPC)
  const totalGeral = useMemo<NotificacoesCounts>(() => {
    const coordsToInclude = selectAll 
      ? coordenacoes 
      : coordenacoes.filter(c => selectedCoordenacoes.includes(c.id));
    
    const zero: NotificacoesCounts = {
      djen: 0, distribuicoes: 0, alertas360: 0, redistribuicoes: 0,
      andamentos: 0, prazos: 0, tarefas: 0, audiencias: 0, intimacoes: 0, total: 0
    };

    for (const coord of coordsToInclude) {
      const c = countsByCoord[coord.id];
      if (!c) continue;
      
      // Aplicar filtros de tipo
      if (tiposDjen) zero.djen += c.djen;
      if (tiposDistribuicoes) zero.distribuicoes += c.distribuicoes;
      if (tiposAlertas360) zero.alertas360 += c.alertas360;
      if (tiposRedistribuicoes) zero.redistribuicoes += c.redistribuicoes;
      if (tiposAndamentos) zero.andamentos += c.andamentos;
      if (tiposPrazos) zero.prazos += c.prazos;
      if (tiposTarefas) zero.tarefas += c.tarefas;
      if (tiposAudiencias) zero.audiencias += c.audiencias;
      if (tiposIntimacoes) zero.intimacoes += c.intimacoes;
    }

    zero.total = zero.djen + zero.distribuicoes + zero.alertas360 + zero.redistribuicoes +
                 zero.andamentos + zero.prazos + zero.tarefas + zero.audiencias + zero.intimacoes;

    return zero;
  }, [
    coordenacoes, selectedCoordenacoes, selectAll, countsByCoord,
    tiposDjen, tiposDistribuicoes, tiposAlertas360, tiposRedistribuicoes,
    tiposAndamentos, tiposPrazos, tiposTarefas, tiposAudiencias, tiposIntimacoes
  ]);

  // Calcular contagem de alertas por coordenação para exibir no dialog
  const getCoordenacaoAlertCount = useMemo(() => {
    return (coordId: string) => countsByCoord[coordId]?.total || 0;
  }, [countsByCoord]);

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

        let remainingHeight = imgHeight;
        let sourceY = 0;
        const pageContentHeight = pdfHeight - 20;

        while (remainingHeight > 0) {
          if (sourceY > 0) {
            pdf.addPage();
          }

          const sliceHeight = Math.min(remainingHeight, pageContentHeight);
          const sourceHeight = (sliceHeight * canvas.height) / imgHeight;

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

          {/* Seleção de Tipos de Notificação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Tipos de Notificação</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const allSelected = tiposDjen && tiposDistribuicoes && tiposAlertas360 && tiposRedistribuicoes && tiposPrazos && tiposTarefas && tiposAudiencias && tiposIntimacoes && tiposAndamentos;
                  const newValue = !allSelected;
                  setTiposDjen(newValue);
                  setTiposDistribuicoes(newValue);
                  setTiposAlertas360(newValue);
                  setTiposRedistribuicoes(newValue);
                  setTiposPrazos(newValue);
                  setTiposTarefas(newValue);
                  setTiposAudiencias(newValue);
                  setTiposIntimacoes(newValue);
                  setTiposAndamentos(newValue);
                }}
                className={(tiposDjen && tiposDistribuicoes && tiposAlertas360 && tiposRedistribuicoes && tiposPrazos && tiposTarefas && tiposAudiencias && tiposIntimacoes && tiposAndamentos) ? "text-primary" : ""}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {(tiposDjen && tiposDistribuicoes && tiposAlertas360 && tiposRedistribuicoes && tiposPrazos && tiposTarefas && tiposAudiencias && tiposIntimacoes && tiposAndamentos) ? "Todos selecionados" : "Selecionar todos"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
              {[
                { state: tiposDjen, setState: setTiposDjen, label: "DJEN" },
                { state: tiposDistribuicoes, setState: setTiposDistribuicoes, label: "Distribuições" },
                { state: tiposAlertas360, setState: setTiposAlertas360, label: "Alertas 360°" },
                { state: tiposRedistribuicoes, setState: setTiposRedistribuicoes, label: "Redistribuições" },
                { state: tiposPrazos, setState: setTiposPrazos, label: "Prazos" },
                { state: tiposTarefas, setState: setTiposTarefas, label: "Tarefas" },
                { state: tiposAudiencias, setState: setTiposAudiencias, label: "Audiências" },
                { state: tiposIntimacoes, setState: setTiposIntimacoes, label: "Intimações" },
                { state: tiposAndamentos, setState: setTiposAndamentos, label: "Andamentos" },
              ].map(tipo => (
                <div
                  key={tipo.label}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => tipo.setState(!tipo.state)}
                >
                  <Checkbox checked={tipo.state} />
                  <span className="text-sm">{tipo.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview com filtros */}
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{periodoLabel}</Badge>
              <Badge variant="outline">{statusFilter === "todas" ? "Todos status" : statusFilter}</Badge>
            </div>
            <div>
              {reportData.length} coordenações • <strong>{totalGeral.total}</strong> alertas
            </div>
          </div>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Gerando PDF... {Math.round(progress)}%
              </p>
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
        {/* Capa + Sumário Executivo */}
        <div data-pdf-page="cover-summary" style={{ 
          padding: "24px", 
          fontFamily: "Arial, sans-serif",
          background: "white",
          color: "#1a1a2e",
        }}>
          {/* Header com identidade visual */}
          <div style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            color: "white",
            padding: "20px 24px",
            borderRadius: "8px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                background: "linear-gradient(135deg, #d4a015 0%, #eab308 100%)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}>
                ⚖️
              </div>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>
                  RELATÓRIO EXECUTIVO
                </h1>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  Central de Notificações
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Período</div>
              <div style={{ fontSize: "14px", fontWeight: "500" }}>{periodoLabel}</div>
              <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "4px" }}>{dataAtual}</div>
            </div>
          </div>

          {/* Totais Gerais - 9 categorias */}
          <h3 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px", color: "#1a1a2e" }}>
            Resumo Geral
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(5, 1fr)", 
            gap: "6px",
            marginBottom: "12px",
          }}>
            {[
              { label: "DJEN", value: totalGeral.djen, show: tiposDjen },
              { label: "Distribuições", value: totalGeral.distribuicoes, show: tiposDistribuicoes },
              { label: "Alertas 360°", value: totalGeral.alertas360, show: tiposAlertas360 },
              { label: "Redistribuições", value: totalGeral.redistribuicoes, show: tiposRedistribuicoes },
              { label: "Prazos", value: totalGeral.prazos, show: tiposPrazos },
              { label: "Tarefas", value: totalGeral.tarefas, show: tiposTarefas },
              { label: "Audiências", value: totalGeral.audiencias, show: tiposAudiencias },
              { label: "Intimações", value: totalGeral.intimacoes, show: tiposIntimacoes },
              { label: "Andamentos", value: totalGeral.andamentos, show: tiposAndamentos },
            ].filter(item => item.show).map(item => (
              <div key={item.label} style={{
                border: "1px solid #e5e7eb",
                padding: "8px",
                textAlign: "center",
                borderRadius: "6px",
                background: "#f8fafc",
              }}>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1a1a2e" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: "7px", color: "#64748b", textTransform: "uppercase" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela de Coordenações */}
          <h3 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px", color: "#1a1a2e" }}>
            Visão por Coordenação
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
            <thead>
              <tr style={{ background: "#1a1a2e", color: "white" }}>
                <th style={{ padding: "6px", textAlign: "left", border: "1px solid #1a1a2e" }}>Coordenação</th>
                {tiposDjen && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>DJEN</th>}
                {tiposDistribuicoes && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Distrib.</th>}
                {tiposAlertas360 && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>360°</th>}
                {tiposRedistribuicoes && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Redist.</th>}
                {tiposPrazos && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Prazos</th>}
                {tiposTarefas && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Tarefas</th>}
                {tiposAudiencias && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Aud.</th>}
                {tiposIntimacoes && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Intim.</th>}
                {tiposAndamentos && <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>Andamentos</th>}
                <th style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e", fontWeight: "bold" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((coord, idx) => {
                const c = coord.counts;
                const rowTotal = 
                  (tiposDjen ? c.djen : 0) +
                  (tiposDistribuicoes ? c.distribuicoes : 0) +
                  (tiposAlertas360 ? c.alertas360 : 0) +
                  (tiposRedistribuicoes ? c.redistribuicoes : 0) +
                  (tiposPrazos ? c.prazos : 0) +
                  (tiposTarefas ? c.tarefas : 0) +
                  (tiposAudiencias ? c.audiencias : 0) +
                  (tiposIntimacoes ? c.intimacoes : 0) +
                  (tiposAndamentos ? c.andamentos : 0);
                
                return (
                  <tr key={coord.id} style={{ background: idx % 2 === 0 ? "#f8fafc" : "white" }}>
                    <td style={{ padding: "6px", fontWeight: "500", border: "1px solid #e5e7eb" }}>{coord.nome}</td>
                    {tiposDjen && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.djen}</td>}
                    {tiposDistribuicoes && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.distribuicoes}</td>}
                    {tiposAlertas360 && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.alertas360}</td>}
                    {tiposRedistribuicoes && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.redistribuicoes}</td>}
                    {tiposPrazos && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.prazos}</td>}
                    {tiposTarefas && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.tarefas}</td>}
                    {tiposAudiencias && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.audiencias}</td>}
                    {tiposIntimacoes && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.intimacoes}</td>}
                    {tiposAndamentos && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #e5e7eb" }}>{c.andamentos}</td>}
                    <td style={{ padding: "6px", textAlign: "center", fontWeight: "bold", border: "1px solid #e5e7eb" }}>
                      {rowTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a1a2e", color: "white", fontWeight: "bold" }}>
                <td style={{ padding: "6px", border: "1px solid #1a1a2e" }}>TOTAL GERAL</td>
                {tiposDjen && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.djen}</td>}
                {tiposDistribuicoes && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.distribuicoes}</td>}
                {tiposAlertas360 && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.alertas360}</td>}
                {tiposRedistribuicoes && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.redistribuicoes}</td>}
                {tiposPrazos && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.prazos}</td>}
                {tiposTarefas && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.tarefas}</td>}
                {tiposAudiencias && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.audiencias}</td>}
                {tiposIntimacoes && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.intimacoes}</td>}
                {tiposAndamentos && <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>{totalGeral.andamentos}</td>}
                <td style={{ padding: "6px", textAlign: "center", border: "1px solid #1a1a2e" }}>
                  {totalGeral.total}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Rodapé da página */}
          <div style={{ 
            marginTop: "20px", 
            paddingTop: "12px", 
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "9px",
            color: "#64748b",
          }}>
            <span>Juris Control • Paixão Cortes Advogados</span>
            <span>juris-control-pro.lovable.app</span>
          </div>
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
                Total: {coord.counts.total} alertas
              </span>
            </div>

            {/* DJEN */}
            {coord.detalhes.djen.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Publicações DJEN ({coord.counts.djen})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb", width: "20%" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Conteúdo</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb", width: "12%" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.djen.map((pub: any, idx: number) => (
                      <tr key={pub.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb", verticalAlign: "top" }}>
                          {pub.processo_numero || extractProcessoNumero(pub.conteudo) || "-"}
                        </td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>
                          {(pub.conteudo || "").replace(/<[^>]*>/g, " ").slice(0, 200)}...
                        </td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                          {formatDate(pub.data_publicacao || pub.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Audiências */}
            {coord.detalhes.audiencias.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Audiências ({coord.counts.audiencias})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Tipo</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data/Hora</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.audiencias.map((aud: any, idx: number) => (
                      <tr key={aud.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{aud.processo_numero || aud.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{aud.tipo_audiencia || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                          {formatDate(aud.data_audiencia)} {aud.hora || aud.hora_brasilia || ""}
                        </td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{aud.local_audiencia || aud.vara_camara || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Intimações */}
            {coord.detalhes.intimacoes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Intimações ({coord.counts.intimacoes})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Tipo</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.intimacoes.map((int: any, idx: number) => (
                      <tr key={int.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{int.processo_numero || int.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{int.tipo_intimacao || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(int.data_intimacao)}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(int.data_limite)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Redistribuições */}
            {coord.detalhes.redistribuicoes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Redistribuições ({coord.counts.redistribuicoes})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Descrição</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.redistribuicoes.map((red: any, idx: number) => (
                      <tr key={red.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{red.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{red.descricao?.slice(0, 100) || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(red.data_movimentacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Andamentos */}
            {coord.detalhes.andamentos.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Andamentos ({coord.counts.andamentos})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb", width: "20%" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Descrição</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb", width: "12%" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.andamentos.map((and: any, idx: number) => (
                      <tr key={and.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{and.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{and.descricao || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(and.data_movimentacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Distribuições */}
            {coord.detalhes.distribuicoes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Distribuições ({coord.counts.distribuicoes})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Vara/Tribunal</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.distribuicoes.map((dist: any, idx: number) => (
                      <tr key={dist.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{dist.numero_processo || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{dist.vara || dist.tribunal || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(dist.data_distribuicao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Alertas 360° */}
            {coord.detalhes.alertas360.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Alertas 360° ({coord.counts.alertas360})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Termo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Contexto</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.alertas360.map((alerta: any, idx: number) => (
                      <tr key={alerta.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{alerta.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{alerta.termo_encontrado || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{(alerta.contexto || "").slice(0, 80)}...</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(alerta.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tarefas */}
            {coord.detalhes.tarefas.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Tarefas ({coord.counts.tarefas})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Título</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Vencimento</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.tarefas.map((tarefa: any, idx: number) => (
                      <tr key={tarefa.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{tarefa.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{tarefa.titulo?.slice(0, 60) || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{formatDate(tarefa.data_vencimento)}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{tarefa.prioridade || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Prazos */}
            {coord.detalhes.prazos.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#1a1a2e", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                  Prazos Próximos ({coord.counts.prazos})
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Processo</th>
                      <th style={{ padding: "4px", textAlign: "left", border: "1px solid #e5e7eb" }}>Título</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Vencimento</th>
                      <th style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coord.detalhes.prazos.map((prazo: any, idx: number) => (
                      <tr key={prazo.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{prazo.processo?.numero || "-"}</td>
                        <td style={{ padding: "4px", border: "1px solid #e5e7eb" }}>{prazo.titulo?.slice(0, 60) || "-"}</td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                          {formatDate(prazo.data_vencimento || prazo.data_fatal || prazo.data_base)}
                        </td>
                        <td style={{ padding: "4px", textAlign: "center", border: "1px solid #e5e7eb" }}>{prazo.prioridade || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé */}
            <div style={{ 
              marginTop: "auto",
              paddingTop: "12px", 
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "9px",
              color: "#64748b",
            }}>
              <span>{coord.nome}</span>
              <span>{dataAtual}</span>
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
