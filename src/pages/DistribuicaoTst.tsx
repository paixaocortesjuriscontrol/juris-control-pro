import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Database, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useDistribuicoesTst, DistribuicaoTst as DistTst, DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";
import { CargaBennerFromDb } from "@/components/distribuicao-tst/CargaBennerFromDb";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const favorabilidadeColor = (val: string | null) => {
  if (!val) return "secondary";
  const l = val.toLowerCase();
  if (l.includes("positiv")) return "default";
  if (l.includes("negativ")) return "destructive";
  return "secondary";
};

export default function DistribuicaoTst() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DistTst | null>(null);
  const [showCarga, setShowCarga] = useState(false);
  
  // Dados Benner form from distribuição
  const [showBennerForm, setShowBennerForm] = useState(false);
  const [bennerDado, setBennerDado] = useState<DadoBenner | null>(null);
  const [bennerPreFill, setBennerPreFill] = useState<Partial<DadoBennerInsert> | null>(null);
  const [loadingBenner, setLoadingBenner] = useState<string | null>(null);
  
  // Bulk Judit
  const [bulkJuditRunning, setBulkJuditRunning] = useState(false);
  const [bulkJuditProgress, setBulkJuditProgress] = useState({ current: 0, total: 0 });
  const bulkAbortRef = useRef(false);

  // Row selection for bulk Judit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [filtroAba, setFiltroAba] = useState<string>("todas");
  const [filtroBenner, setFiltroBenner] = useState<string>("todos");
  const [filtroProcesso, setFiltroProcesso] = useState("");
  const [filtroDossie, setFiltroDossie] = useState("");
  const [filtroDossieStatus, setFiltroDossieStatus] = useState<string>("todos");
  const [filtroTurma, setFiltroTurma] = useState("");
  const [filtroRelator, setFiltroRelator] = useState("");
  const [filtroParte, setFiltroParte] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroMesAno, setFiltroMesAno] = useState<string>("todos");

  // Debounced text filters
  const [debouncedFilters, setDebouncedFilters] = useState<DistribuicaoTstFilters>({});
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters({
        processo: filtroProcesso || undefined,
        dossie: filtroDossie || undefined,
        turma: filtroTurma || undefined,
        relator: filtroRelator || undefined,
        parte: filtroParte || undefined,
        aba_origem: filtroAba !== "todas" ? filtroAba : undefined,
        benner: filtroBenner as any,
        dossieStatus: filtroDossieStatus !== "todos" ? filtroDossieStatus as any : undefined,
        mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [filtroProcesso, filtroDossie, filtroDossieStatus, filtroTurma, filtroRelator, filtroParte, filtroAba, filtroBenner, filtroMesAno, filtroDataInicio, filtroDataFim]);

  const { dados, loading, fetchDados, saveDado, deleteDado, page, setPage, totalCount, totalPages } = useDistribuicoesTst(debouncedFilters);

  // Fetch distinct aba_origem and meses for tabs (lightweight queries)
  const [abas, setAbas] = useState<{ aba: string; count: number }[]>([]);
  const [mesesAnos, setMesesAnos] = useState<{ key: string; count: number }[]>([]);

  const fetchTabsData = useCallback(async () => {
    // Fetch abas
    const { data: abasData } = await supabase
      .from("distribuicoes_tst" as any)
      .select("aba_origem")
      .not("aba_origem", "is", null);

    if (abasData) {
      const map = new Map<string, number>();
      (abasData as any[]).forEach((d: any) => {
        if (d.aba_origem) map.set(d.aba_origem, (map.get(d.aba_origem) || 0) + 1);
      });
      setAbas([...map.entries()].map(([aba, count]) => ({ aba, count })).sort((a, b) => a.aba.localeCompare(b.aba)));
    }

    // Fetch meses
    const { data: mesesData } = await supabase
      .from("distribuicoes_tst" as any)
      .select("data_distribuicao")
      .not("data_distribuicao", "is", null);

    if (mesesData) {
      const map = new Map<string, number>();
      (mesesData as any[]).forEach((d: any) => {
        if (d.data_distribuicao) {
          const key = d.data_distribuicao.slice(0, 7);
          if (key.length === 7) map.set(key, (map.get(key) || 0) + 1);
        }
      });
      setMesesAnos([...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.key.localeCompare(a.key)));
    }
  }, []);

  useEffect(() => { fetchTabsData(); }, [fetchTabsData]);

  const totalAll = useMemo(() => abas.reduce((s, a) => s + a.count, 0), [abas]);

  const hasFilters = filtroProcesso || filtroDossie || filtroTurma || filtroRelator || filtroParte || filtroDataInicio || filtroDataFim || filtroAba !== "todas" || filtroBenner !== "todos" || filtroMesAno !== "todos" || filtroDossieStatus !== "todos";

  const clearFilters = () => {
    setFiltroAba("todas");
    setFiltroBenner("todos");
    setFiltroDossieStatus("todos");
    setFiltroMesAno("todos");
    setFiltroProcesso("");
    setFiltroDossie("");
    setFiltroTurma("");
    setFiltroRelator("");
    setFiltroParte("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta distribuição?")) {
      await deleteDado(id);
      fetchTabsData();
    }
  };

  const handleRefresh = () => {
    fetchDados();
    fetchTabsData();
  };

  // Open Dados Benner form for a distribuição row
  const handleOpenBenner = async (dist: DistTst) => {
    setLoadingBenner(dist.id);
    try {
      // Look up existing dados_benner by processo number
      const { data: existing } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .eq("processo", dist.processo_numero)
        .limit(1);

      if (existing && (existing as any[]).length > 0) {
        setBennerDado((existing as any[])[0] as DadoBenner);
        setBennerPreFill(null);
      } else {
        // Pre-fill from distribuição data
        setBennerDado(null);
        setBennerPreFill({
          processo: dist.processo_numero,
          dossie: dist.dossie || "",
          turma: dist.turma || "",
          relator: dist.relator || "",
          data_distribuicao: dist.data_distribuicao || null,
          recorrente: dist.parte_recorrente || "",
          status: "rascunho",
        });
      }
      setShowBennerForm(true);
    } catch (err) {
      toast.error("Erro ao buscar dados Benner");
    }
    setLoadingBenner(null);
  };

  // Save handler for Dados Benner form used from this page
  const handleSaveBenner = async (dado: DadoBennerInsert, id?: string) => {
    if (id) {
      const { error } = await supabase.from("dados_benner" as any).update(dado as any).eq("id", id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("dados_benner" as any).insert(dado as any);
      if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    }
    toast.success(id ? "Registro atualizado!" : "Registro salvo!");
    return true;
  };

  // Bulk Judit: process all filtered distribuições
  const handleBulkJudit = async () => {
    bulkAbortRef.current = false;
    setBulkJuditRunning(true);

    try {
      let allProcessos: { processo_numero: string; dossie: string | null; turma: string | null; relator: string | null; data_distribuicao: string | null; parte_recorrente: string | null }[] = [];

      // If rows are selected, use only those
      if (selectedIds.size > 0) {
        allProcessos = dados.filter(d => selectedIds.has(d.id)).map(d => ({
          processo_numero: d.processo_numero,
          dossie: d.dossie,
          turma: d.turma,
          relator: d.relator,
          data_distribuicao: d.data_distribuicao,
          parte_recorrente: d.parte_recorrente,
        }));
      } else {
        // Fetch all from current filtered view
        let offset = 0;
        const FETCH_SIZE = 1000;
        while (true) {
          let q = supabase
            .from("distribuicoes_tst" as any)
            .select("processo_numero, dossie, turma, relator, data_distribuicao, parte_recorrente")
            .order("created_at", { ascending: false });
          
          if (debouncedFilters.aba_origem && debouncedFilters.aba_origem !== "todas") q = q.eq("aba_origem", debouncedFilters.aba_origem);
          if (debouncedFilters.benner === "sim") q = q.eq("benner_atualizado", true);
          else if (debouncedFilters.benner === "nao") q = q.or("benner_atualizado.is.null,benner_atualizado.eq.false");
          if (debouncedFilters.processo) q = q.ilike("processo_numero", `%${debouncedFilters.processo}%`);
          if (debouncedFilters.dossie) q = q.ilike("dossie", `%${debouncedFilters.dossie}%`);
          if (debouncedFilters.turma) q = q.ilike("turma", `%${debouncedFilters.turma}%`);
          if (debouncedFilters.relator) q = q.ilike("relator", `%${debouncedFilters.relator}%`);
          if (debouncedFilters.parte) q = q.ilike("parte_recorrente", `%${debouncedFilters.parte}%`);

          const { data, error } = await q.range(offset, offset + FETCH_SIZE - 1);
          if (error) { toast.error("Erro ao buscar processos: " + error.message); break; }
          allProcessos = allProcessos.concat((data as any[]) || []);
          if (!data || data.length < FETCH_SIZE) break;
          offset += FETCH_SIZE;
        }
      }

      // Deduplicate by processo_numero
      const seen = new Set<string>();
      const unique = allProcessos.filter(p => {
        if (!p.processo_numero || seen.has(p.processo_numero)) return false;
        seen.add(p.processo_numero);
        return true;
      });

      if (unique.length === 0) {
        toast.info("Nenhum processo encontrado");
        setBulkJuditRunning(false);
        return;
      }

      setBulkJuditProgress({ current: 0, total: unique.length });
      let successCount = 0;

      for (let i = 0; i < unique.length; i++) {
        if (bulkAbortRef.current) { toast.info("Operação cancelada"); break; }

        const proc = unique[i];
        setBulkJuditProgress({ current: i + 1, total: unique.length });

        try {
          const { data: juditData, error: juditError } = await supabase.functions.invoke("buscar-judit", {
            body: { numero_processo: proc.processo_numero, tribunal: "TST" },
          });

          if (juditError || juditData?.error) continue;

          // Build dados_benner record
          const tribunaisAceitos = ["TST", "STF", "STJ"];
          const tribunalMapeado = tribunaisAceitos.includes(juditData.tribunal) ? juditData.tribunal : null;

          const dadoToSave: any = {
            processo: proc.processo_numero,
            dossie: juditData.dossie || proc.dossie || "",
            turma: juditData.turma || proc.turma || "",
            relator: juditData.relator || proc.relator || "",
            data_distribuicao: juditData.data_distribuicao || proc.data_distribuicao || null,
            recorrente: juditData.recorrente || proc.parte_recorrente || "",
            tribunal: tribunalMapeado || "TST",
            tipo_recurso: juditData.tipo_recurso || null,
            situacao_processo: juditData.situacao_processo || null,
            tem_data_julgamento: juditData.tem_data_julgamento || null,
            data_julgamento: juditData.data_julgamento || null,
            horario_julgamento: juditData.horario_julgamento || null,
            tipo_julgamento: juditData.tipo_julgamento || null,
            resultado_sem_transcendencia: juditData.resultado_sem_transcendencia || false,
            resultado_nao_conhecido: juditData.resultado_nao_conhecido || false,
            resultado_conhecido_provido: juditData.resultado_conhecido_provido || false,
            resultado_conhecido_nao_provido: juditData.resultado_conhecido_nao_provido || false,
            resultado_outra: juditData.resultado_outra || null,
            processo_baixado: juditData.processo_baixado || null,
            status: "rascunho",
          };

          // Upsert: check if exists
          const { data: existingBenner } = await supabase
            .from("dados_benner" as any)
            .select("id")
            .eq("processo", proc.processo_numero)
            .limit(1);

          if (existingBenner && (existingBenner as any[]).length > 0) {
            // Update only non-null judit fields
            const updateFields: any = {};
            if (juditData.tipo_recurso) updateFields.tipo_recurso = juditData.tipo_recurso;
            if (juditData.relator) updateFields.relator = juditData.relator;
            if (juditData.turma) updateFields.turma = juditData.turma;
            if (tribunalMapeado) updateFields.tribunal = tribunalMapeado;
            if (juditData.recorrente) updateFields.recorrente = juditData.recorrente;
            if (juditData.situacao_processo) updateFields.situacao_processo = juditData.situacao_processo;
            if (juditData.data_distribuicao) updateFields.data_distribuicao = juditData.data_distribuicao;
            if (juditData.tem_data_julgamento) updateFields.tem_data_julgamento = juditData.tem_data_julgamento;
            if (juditData.data_julgamento) updateFields.data_julgamento = juditData.data_julgamento;
            if (juditData.horario_julgamento) updateFields.horario_julgamento = juditData.horario_julgamento;
            if (juditData.tipo_julgamento) updateFields.tipo_julgamento = juditData.tipo_julgamento;
            if (juditData.resultado_sem_transcendencia) updateFields.resultado_sem_transcendencia = true;
            if (juditData.resultado_nao_conhecido) updateFields.resultado_nao_conhecido = true;
            if (juditData.resultado_conhecido_provido) updateFields.resultado_conhecido_provido = true;
            if (juditData.resultado_conhecido_nao_provido) updateFields.resultado_conhecido_nao_provido = true;
            if (juditData.resultado_outra) updateFields.resultado_outra = juditData.resultado_outra;
            if (juditData.processo_baixado) updateFields.processo_baixado = juditData.processo_baixado;

            if (Object.keys(updateFields).length > 0) {
              await supabase.from("dados_benner" as any).update(updateFields as any).eq("id", (existingBenner as any[])[0].id);
              successCount++;
            }
          } else {
            // Get user id
            const { data: authData } = await supabase.auth.getUser();
            dadoToSave.user_id = authData?.user?.id || null;
            await supabase.from("dados_benner" as any).insert(dadoToSave);
            successCount++;
          }

          // Throttle to avoid rate limits
          await new Promise(r => setTimeout(r, 800));
        } catch {
          // Continue on error
        }
      }

      toast.success(`Judit: ${successCount} de ${unique.length} processo(s) atualizados no Dados Benner`);
    } catch (err: any) {
      toast.error("Erro no preenchimento em massa: " + (err?.message || "Erro desconhecido"));
    }
    setBulkJuditRunning(false);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

  // Pagination helpers
  const getVisiblePages = () => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, page - 2);
      let end = Math.min(totalPages - 1, page + 2);
      if (start > 2) pages.push(-1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push(-2);
      pages.push(totalPages);
    }
    return pages;
  };

  if (showBennerForm) {
    return (
      <MainLayout title="Distribuição TST - Dados Benner">
        <div className="max-w-4xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setShowBennerForm(false); setBennerDado(null); setBennerPreFill(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Distribuição TST
          </Button>
          <DadosBennerForm
            dado={bennerDado}
            initialData={bennerPreFill || undefined}
            onSave={handleSaveBenner}
            onCancel={() => { setShowBennerForm(false); setBennerDado(null); setBennerPreFill(null); }}
          />
        </div>
      </MainLayout>
    );
  }

  if (showCarga) {
    return (
      <MainLayout title="Distribuição TST - Carga Benner">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Carga Benner (Dados do Supabase)
            </h1>
            <Button variant="outline" onClick={() => setShowCarga(false)}>Voltar à Lista</Button>
          </div>
          <CargaBennerFromDb filters={{
            aba_origem: filtroAba !== "todas" ? filtroAba : undefined,
            benner: filtroBenner as any,
            processo: filtroProcesso || undefined,
            dossie: filtroDossie || undefined,
            turma: filtroTurma || undefined,
            relator: filtroRelator || undefined,
            parte: filtroParte || undefined,
            mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
            dataInicio: filtroDataInicio || undefined,
            dataFim: filtroDataFim || undefined,
          }} />
        </div>
      </MainLayout>
    );
  }

  if (showForm || editando) {
    return (
      <MainLayout title="Distribuição TST">
        <div className="max-w-4xl mx-auto">
          <DistribuicaoTstForm
            dado={editando}
            onSave={saveDado}
            onCancel={() => { setShowForm(false); setEditando(null); }}
          />
        </div>
      </MainLayout>
    );
  }

  const mesesLabels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <MainLayout title="Distribuição TST">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Distribuição TST</h1>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="default" 
              onClick={handleBulkJudit} 
              disabled={bulkJuditRunning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkJuditRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {bulkJuditRunning 
                ? `Judit ${bulkJuditProgress.current}/${bulkJuditProgress.total}` 
                : selectedIds.size > 0 
                  ? `Preencher Selecionados (${selectedIds.size}) com Judit`
                  : "Preencher com Judit"}
            </Button>
            {bulkJuditRunning && (
              <Button variant="destructive" size="sm" onClick={() => { bulkAbortRef.current = true; }}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowCarga(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Gerar Carga Benner
            </Button>
            <DistribuicaoTstImport onImported={handleRefresh} />
            <DossieUpdateImport onUpdated={handleRefresh} />
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Distribuição
            </Button>
            <Link to="/dados-benner">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Dados Benner
              </Button>
            </Link>
          </div>
        </div>

        {/* Aba tabs */}
        {abas.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={filtroAba === "todas" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroAba("todas")}
              className="text-xs h-7"
            >
              Todas ({totalAll})
            </Button>
            {abas.map(({ aba, count }) => (
              <Button
                key={aba}
                variant={filtroAba === aba ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroAba(aba)}
                className="text-xs h-7"
              >
                {aba} ({count})
              </Button>
            ))}
          </div>
        )}

        {/* Mês/Ano tabs */}
        {mesesAnos.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={filtroMesAno === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroMesAno("todos")}
              className="text-xs h-7"
            >
              Todos meses
            </Button>
            {mesesAnos.map(({ key, count }) => {
              const [y, m] = key.split("-");
              const label = `${mesesLabels[parseInt(m) - 1]}/${y}`;
              return (
                <Button
                  key={key}
                  variant={filtroMesAno === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroMesAno(key)}
                  className="text-xs h-7"
                >
                  {label} ({count})
                </Button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Search className="w-4 h-4" /> Filtros
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <Input placeholder="Processo" value={filtroProcesso} onChange={e => setFiltroProcesso(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Dossiê" value={filtroDossie} onChange={e => setFiltroDossie(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Turma" value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Relator" value={filtroRelator} onChange={e => setFiltroRelator(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Parte Recorrente" value={filtroParte} onChange={e => setFiltroParte(e.target.value)} className="h-8 text-xs" />
            <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="h-8 text-xs" title="Data início" />
            <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="h-8 text-xs" title="Data fim" />
            <Select value={filtroBenner} onValueChange={setFiltroBenner}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Benner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Benner: Todos</SelectItem>
                <SelectItem value="sim">Benner: Sim</SelectItem>
                <SelectItem value="nao">Benner: Não</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroDossieStatus} onValueChange={setFiltroDossieStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Dossiê" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Dossiê: Todos</SelectItem>
                <SelectItem value="preenchido">Preenchido</SelectItem>
                <SelectItem value="nao_preenchido">Não Preenchido</SelectItem>
                <SelectItem value="valido">Preenchido Válido</SelectItem>
                <SelectItem value="invalido">Preenchido Inválido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{totalCount} registros encontrados</p>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setSelectedIds(new Set())}>
                {selectedIds.size} selecionado(s) — limpar
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Judit progress */}
        {bulkJuditRunning && (
          <div className="border border-emerald-500/30 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Preenchendo com Judit...</span>
              <span className="text-xs text-muted-foreground">{bulkJuditProgress.current}/{bulkJuditProgress.total}</span>
            </div>
            <Progress value={bulkJuditProgress.total > 0 ? (bulkJuditProgress.current / bulkJuditProgress.total) * 100 : 0} className="h-2" />
          </div>
        )}

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox 
                    checked={dados.length > 0 && dados.every(d => selectedIds.has(d.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set([...selectedIds, ...dados.map(d => d.id)]));
                      } else {
                        const newSet = new Set(selectedIds);
                        dados.forEach(d => newSet.delete(d.id));
                        setSelectedIds(newSet);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Relator +/-</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Turma +/-</TableHead>
                <TableHead>Parte Recorrente</TableHead>
                <TableHead>Aba</TableHead>
                <TableHead>Benner</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedIds);
                        if (checked) newSet.add(d.id);
                        else newSet.delete(d.id);
                        setSelectedIds(newSet);
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(d.data_distribuicao)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.processo_numero}</TableCell>
                  <TableCell className="text-sm">{d.dossie || "—"}</TableCell>
                  <TableCell className="text-sm">{d.equipe || "—"}</TableCell>
                  <TableCell className="text-sm">{d.relator || "—"}</TableCell>
                  <TableCell>
                    {d.relator_favorabilidade && (
                      <Badge variant={favorabilidadeColor(d.relator_favorabilidade) as any} className="text-xs">
                        {d.relator_favorabilidade}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{d.turma || "—"}</TableCell>
                  <TableCell>
                    {d.turma_favorabilidade && (
                      <Badge variant={favorabilidadeColor(d.turma_favorabilidade) as any} className="text-xs">
                        {d.turma_favorabilidade}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{d.parte_recorrente || "—"}</TableCell>
                  <TableCell>
                    {d.aba_origem && <Badge variant="outline" className="text-xs">{d.aba_origem}</Badge>}
                  </TableCell>
                  <TableCell>
                    {d.benner_atualizado ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleOpenBenner(d)}
                        disabled={loadingBenner === d.id}
                        title="Abrir Dados Benner"
                      >
                        {loadingBenner === d.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Database className="w-4 h-4 text-primary" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} · {totalCount} registros
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {getVisiblePages().map((p, i) =>
                p < 0 ? (
                  <span key={`e${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
