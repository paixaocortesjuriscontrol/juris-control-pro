import React, { useState, useRef, useEffect } from "react";
import { useImport } from "@/contexts/ImportContext";
import {
  Search,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  User,
  Hash,
  Eye,
  Import,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useCoordenacoes } from "@/hooks/useDashboardData";

type SearchType = "palavra-chave" | "advogado" | "processo" | "monitoramento";

interface Publicacao {
  id: string;
  data: string;
  tipo: string;
  conteudo: string;
  processo?: string;
  tribunal?: string;
  advogado?: string;
  partes?: string;
}

const estados = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

const BuscarDJEN = () => {
  const { startImport, endImport } = useImport();
  const [searchType, setSearchType] = useState<SearchType>("palavra-chave");
  const [palavraChave, setPalavraChave] = useState("");
  const [oab, setOab] = useState("");
  const [uf, setUf] = useState("");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  // Filtros de monitoramento pré-cadastrado
  const [filtroCoordId, setFiltroCoordId] = useState<string>("");
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>("todos");
  
  const [loading, setLoading] = useState(false);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // DJEN API pagination (server-side)
  const DJEN_PAGE_SIZE = 100;
  const [apiPage, setApiPage] = useState(0);
  const [apiTotal, setApiTotal] = useState<number | null>(null);
  const [apiHasMore, setApiHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // "Carregar tudo" state
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState({ loaded: 0, total: 0 });
  const [loadAllLimit, setLoadAllLimit] = useState<number>(500); // Limite máximo de itens
  const loadAllCancelledRef = React.useRef(false);
  
  // AbortController for cancelling imports on unmount
  const isCancelledRef = React.useRef(false);
  
  // Cleanup on unmount - cancel any running imports
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      loadAllCancelledRef.current = true;
    };
  }, []);
  
  const [importing, setImporting] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<Publicacao | null>(null);
  const [importCoordenacaoId, setImportCoordenacaoId] = useState<string>("");
  const [importingOne, setImportingOne] = useState(false);
  const [resumo, setResumo] = useState<string>("");
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [importLoteDialogOpen, setImportLoteDialogOpen] = useState(false);
  const [importLoteCoordenacaoId, setImportLoteCoordenacaoId] = useState<string>("");
  const [importBuscarAndamentos, setImportBuscarAndamentos] = useState(true);
  const [importLoteBuscarAndamentos, setImportLoteBuscarAndamentos] = useState(true);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    imported: 0,
    movimentacoes: 0,
    errors: 0,
  });

  const { monitoramentos } = useMonitoramentosDjen();

  const { data: coordenacoes } = useCoordenacoes();

  // Filtrar monitoramentos por coordenação selecionada
  const monitoramentosFiltrados = filtroCoordId 
    ? monitoramentos?.filter(m => m.coordenacao_id === filtroCoordId)
    : monitoramentos;

  const handleViewContent = (pub: Publicacao) => {
    setSelectedPublicacao(pub);
    setViewDialogOpen(true);
  };

  const handleOpenImportDialog = (pub: Publicacao) => {
    setSelectedPublicacao(pub);
    setImportCoordenacaoId("");
    setImportBuscarAndamentos(true);
    setImportDialogOpen(true);
  };

  // Extract CNJ process numbers from text
  const extractProcessNumbers = (text: string): string[] => {
    // CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
    const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
    const matches = text.match(cnjRegex) || [];
    // Remove duplicates
    return [...new Set(matches)];
  };

  const handleImportOne = async () => {
    if (!selectedPublicacao) return;
    if (!importCoordenacaoId) {
      toast.error("Selecione uma coordenação");
      return;
    }

    setImportingOne(true);
    startImport("Importando DJEN");
    
    try {
      const pub = selectedPublicacao;
      
      // Extract all process numbers from the content
      const processNumbers = extractProcessNumbers(pub.conteudo);
      
      // If there's also a main process number in the publication, add it
      if (pub.processo && !processNumbers.includes(pub.processo)) {
        processNumbers.unshift(pub.processo);
      }

      if (processNumbers.length === 0) {
        toast.error("Nenhum número de processo encontrado na publicação");
        setImportingOne(false);
        return;
      }

      toast.info(`Encontrado(s) ${processNumbers.length} processo(s). Importando...`);

      let imported = 0;
      let errors = 0;

      for (const numero of processNumbers) {
        try {
          // Check if process already exists
          const { data: existingProcess } = await supabase
            .from("processos")
            .select("id")
            .eq("numero", numero)
            .maybeSingle();

          if (existingProcess) {
            // Add publication as movement
            await supabase
              .from("movimentacoes")
              .insert({
                processo_id: existingProcess.id,
                descricao: `Publicação DJEN: ${pub.conteudo.substring(0, 400)}`,
                tipo: "publicacao_djen",
                fonte: "DJEN",
                data_movimentacao: pub.data || new Date().toISOString(),
              });
            
            // Update coordination
            await supabase
              .from("processos")
              .update({ coordenacao_id: importCoordenacaoId })
              .eq("id", existingProcess.id);

            imported++;
          } else {
            // Fetch process data from external API
            let processData: any = null;
            try {
              const { data: apiData } = await supabase.functions.invoke('consultar-processo', {
                body: { numeroProcesso: numero }
              });
              if (apiData?.success && apiData?.processo) {
                processData = apiData.processo;
              }
            } catch (apiError) {
              console.log(`API error for ${numero}:`, apiError);
            }

            // Create new process
            const { data: newProcess, error: insertError } = await supabase
              .from("processos")
              .insert({
                numero,
                area: processData?.area || "civil",
                status: "ativo",
                tribunal: processData?.tribunal || pub.tribunal || "Não identificado",
                vara: processData?.vara,
                comarca: processData?.comarca,
                classe: processData?.classe,
                assunto: processData?.assunto || pub.conteudo.substring(0, 200),
                polo_ativo: processData?.polo_ativo || pub.partes || "A identificar",
                polo_passivo: processData?.polo_passivo,
                data_distribuicao: processData?.data_distribuicao,
                coordenacao_id: importCoordenacaoId,
                monitorar_andamentos: importBuscarAndamentos,
              })
              .select("id")
              .single();

            if (insertError) throw insertError;

            // Add publication as first movement
            await supabase
              .from("movimentacoes")
              .insert({
                processo_id: newProcess.id,
                descricao: `Publicação DJEN: ${pub.conteudo.substring(0, 400)}`,
                tipo: "publicacao_djen",
                fonte: "DJEN",
                data_movimentacao: pub.data || new Date().toISOString(),
              });

            // Import movements from API if available and user chose to fetch andamentos
            if (importBuscarAndamentos && processData?.movimentacoes?.length > 0) {
              const movimentacoes = processData.movimentacoes.map((mov: any) => ({
                processo_id: newProcess.id,
                descricao: mov.descricao || mov.nome || "Movimentação",
                tipo: mov.tipo || "andamento",
                fonte: "DataJud/CNJ",
                data_movimentacao: mov.data || new Date().toISOString(),
              }));

              await supabase
                .from("movimentacoes")
                .insert(movimentacoes);
            }

            imported++;
          }
        } catch (procError: any) {
          console.error(`Error importing ${numero}:`, procError);
          errors++;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} processo(s) importado(s) com sucesso`);
      }
      if (errors > 0) {
        toast.warning(`${errors} processo(s) não puderam ser importados`);
      }

      setImportDialogOpen(false);
      setSelectedPublicacao(null);
    } catch (error: any) {
      toast.error("Erro ao importar: " + error.message);
    } finally {
      setImportingOne(false);
      endImport();
    }
  };

  const resetResultados = () => {
    setPublicacoes([]);
    setSelectedIds(new Set());
    setCurrentPage(1);

    // DJEN server-side pagination
    setApiPage(0);
    setApiTotal(null);
    setApiHasMore(false);

    // "Carregar tudo"
    setLoadAllProgress({ loaded: 0, total: 0 });
    loadAllCancelledRef.current = false;
  };

  const handleSearch = async () => {
    // Busca por monitoramento pré-cadastrado
    if (searchType === "monitoramento") {
      if (!filtroCoordId) {
        toast.error("Selecione uma coordenação");
        return;
      }

      resetResultados();

      setLoading(true);
      setHasSearched(true);

      try {
        // Determina quais monitoramentos usar
        const monsParaBuscar = filtroMonitoramentoId === "todos" 
          ? monitoramentosFiltrados?.filter(m => m.ativo) 
          : monitoramentosFiltrados?.filter(m => m.id === filtroMonitoramentoId && m.ativo);
        
        if (!monsParaBuscar || monsParaBuscar.length === 0) {
          toast.info("Nenhum monitoramento ativo encontrado");
          setLoading(false);
          return;
        }
        
        const allPubs: Publicacao[] = [];
        let anyFullPage = false;
        
        for (const mon of monsParaBuscar) {
          const { data, error } = await supabase.functions.invoke('buscar-djen', {
            body: {
              tipo: mon.tipo === 'advogado' ? 'advogado' : 'palavra-chave',
              palavraChave: mon.tipo !== 'advogado' ? mon.termo_busca : undefined,
              oab: mon.tipo === 'advogado' ? mon.oab : undefined,
              uf: mon.tipo === 'advogado' ? mon.uf : undefined,
              dataInicio: dataInicio || undefined,
              dataFim: dataFim || undefined,
              page: 0,
              pageSize: 100,
            }
          });
          
          if (!error && data?.success) {
            const rawPubs = data.publicacoes || data.comunicacoes || data.items || [];
            if (rawPubs.length === DJEN_PAGE_SIZE) anyFullPage = true;

            rawPubs.forEach((p: any, idx: number) => {
              allPubs.push({
                id: `${mon.id}-${p.id ?? `p0-${idx}`}`,
                data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
                tipo: p.tipo || p.tipoComunicacao || "Publicação",
                conteudo: p.conteudo || p.texto || p.teor || "",
                processo: p.processo || p.numeroProcesso,
                tribunal: p.tribunal || p.orgao,
                advogado: p.advogado,
                partes: p.partes || p.destinatario,
              });
            });
          }
        }
        
        setPublicacoes(allPubs);
        setApiPage(0);
        setApiTotal(null);
        setApiHasMore(anyFullPage);
        
        if (allPubs.length === 0) {
          toast.info("Nenhuma publicação encontrada para os monitoramentos selecionados");
        } else {
          toast.success(`${allPubs.length} publicação(ões) encontrada(s)`);
        }
      } catch (error: any) {
        console.error("Search error:", error);
        toast.error(error.message || "Erro ao buscar publicações");
        setPublicacoes([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Frontend validation para buscas manuais
    if (searchType === "palavra-chave" && (!palavraChave || palavraChave.trim().length < 3)) {
      toast.error("Digite uma palavra-chave com pelo menos 3 caracteres");
      return;
    }
    if (searchType === "advogado" && (!oab || oab.trim().length < 3)) {
      toast.error("Digite um número OAB válido");
      return;
    }
    if (searchType === "processo" && (!numeroProcesso || numeroProcesso.trim().length < 10)) {
      toast.error("Digite um número de processo válido");
      return;
    }

    resetResultados();

    setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('buscar-djen', {
        body: {
          tipo: searchType,
          palavraChave: searchType === "palavra-chave" ? palavraChave.trim() : undefined,
          oab: searchType === "advogado" ? oab.trim() : undefined,
          uf: searchType === "advogado" ? uf : undefined,
          numeroProcesso: searchType === "processo" ? numeroProcesso.trim() : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
          page: 0,
          pageSize: DJEN_PAGE_SIZE,
        }
      });

      if (error) throw error;

      if (data.success) {
        // Handle different response formats from the API
        const rawPubs = data.publicacoes || data.comunicacoes || data.items || [];
        const pubs = rawPubs.map((p: any, idx: number) => ({
          id: p.id ? String(p.id) : `pub-0-${idx}`,
          data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
          tipo: p.tipo || p.tipoComunicacao || "Publicação",
          conteudo: p.conteudo || p.texto || p.teor || "",
          processo: p.processo || p.numeroProcesso,
          tribunal: p.tribunal || p.orgao || p.nomeOrgao,
          advogado: p.advogado,
          partes: p.partes || p.destinatario || p.destinatarioNome,
        }));

        setPublicacoes(pubs);

        const total =
          typeof data.totalElements === "number"
            ? data.totalElements
            : typeof data.count === "number"
              ? data.count
              : null;
        setApiTotal(total);

        const serverHasMore = typeof data.hasMore === "boolean" ? data.hasMore : null;
        setApiHasMore(
          serverHasMore !== null ? serverHasMore : total !== null ? pubs.length < total : rawPubs.length === DJEN_PAGE_SIZE
        );

        if (pubs.length === 0) {
          toast.info(data.message || "Nenhuma publicação encontrada para os critérios informados");
        } else {
          toast.success(`${pubs.length} publicação(ões) encontrada(s)`);
        }
      } else {
        throw new Error(data.error || "Erro na busca");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.message || "Erro ao buscar publicações");
      setPublicacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    const uiHasMore = apiHasMore || publicacoes.length >= DJEN_PAGE_SIZE;
    if (!uiHasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = apiPage + 1;

      // Paginação no modo Monitoramento (busca a próxima página para os monitoramentos selecionados)
      if (searchType === "monitoramento") {
        if (!filtroCoordId) {
          toast.error("Selecione uma coordenação");
          return;
        }

        const monsParaBuscar =
          filtroMonitoramentoId === "todos"
            ? monitoramentosFiltrados?.filter((m) => m.ativo)
            : monitoramentosFiltrados?.filter((m) => m.id === filtroMonitoramentoId && m.ativo);

        if (!monsParaBuscar || monsParaBuscar.length === 0) {
          toast.info("Nenhum monitoramento ativo encontrado");
          setApiHasMore(false);
          return;
        }

        if (monsParaBuscar.length > 1) {
          toast.warning("Buscando em múltiplos monitoramentos pode consumir mais créditos");
        }

        const existingIds = new Set(publicacoes.map((p) => p.id));
        const newPubs: Publicacao[] = [];
        let anyFullPage = false;

        for (const mon of monsParaBuscar) {
          const { data, error } = await supabase.functions.invoke("buscar-djen", {
            body: {
              tipo: mon.tipo === "advogado" ? "advogado" : "palavra-chave",
              palavraChave: mon.tipo !== "advogado" ? mon.termo_busca : undefined,
              oab: mon.tipo === "advogado" ? mon.oab : undefined,
              uf: mon.tipo === "advogado" ? mon.uf : undefined,
              dataInicio: dataInicio || undefined,
              dataFim: dataFim || undefined,
              page: nextPage,
              pageSize: DJEN_PAGE_SIZE,
            },
          });

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Erro ao carregar mais resultados");

          const raw = data.publicacoes || data.comunicacoes || data.items || [];
          if (raw.length === DJEN_PAGE_SIZE) anyFullPage = true;

          raw.forEach((p: any, idx: number) => {
            const id = `${mon.id}-${p.id ?? `p${nextPage}-${idx}`}`;
            if (existingIds.has(id)) return;
            existingIds.add(id);

            newPubs.push({
              id,
              data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
              tipo: p.tipo || p.tipoComunicacao || "Publicação",
              conteudo: p.conteudo || p.texto || p.teor || "",
              processo: p.processo || p.numeroProcesso,
              tribunal: p.tribunal || p.orgao || p.nomeOrgao,
              advogado: p.advogado,
              partes: p.partes || p.destinatario || p.destinatarioNome,
            });
          });
        }

        if (newPubs.length === 0) {
          setApiHasMore(false);
          toast.info("Nenhum novo resultado nesta página");
          return;
        }

        setPublicacoes((prev) => [...prev, ...newPubs]);
        setApiPage(nextPage);
        setApiTotal(null);
        setApiHasMore(anyFullPage);

        toast.success(`${newPubs.length} resultado(s) adicionados`);
        return;
      }

      // Paginação padrão (busca manual)
      const { data, error } = await supabase.functions.invoke('buscar-djen', {
        body: {
          tipo: searchType,
          palavraChave: searchType === "palavra-chave" ? palavraChave.trim() : undefined,
          oab: searchType === "advogado" ? oab.trim() : undefined,
          uf: searchType === "advogado" ? uf : undefined,
          numeroProcesso: searchType === "processo" ? numeroProcesso.trim() : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
          page: nextPage,
          pageSize: DJEN_PAGE_SIZE,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao carregar mais resultados");

      const rawPubs = data.publicacoes || data.comunicacoes || data.items || [];
      const newPubs = rawPubs.map((p: any, idx: number) => ({
        id: p.id ? String(p.id) : `pub-${nextPage}-${idx}`,
        data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
        tipo: p.tipo || p.tipoComunicacao || "Publicação",
        conteudo: p.conteudo || p.texto || p.teor || "",
        processo: p.processo || p.numeroProcesso,
        tribunal: p.tribunal || p.orgao || p.nomeOrgao,
        advogado: p.advogado,
        partes: p.partes || p.destinatario || p.destinatarioNome,
      }));

      const currentLoaded = publicacoes.length;

      setPublicacoes((prev) => [...prev, ...newPubs]);
      setApiPage(nextPage);

      const total =
        typeof data.totalElements === "number"
          ? data.totalElements
          : typeof data.count === "number"
            ? data.count
            : null;

      if (typeof total === "number") setApiTotal(total);

      const serverHasMore = typeof data.hasMore === "boolean" ? data.hasMore : null;
      if (serverHasMore !== null) {
        setApiHasMore(serverHasMore);
      } else {
        const totalToUse = typeof total === "number" ? total : apiTotal;
        const loadedAfter = currentLoaded + newPubs.length;
        setApiHasMore(totalToUse !== null ? loadedAfter < totalToUse : rawPubs.length === DJEN_PAGE_SIZE);
      }

      toast.success(`${newPubs.length} resultado(s) adicionados`);
    } catch (e: any) {
      console.error("Load more error:", e);
      toast.error(e.message || "Erro ao carregar mais resultados");
    } finally {
      setLoadingMore(false);
    }
  };

  // Carrega todas as páginas automaticamente uma a uma
  const handleLoadAll = async () => {
    if (loadingAll) return;

    loadAllCancelledRef.current = false;
    setLoadingAll(true);

    // Se não houver total conhecido (muito comum), usamos o limite como "total" para o progresso
    const initialTargetTotal = Math.min(loadAllLimit, apiTotal ?? loadAllLimit);
    setLoadAllProgress({ loaded: publicacoes.length, total: initialTargetTotal });

    let currentPageNum = apiPage;
    let allPubs = [...publicacoes];
    let hasMore = apiHasMore || allPubs.length >= DJEN_PAGE_SIZE;
    let totalKnown = apiTotal;

    try {
      while (hasMore && !loadAllCancelledRef.current && allPubs.length < loadAllLimit) {
        currentPageNum += 1;

        // Modo Monitoramento: paginação por monitoramentos selecionados
        if (searchType === "monitoramento") {
          if (!filtroCoordId) {
            toast.error("Selecione uma coordenação");
            break;
          }

          const monsParaBuscar =
            filtroMonitoramentoId === "todos"
              ? monitoramentosFiltrados?.filter((m) => m.ativo)
              : monitoramentosFiltrados?.filter((m) => m.id === filtroMonitoramentoId && m.ativo);

          if (!monsParaBuscar || monsParaBuscar.length === 0) {
            toast.info("Nenhum monitoramento ativo encontrado");
            break;
          }

          const existingIds = new Set(allPubs.map((p) => p.id));
          const newPubs: Publicacao[] = [];
          let anyFullPage = false;

          for (const mon of monsParaBuscar) {
            const { data, error } = await supabase.functions.invoke("buscar-djen", {
              body: {
                tipo: mon.tipo === "advogado" ? "advogado" : "palavra-chave",
                palavraChave: mon.tipo !== "advogado" ? mon.termo_busca : undefined,
                oab: mon.tipo === "advogado" ? mon.oab : undefined,
                uf: mon.tipo === "advogado" ? mon.uf : undefined,
                dataInicio: dataInicio || undefined,
                dataFim: dataFim || undefined,
                page: currentPageNum,
                pageSize: DJEN_PAGE_SIZE,
              },
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Erro ao carregar resultados");

            const raw = data.publicacoes || data.comunicacoes || data.items || [];
            if (raw.length === DJEN_PAGE_SIZE) anyFullPage = true;

            raw.forEach((p: any, idx: number) => {
              const id = `${mon.id}-${p.id ?? `p${currentPageNum}-${idx}`}`;
              if (existingIds.has(id)) return;
              existingIds.add(id);

              newPubs.push({
                id,
                data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
                tipo: p.tipo || p.tipoComunicacao || "Publicação",
                conteudo: p.conteudo || p.texto || p.teor || "",
                processo: p.processo || p.numeroProcesso,
                tribunal: p.tribunal || p.orgao || p.nomeOrgao,
                advogado: p.advogado,
                partes: p.partes || p.destinatario || p.destinatarioNome,
              });
            });
          }

          allPubs = [...allPubs, ...newPubs];
          totalKnown = null;
          hasMore = anyFullPage && newPubs.length > 0;

          // Update state progressively
          setPublicacoes(allPubs);
          setApiPage(currentPageNum);
          setApiTotal(null);
          setApiHasMore(hasMore);
          setLoadAllProgress({ loaded: allPubs.length, total: loadAllLimit });

          if (hasMore && !loadAllCancelledRef.current) {
            await new Promise((r) => setTimeout(r, 350));
          }

          continue;
        }

        // Modo padrão (busca manual)
        const { data, error } = await supabase.functions.invoke("buscar-djen", {
          body: {
            tipo: searchType,
            palavraChave: searchType === "palavra-chave" ? palavraChave.trim() : undefined,
            oab: searchType === "advogado" ? oab.trim() : undefined,
            uf: searchType === "advogado" ? uf : undefined,
            numeroProcesso: searchType === "processo" ? numeroProcesso.trim() : undefined,
            dataInicio: dataInicio || undefined,
            dataFim: dataFim || undefined,
            page: currentPageNum,
            pageSize: DJEN_PAGE_SIZE,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Erro ao carregar resultados");

        const rawPubs = data.publicacoes || data.comunicacoes || data.items || [];
        const newPubs: Publicacao[] = rawPubs.map((p: any, idx: number) => ({
          id: p.id ? String(p.id) : `pub-${currentPageNum}-${idx}`,
          data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
          tipo: p.tipo || p.tipoComunicacao || "Publicação",
          conteudo: p.conteudo || p.texto || p.teor || "",
          processo: p.processo || p.numeroProcesso,
          tribunal: p.tribunal || p.orgao || p.nomeOrgao,
          advogado: p.advogado,
          partes: p.partes || p.destinatario || p.destinatarioNome,
        }));

        allPubs = [...allPubs, ...newPubs];

        const total =
          typeof data.totalElements === "number"
            ? data.totalElements
            : typeof data.count === "number"
              ? data.count
              : null;

        if (typeof total === "number") totalKnown = total;

        const serverHasMore = typeof data.hasMore === "boolean" ? data.hasMore : null;
        if (serverHasMore !== null) {
          hasMore = serverHasMore;
        } else {
          hasMore = totalKnown !== null ? allPubs.length < totalKnown : rawPubs.length === DJEN_PAGE_SIZE;
        }

        // Update state progressively
        setPublicacoes(allPubs);
        setApiPage(currentPageNum);
        setApiTotal(totalKnown);
        setApiHasMore(hasMore);
        const targetTotal = Math.min(loadAllLimit, totalKnown ?? loadAllLimit);
        setLoadAllProgress({ loaded: allPubs.length, total: targetTotal });

        if (hasMore && !loadAllCancelledRef.current) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      if (loadAllCancelledRef.current) {
        toast.info("Carregamento cancelado");
      } else if (allPubs.length >= loadAllLimit) {
        toast.success(`Limite atingido: ${allPubs.length} resultados carregados`);
      } else {
        toast.success(`Carregamento completo: ${allPubs.length} resultados`);
      }
    } catch (e: any) {
      console.error("Load all error:", e);
      toast.error(e.message || "Erro ao carregar todos os resultados");
    } finally {
      setLoadingAll(false);
      loadAllCancelledRef.current = false;
    }
  };

  const handleCancelLoadAll = () => {
    loadAllCancelledRef.current = true;
    setLoadingAll(false);
    toast.info("Carregamento cancelado");
  };

  const handleResumir = async () => {
    if (publicacoes.length === 0) {
      toast.error("Não há publicações para resumir");
      return;
    }

    setLoadingResumo(true);
    setResumo("");

    try {
      const { data, error } = await supabase.functions.invoke('resumir-publicacoes', {
        body: { publicacoes }
      });

      if (error) throw error;

      if (data.resumo) {
        setResumo(data.resumo);
        toast.success("Resumo gerado com sucesso!");
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Erro ao resumir:", error);
      toast.error(error.message || "Erro ao gerar resumo com IA");
    } finally {
      setLoadingResumo(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Pagination calculations
  const totalPages = Math.ceil(publicacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPublicacoes = publicacoes.slice(startIndex, endIndex);
  // Reset to page 1 when results change
  // (handled inline on the search button)

  const toggleSelectAll = () => {
    if (selectedIds.size === publicacoes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(publicacoes.map(p => p.id)));
    }
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedPublicacoes.map(p => p.id);
    const allPageSelected = pageIds.every(id => selectedIds.has(id));
    
    const newSelected = new Set(selectedIds);
    if (allPageSelected) {
      pageIds.forEach(id => newSelected.delete(id));
    } else {
      pageIds.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  const handleOpenImportLoteDialog = () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação para importar");
      return;
    }
    setImportLoteCoordenacaoId("");
    setImportLoteBuscarAndamentos(true);
    setImportLoteDialogOpen(true);
  };

  const handleImportSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação para importar");
      return;
    }

    if (!importLoteCoordenacaoId) {
      toast.error("Selecione uma coordenação para importar");
      return;
    }

    setImporting(true);
    startImport("Importando DJEN em lote");
    const selectedPubs = publicacoes.filter(p => selectedIds.has(p.id));
    
    // Reset progress
    setImportProgress({
      current: 0,
      total: selectedPubs.length,
      imported: 0,
      movimentacoes: 0,
      errors: 0,
    });
    
    try {
      let imported = 0;
      let errors = 0;
      let movimentacoesAdded = 0;

      for (let i = 0; i < selectedPubs.length; i++) {
        const pub = selectedPubs[i];
        
        // Update progress
        setImportProgress(prev => ({
          ...prev,
          current: i + 1,
        }));

        try {
          // Try to get process number from pub.processo or extract from content
          let processNumbers: string[] = [];
          
          if (pub.processo) {
            processNumbers = [pub.processo];
          } else {
            // Extract process numbers from content
            processNumbers = extractProcessNumbers(pub.conteudo);
          }

          if (processNumbers.length === 0) {
            console.log("Nenhum número de processo encontrado na publicação:", pub.id);
            errors++;
            setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
            continue;
          }

          for (const numero of processNumbers) {
            // Check if process already exists
            const { data: existingProcess } = await supabase
              .from("processos")
              .select("id")
              .eq("numero", numero)
              .maybeSingle();

            if (existingProcess) {
              // Add as movimentacao (intimação)
              const { error } = await supabase
                .from("movimentacoes")
                .insert({
                  processo_id: existingProcess.id,
                  descricao: `Intimação DJEN: ${pub.conteudo.substring(0, 500)}`,
                  tipo: "intimacao",
                  fonte: "DJEN",
                  data_movimentacao: pub.data || new Date().toISOString(),
                });

              if (!error) {
                movimentacoesAdded++;
                setImportProgress(prev => ({ ...prev, movimentacoes: prev.movimentacoes + 1 }));
              } else {
                console.error("Erro ao adicionar movimentação:", error);
              }
            } else {
              // Create new process with coordination
              const { data: newProcess, error: createError } = await supabase
                .from("processos")
                .insert({
                  numero: numero,
                  area: "civil",
                  status: "ativo",
                  tribunal: pub.tribunal || "Não identificado",
                  assunto: pub.conteudo.substring(0, 200),
                  polo_ativo: pub.partes || "A identificar",
                  coordenacao_id: importLoteCoordenacaoId,
                  monitorar_andamentos: importLoteBuscarAndamentos,
                })
                .select("id")
                .single();

              if (!createError && newProcess) {
                // Add the publication as first movement (intimação)
                await supabase
                  .from("movimentacoes")
                  .insert({
                    processo_id: newProcess.id,
                    descricao: `Intimação DJEN: ${pub.conteudo.substring(0, 500)}`,
                    tipo: "intimacao",
                    fonte: "DJEN",
                    data_movimentacao: pub.data || new Date().toISOString(),
                  });
                
                imported++;
                setImportProgress(prev => ({ ...prev, imported: prev.imported + 1 }));
              } else {
                console.error("Erro ao criar processo:", createError);
                errors++;
                setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
              }
            }
          }
        } catch (pubError: any) {
          console.error("Erro ao processar publicação:", pubError);
          errors++;
          setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      }

      if (imported > 0 || movimentacoesAdded > 0) {
        const msgs = [];
        if (imported > 0) msgs.push(`${imported} processo(s) criado(s)`);
        if (movimentacoesAdded > 0) msgs.push(`${movimentacoesAdded} intimação(ões) adicionada(s)`);
        toast.success(msgs.join(", "));
        setSelectedIds(new Set());
      }
      if (errors > 0) {
        toast.warning(`${errors} publicação(ões) não puderam ser importadas (sem número de processo)`);
      }
      
      setImportLoteDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao importar publicações: " + error.message);
    } finally {
      setImporting(false);
      endImport();
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const truncateText = (text: string, maxLength = 150) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <MainLayout
      title="Buscar no DJEN"
      subtitle="Diário de Justiça Eletrônico Nacional"
    >
      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Pesquisar Publicações
          </CardTitle>
          <CardDescription>
            Busque publicações no Diário de Justiça Eletrônico Nacional por palavra-chave, OAB ou número do processo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as SearchType)}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="monitoramento" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Monitoramento</span>
                <span className="xs:hidden">Monitor.</span>
              </TabsTrigger>
              <TabsTrigger value="palavra-chave" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Palavra-chave</span>
                <span className="xs:hidden">Palavra</span>
              </TabsTrigger>
              <TabsTrigger value="advogado" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">OAB/Advogado</span>
                <span className="xs:hidden">OAB</span>
              </TabsTrigger>
              <TabsTrigger value="processo" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Hash className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Nº Processo</span>
                <span className="xs:hidden">Processo</span>
              </TabsTrigger>
            </TabsList>

            <div className="grid gap-4">
              <TabsContent value="monitoramento" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="filtroCoord">Coordenação</Label>
                    <Select value={filtroCoordId} onValueChange={(v) => {
                      setFiltroCoordId(v);
                      setFiltroMonitoramentoId("todos");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a coordenação" />
                      </SelectTrigger>
                      <SelectContent>
                        {coordenacoes?.map((coord) => (
                          <SelectItem key={coord.id} value={coord.id}>
                            {coord.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtroMonitoramento">Monitoramento</Label>
                    <Select 
                      value={filtroMonitoramentoId} 
                      onValueChange={setFiltroMonitoramentoId}
                      disabled={!filtroCoordId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o monitoramento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os monitoramentos</SelectItem>
                        {monitoramentosFiltrados?.map((mon) => (
                          <SelectItem key={mon.id} value={mon.id}>
                            {mon.descricao || mon.termo_busca}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {filtroCoordId && monitoramentosFiltrados && monitoramentosFiltrados.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Nenhum monitoramento cadastrado para esta coordenação
                  </p>
                )}
              </TabsContent>

              <TabsContent value="palavra-chave" className="mt-0">
                <div className="space-y-2">
                  <Label htmlFor="palavraChave">Palavra-chave</Label>
                  <Input
                    id="palavraChave"
                    placeholder="Digite termos para buscar (ex: nome da parte, empresa, etc.)"
                    value={palavraChave}
                    onChange={(e) => setPalavraChave(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </TabsContent>

              <TabsContent value="advogado" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="oab">Número OAB</Label>
                    <Input
                      id="oab"
                      placeholder="Ex: 123456"
                      value={oab}
                      onChange={(e) => setOab(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">Estado (UF)</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estados.map((estado) => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="processo" className="mt-0">
                <div className="space-y-2">
                  <Label htmlFor="numeroProcesso">Número do Processo</Label>
                  <Input
                    id="numeroProcesso"
                    placeholder="Ex: 0000123-45.2024.5.10.0001"
                    value={numeroProcesso}
                    onChange={(e) => setNumeroProcesso(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </TabsContent>

              {/* Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => { setCurrentPage(1); handleSearch(); }} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">
              {hasSearched 
                ? apiTotal !== null
                  ? `Resultados (${publicacoes.length} de ${apiTotal})`
                  : `Resultados (${publicacoes.length})` 
                : "Resultados da Busca"
              }
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleResumir} 
                disabled={loadingResumo || publicacoes.length === 0} 
                size="sm" 
                variant="outline"
                className="w-full sm:w-auto"
              >
                {loadingResumo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando resumo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Resumir com IA
                  </>
                )}
              </Button>

              {/* Carregar tudo - aparece quando há mais de 100 resultados */}
              {(apiHasMore || (searchType !== "monitoramento" && publicacoes.length >= DJEN_PAGE_SIZE)) && !loadingAll && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select
                    value={String(loadAllLimit)}
                    onValueChange={(v) => setLoadAllLimit(Number(v))}
                  >
                    <SelectTrigger className="w-[100px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="200">Até 200</SelectItem>
                      <SelectItem value="500">Até 500</SelectItem>
                      <SelectItem value="1000">Até 1000</SelectItem>
                      <SelectItem value="2000">Até 2000</SelectItem>
                      <SelectItem value="99999">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleLoadAll}
                    disabled={loadingMore || loading || loadingAll}
                    size="sm"
                    variant="default"
                  >
                    <ChevronsRight className="w-4 h-4 mr-2" />
                    Carregar {apiTotal ? `(${Math.min(loadAllLimit, apiTotal)})` : ""}
                  </Button>
                </div>
              )}

              {/* Progress bar durante o carregamento */}
              {loadingAll && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex-1 min-w-[120px]">
                    <Progress 
                      value={loadAllProgress.total > 0 ? (loadAllProgress.loaded / loadAllProgress.total) * 100 : 0} 
                      className="h-2"
                    />
                    <span className="text-xs text-muted-foreground mt-1 block text-center">
                      {loadAllProgress.loaded} / {loadAllProgress.total}
                    </span>
                  </div>
                  <Button
                    onClick={handleCancelLoadAll}
                    size="sm"
                    variant="destructive"
                  >
                    Cancelar
                  </Button>
                </div>
              )}

              {selectedIds.size > 0 && (
                <Button onClick={handleOpenImportLoteDialog} disabled={importing} size="sm" className="w-full sm:w-auto">
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Importar ({selectedIds.size})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasSearched ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Faça uma busca para ver os resultados</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Buscando publicações...</p>
            </div>
          ) : publicacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma publicação encontrada</p>
              <p className="text-sm mt-2">Tente ajustar os filtros de busca</p>
            </div>
          ) : (
            <>
              {/* Pagination Controls - Top */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrando {startIndex + 1}-{Math.min(endIndex, publicacoes.length)} de {publicacoes.length}</span>
                  <span className="text-muted-foreground/50">|</span>
                  <div className="flex items-center gap-1">
                    <span>Por página:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Mobile View - Cards */}
              <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={paginatedPublicacoes.every(p => selectedIds.has(p.id)) && paginatedPublicacoes.length > 0}
                      onCheckedChange={toggleSelectPage}
                    />
                    <span className="text-sm text-muted-foreground">Selecionar página</span>
                  </div>
                  <Button variant="link" size="sm" onClick={toggleSelectAll} className="text-xs p-0 h-auto">
                    {selectedIds.size === publicacoes.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-2">
                    {paginatedPublicacoes.map((pub) => (
                      <div 
                        key={pub.id}
                        className={cn(
                          "p-3 border rounded-lg space-y-2",
                          selectedIds.has(pub.id) && "bg-primary/5 border-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedIds.has(pub.id)}
                              onCheckedChange={() => toggleSelect(pub.id)}
                            />
                            <Badge variant="outline" className="text-xs">{pub.tipo}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(pub.data)}
                          </span>
                        </div>
                        
                        {pub.processo && (
                          <div className="flex items-center gap-1.5">
                            <Hash className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-xs break-all">{pub.processo}</span>
                          </div>
                        )}
                        
                        {pub.tribunal && (
                          <div className="text-xs text-muted-foreground">
                            📍 {pub.tribunal}
                          </div>
                        )}
                        
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {truncateText(pub.conteudo, 150)}
                        </p>
                        
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewContent(pub)}
                            className="flex-1"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenImportDialog(pub)}
                            className="flex-1"
                          >
                            <Import className="w-3.5 h-3.5 mr-1.5" />
                            Importar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Desktop View - Table */}
              <div className="hidden md:block">
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={paginatedPublicacoes.every(p => selectedIds.has(p.id)) && paginatedPublicacoes.length > 0}
                        onCheckedChange={toggleSelectPage}
                      />
                      <span className="text-sm text-muted-foreground">Selecionar página</span>
                    </div>
                    <Button variant="link" size="sm" onClick={toggleSelectAll} className="text-xs p-0 h-auto">
                      {selectedIds.size === publicacoes.length ? "Desmarcar todos" : `Selecionar todos (${publicacoes.length})`}
                    </Button>
                  </div>
                  {selectedIds.size > 0 && (
                    <Badge variant="secondary">{selectedIds.size} selecionados</Badge>
                  )}
                </div>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead className="max-w-[200px]">Conteúdo</TableHead>
                        <TableHead>Tribunal</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPublicacoes.map((pub) => (
                        <TableRow 
                          key={pub.id}
                          className={cn(
                            selectedIds.has(pub.id) && "bg-primary/5"
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(pub.id)}
                              onCheckedChange={() => toggleSelect(pub.id)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(pub.data)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{pub.tipo}</Badge>
                          </TableCell>
                          <TableCell>
                            {pub.processo ? (
                              <span className="font-mono text-xs">{pub.processo}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {truncateText(pub.conteudo, 100)}
                            </p>
                          </TableCell>
                          <TableCell>
                            {pub.tribunal || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewContent(pub)}
                                title="Visualizar conteúdo"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenImportDialog(pub)}
                                title="Importar processo"
                              >
                                <Import className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              
              {/* Server-side pagination (DJEN) */}
              {apiHasMore && (
                <div className="flex flex-col items-center gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="default"
                    onClick={handleLoadMore}
                    disabled={loadingMore || loading}
                  >
                    {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Carregar mais do DJEN
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Carregados {publicacoes.length}
                    {apiTotal ? ` de ${apiTotal}` : ""} resultados
                  </span>
                </div>
              )}

              {/* Pagination Controls - Bottom */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="px-3 text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Resumo IA */}
          {resumo && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h4 className="font-semibold">Resumo das Publicações (IA)</h4>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap text-sm font-sans">{resumo}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barra fixa de ações (sempre visível após busca com resultados) */}
      {hasSearched && publicacoes.length > 0 && (
        <aside className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[60] w-[min(900px,calc(100vw-2rem))]">
          <div className="rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-sm p-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
              {!loadingAll ? (
                <>
                  {apiHasMore && (
                    <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore || loading}>
                      {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      +100
                    </Button>
                  )}

                  <Select value={String(loadAllLimit)} onValueChange={(v) => setLoadAllLimit(Number(v))}>
                    <SelectTrigger className="w-[110px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="200">Até 200</SelectItem>
                      <SelectItem value="500">Até 500</SelectItem>
                      <SelectItem value="1000">Até 1000</SelectItem>
                      <SelectItem value="2000">Até 2000</SelectItem>
                      <SelectItem value="99999">Todos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" variant="default" onClick={handleLoadAll} disabled={loadingMore || loading}>
                    <ChevronsRight className="w-4 h-4 mr-2" />
                    Carregar
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex-1 min-w-[160px]">
                    <Progress
                      value={loadAllProgress.total > 0 ? (loadAllProgress.loaded / loadAllProgress.total) * 100 : 0}
                      className="h-2"
                    />
                    <span className="text-xs text-muted-foreground mt-1 block text-center">
                      {loadAllProgress.loaded} / {loadAllProgress.total}
                    </span>
                  </div>
                  <Button onClick={handleCancelLoadAll} size="sm" variant="destructive">
                    Cancelar
                  </Button>
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center sm:text-right sm:min-w-[170px]">
                Carregados {publicacoes.length}
                {apiTotal ? ` de ${apiTotal}` : ""}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* View Content Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Conteúdo da Publicação</DialogTitle>
            <DialogDescription>
              {selectedPublicacao?.processo && (
                <span className="font-mono">{selectedPublicacao.processo}</span>
              )}
              {selectedPublicacao?.data && ` - ${formatDate(selectedPublicacao.data)}`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4 p-1">
              {selectedPublicacao?.tribunal && (
                <div>
                  <Label className="text-xs text-muted-foreground">Tribunal</Label>
                  <p className="text-sm">{selectedPublicacao.tribunal}</p>
                </div>
              )}
              {selectedPublicacao?.partes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Partes</Label>
                  <p className="text-sm">{selectedPublicacao.partes}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Conteúdo</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedPublicacao?.conteudo}</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedPublicacao) handleOpenImportDialog(selectedPublicacao);
            }}>
              <Import className="w-4 h-4 mr-2" />
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Publicação</DialogTitle>
            <DialogDescription>
              {selectedPublicacao?.processo 
                ? `Processo: ${selectedPublicacao.processo}`
                : "Será criado um novo processo com os dados da publicação"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coordenacao">Coordenação *</Label>
              <Select value={importCoordenacaoId} onValueChange={setImportCoordenacaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {coordenacoes?.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.nome} ({coord.area})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="buscar-andamentos">Buscar andamentos</Label>
                <p className="text-xs text-muted-foreground">
                  Importar histórico de movimentações do processo
                </p>
              </div>
              <Switch
                id="buscar-andamentos"
                checked={importBuscarAndamentos}
                onCheckedChange={setImportBuscarAndamentos}
              />
            </div>
            
            {!importBuscarAndamentos && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Processo não será monitorado automaticamente. Você pode habilitar depois na página do processo.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImportOne} disabled={importingOne || !importCoordenacaoId}>
              {importingOne ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Import className="w-4 h-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Lote Dialog */}
      <Dialog open={importLoteDialogOpen} onOpenChange={(open) => !importing && setImportLoteDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar {selectedIds.size} Publicações</DialogTitle>
            <DialogDescription>
              Selecione a coordenação para onde os processos serão importados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coordenacao-lote">Coordenação *</Label>
              <Select 
                value={importLoteCoordenacaoId} 
                onValueChange={setImportLoteCoordenacaoId}
                disabled={importing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {coordenacoes?.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.nome} ({coord.area})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="buscar-andamentos-lote">Buscar andamentos</Label>
                <p className="text-xs text-muted-foreground">
                  Habilitar monitoramento automático de novos processos
                </p>
              </div>
              <Switch
                id="buscar-andamentos-lote"
                checked={importLoteBuscarAndamentos}
                onCheckedChange={setImportLoteBuscarAndamentos}
                disabled={importing}
              />
            </div>
            
            {!importLoteBuscarAndamentos && !importing && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Processos não serão monitorados automaticamente. Você pode habilitar depois na página de cada processo.
              </p>
            )}
            
            {/* Progress indicator */}
            {importing && importProgress.total > 0 && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso</span>
                  <span className="font-medium">
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(importProgress.current / importProgress.total) * 100} 
                  className="h-2"
                />
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="bg-background p-2 rounded">
                    <div className="font-semibold text-green-600">{importProgress.imported}</div>
                    <div className="text-muted-foreground">Importados</div>
                  </div>
                  <div className="bg-background p-2 rounded">
                    <div className="font-semibold text-blue-600">{importProgress.movimentacoes}</div>
                    <div className="text-muted-foreground">Movimentações</div>
                  </div>
                  <div className="bg-background p-2 rounded">
                    <div className="font-semibold text-red-600">{importProgress.errors}</div>
                    <div className="text-muted-foreground">Erros</div>
                  </div>
                </div>
              </div>
            )}
            
            {!importing && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <p>• Processos já existentes terão movimentação adicionada</p>
                <p>• Novos processos serão criados na coordenação selecionada</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportLoteDialogOpen(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={handleImportSelected} disabled={importing || !importLoteCoordenacaoId}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Import className="w-4 h-4 mr-2" />
                  Importar {selectedIds.size} selecionados
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
};

export default BuscarDJEN;
