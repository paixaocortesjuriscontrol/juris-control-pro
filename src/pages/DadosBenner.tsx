import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileSpreadsheet, Send, RefreshCw, Loader2, Trash2, CheckCircle, ExternalLink, AlertTriangle, Search, Scale } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DadosBennerImport } from "@/components/benner/DadosBennerImport";
import { useDadosBenner, DadoBenner, DadosBennerFilters } from "@/hooks/useDadosBenner";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { DadosBennerDetail } from "@/components/benner/DadosBennerDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { gerarPlanilhaBenner, ResultadoGeracaoBenner } from "@/utils/gerarPlanilhaBenner";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  pronto_envio: "Pronto p/ Enviar",
  planilhado: "Planilhado",
  enviado: "Enviado",
};

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  pronto_envio: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  planilhado: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  enviado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface TransitoResult {
  numero: string;
  situacao: string;
  data_transito: string | null;
  grau: string | null;
  erro: string | null;
}

export default function DadosBenner() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [filterRelator, setFilterRelator] = useState("");
  const [filterDossie, setFilterDossie] = useState("");
  const [filterProcesso, setFilterProcesso] = useState("");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterTipoRecurso, setFilterTipoRecurso] = useState("");
  const [filterTemPauta, setFilterTemPauta] = useState(false);
  const [filterTemDistribuicao, setFilterTemDistribuicao] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<DadosBennerFilters>({ status: "todos" });
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DadoBenner | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoGeracaoBenner | null>(null);

  const { dados, loading, saveDado, deleteDado, updateStatus, fetchDados, page, setPage, totalPages, totalCount, fetchAllIds } = useDadosBenner(appliedFilters);

  const applyFilters = () => {
    setAppliedFilters({
      status: statusFilter,
      relator: filterRelator.trim() || undefined,
      dossie: filterDossie.trim() || undefined,
      processo: filterProcesso.trim() || undefined,
      turma: filterTurma.trim() || undefined,
      tipo_recurso: filterTipoRecurso.trim() || undefined,
      tem_pauta: filterTemPauta || undefined,
      tem_distribuicao: filterTemDistribuicao || undefined,
    });
  };

  const clearFilters = () => {
    setStatusFilter("todos");
    setFilterRelator("");
    setFilterDossie("");
    setFilterProcesso("");
    setFilterTurma("");
    setFilterTipoRecurso("");
    setFilterTemPauta(false);
    setFilterTemDistribuicao(false);
    setAppliedFilters({ status: "todos" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [loadingSelectAll, setLoadingSelectAll] = useState(false);

  const toggleAll = async () => {
    if (selectedIds.size === totalCount && totalCount > 0) {
      setSelectedIds(new Set());
    } else {
      setLoadingSelectAll(true);
      try {
        const allIds = await fetchAllIds();
        setSelectedIds(new Set(allIds));
      } finally {
        setLoadingSelectAll(false);
      }
    }
  };

  const handleGerarComResultado = async (registros: DadoBenner[], atualizarStatus?: string) => {
    setGerando(true);
    setUltimoResultado(null);
    try {
      const resultado = await gerarPlanilhaBenner(registros);
      setUltimoResultado(resultado);
      if (atualizarStatus && resultado.totalValidos > 0) {
        const idsValidos = registros.filter(d => !resultado.rejeitados.some(r => r.id === d.id)).map(d => d.id);
        if (idsValidos.length) await updateStatus(idsValidos, atualizarStatus);
      }
      if (resultado.totalRejeitados > 0) {
        toast.warning(`${resultado.totalRejeitados} registro(s) rejeitado(s) por dossiê inválido`);
      }
      if (resultado.totalValidos > 0) {
        toast.success(`Planilha gerada com ${resultado.totalValidos} registros válidos!`);
      } else {
        toast.error("Nenhum registro válido para gerar planilha. Todos possuem dossiê inválido.");
      }
    } finally {
      setGerando(false);
    }
  };

  const handleGerarPlanilha = async () => {
    const prontos = dados.filter(d => d.status === "pronto_envio");
    if (!prontos.length) { toast.warning("Nenhum registro pronto para enviar"); return; }
    await handleGerarComResultado(prontos, "planilhado");
  };

  const handleRegerarPlanilhados = async () => {
    let filtrados = dados.filter(d => d.status === "planilhado");
    if (periodoInicio) filtrados = filtrados.filter(d => d.created_at >= periodoInicio);
    if (periodoFim) filtrados = filtrados.filter(d => d.created_at <= periodoFim + "T23:59:59");
    if (!filtrados.length) { toast.warning("Nenhum registro planilhado no período"); return; }
    await handleGerarComResultado(filtrados);
  };

  const handleRegerarProntos = async () => {
    const prontos = dados.filter(d => d.status === "pronto_envio");
    if (!prontos.length) { toast.warning("Nenhum registro pronto para enviar"); return; }
    await handleGerarComResultado(prontos);
  };

  const handleMarcarPronto = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como pronto"); return; }
    await updateStatus(ids, "pronto_envio");
    setSelectedIds(new Set());
  };

  const handleMarcarEnviado = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.warning("Selecione registros para marcar como enviado"); return; }
    await updateStatus(ids, "enviado");
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir este registro?")) {
      await deleteDado(id);
    }
  };

  const [verificandoTransito, setVerificandoTransito] = useState(false);
  const [transitoResults, setTransitoResults] = useState<TransitoResult[]>([]);
  const [showTransitoDialog, setShowTransitoDialog] = useState(false);
  const [transitoProgressText, setTransitoProgressText] = useState("");
  const [transitoProgressPct, setTransitoProgressPct] = useState(0);
  const cancelTransitoRef = useRef(false);

  const handleVerificarTransito = async () => {
    // 1. Fetch ALL filtered records with contrato (not just current page)
    setVerificandoTransito(true);
    setTransitoResults([]);
    setShowTransitoDialog(true);
    setTransitoProgressText("Buscando todos os registros filtrados...");
    setTransitoProgressPct(0);
    cancelTransitoRef.current = false;

    try {
      // Fetch all IDs + contrato from selected or all filtered records
      const useSelected = selectedIds.size > 0;
      let allRecords: { id: string; processo: string }[] = [];

      if (useSelected) {
        // Fetch contrato for all selected IDs in batches
        const selectedArr = Array.from(selectedIds);
        for (let i = 0; i < selectedArr.length; i += 200) {
          const batch = selectedArr.slice(i, i + 200);
          const { data } = await supabase
            .from("dados_benner" as any)
            .select("id, processo")
            .in("id", batch);
          if (data) allRecords.push(...(data as any[]));
        }
      } else {
        // Fetch all filtered records
        let offset = 0;
        while (true) {
          let query = supabase.from("dados_benner" as any).select("id, processo").order("created_at", { ascending: false });
          if (appliedFilters.status && appliedFilters.status !== "todos") query = query.eq("status", appliedFilters.status);
          if (appliedFilters.relator) query = query.ilike("relator", `%${appliedFilters.relator}%`);
          if (appliedFilters.dossie) query = query.ilike("dossie", `%${appliedFilters.dossie}%`);
          if (appliedFilters.processo) query = query.ilike("processo", `%${appliedFilters.processo}%`);
          if (appliedFilters.turma) query = query.ilike("turma", `%${appliedFilters.turma}%`);
          if (appliedFilters.tipo_recurso) query = query.ilike("tipo_recurso", `%${appliedFilters.tipo_recurso}%`);
          const { data, error } = await query.range(offset, offset + 999);
          if (error || !data?.length) break;
          allRecords.push(...(data as any[]));
          if (data.length < 1000) break;
          offset += 1000;
        }
      }

      // Filter only records with valid process numbers
      const validRecords = allRecords.filter(r => {
        const num = (r.processo || "").replace(/[^0-9]/g, "");
        return num.length >= 10;
      });

      if (!validRecords.length) {
        toast.warning("Nenhum registro com número de processo válido encontrado");
        setShowTransitoDialog(false);
        setVerificandoTransito(false);
        return;
      }

      setTransitoProgressText(`0 de ${validRecords.length} verificados...`);

      // 2. Process in batches of 10, calling edge function for each batch
      const BATCH_SIZE = 10;
      const allResults: TransitoResult[] = [];

      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        if (cancelTransitoRef.current) {
          toast.info(`Verificação cancelada. ${allResults.length} processo(s) já verificados.`);
          break;
        }

        const batch = validRecords.slice(i, i + BATCH_SIZE);
        const processos = batch.map(r => r.processo!);
        const idsBenner = batch.map(r => r.id);

        try {
          const { data, error } = await supabase.functions.invoke("verificar-transito-julgado", {
            body: { processos, ids_benner: idsBenner },
          });

          if (error) {
            // Add error results for this batch
            batch.forEach(b => allResults.push({
              numero: b.processo!, situacao: "Erro", data_transito: null, grau: null, erro: error.message,
            }));
          } else {
            const resultados: TransitoResult[] = data?.resultados || [];
            allResults.push(...resultados);
          }
        } catch (err: any) {
          batch.forEach(b => allResults.push({
            numero: b.processo!, situacao: "Erro", data_transito: null, grau: null, erro: err?.message || "Erro",
          }));
        }

        setTransitoResults([...allResults]);
        const processed = Math.min(i + BATCH_SIZE, validRecords.length);
        const pct = Math.round((processed / validRecords.length) * 100);
        setTransitoProgressPct(pct);
        setTransitoProgressText(`${processed} de ${validRecords.length} verificados...`);
      }

      if (!cancelTransitoRef.current) {
        const transitos = allResults.filter(r => r.situacao === "Trânsito em Julgado").length;
        const ativos = allResults.filter(r => r.situacao === "Ativo").length;
        const erros = allResults.filter(r => r.situacao === "Erro" || r.situacao === "Não encontrado").length;
        toast.success(`Verificação concluída: ${transitos} em trânsito, ${ativos} ativo(s), ${erros} erro(s)/não encontrado(s)`);
      }

      setTransitoProgressText("");
      fetchDados();
    } catch (err: any) {
      toast.error("Erro ao verificar: " + (err?.message || "Erro desconhecido"));
      setShowTransitoDialog(false);
    } finally {
      setVerificandoTransito(false);
    }
  };

  if (editando) {
    return (
      <MainLayout title="Dados Benner">
        <div className="max-w-5xl mx-auto">
          <DadosBennerDetail
            dado={editando}
            onSave={saveDado}
            onCancel={() => setEditando(null)}
          />
        </div>
      </MainLayout>
    );
  }

  if (showForm) {
    return (
      <MainLayout title="Dados Benner">
        <div className="max-w-4xl mx-auto">
          <DadosBennerForm
            dado={null}
            onSave={saveDado}
            onCancel={() => setShowForm(false)}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dados Benner">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Dados Benner</h1>
          <div className="flex gap-2">
            <DadosBennerImport onImported={fetchDados} />
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Cadastro
            </Button>
            <Link to="/distribuicao-tst">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Distribuição TST
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setAppliedFilters(prev => ({ ...prev, status: v })); }}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="pronto_envio">Pronto p/ Enviar</SelectItem>
                <SelectItem value="planilhado">Planilhado</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dossiê</Label>
            <Input placeholder="Buscar dossiê..." value={filterDossie} onChange={e => setFilterDossie(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nº Processo</Label>
            <Input placeholder="Buscar processo..." value={filterProcesso} onChange={e => setFilterProcesso(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Relator</Label>
            <Input placeholder="Buscar relator..." value={filterRelator} onChange={e => setFilterRelator(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Turma</Label>
            <Input placeholder="Buscar turma..." value={filterTurma} onChange={e => setFilterTurma(e.target.value)} className="w-[120px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo Recurso</Label>
            <Input placeholder="Buscar tipo..." value={filterTipoRecurso} onChange={e => setFilterTipoRecurso(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="filter-pauta" checked={filterTemPauta} onCheckedChange={(v) => setFilterTemPauta(!!v)} />
            <Label htmlFor="filter-pauta" className="text-xs cursor-pointer">Tem Pauta</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="filter-dist" checked={filterTemDistribuicao} onCheckedChange={(v) => setFilterTemDistribuicao(!!v)} />
            <Label htmlFor="filter-dist" className="text-xs cursor-pointer">Tem Distribuição</Label>
          </div>
          <Button variant="outline" size="sm" onClick={applyFilters}>
            <Search className="w-4 h-4 mr-1" /> Filtrar
          </Button>
          {(filterRelator || filterDossie || filterProcesso || filterTurma || filterTipoRecurso || filterTemPauta || filterTemDistribuicao) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
          )}
        </div>

        {/* Ações */}
        {selectedIds.size > 0 && (
          <p className="text-sm text-muted-foreground">{selectedIds.size} registro(s) selecionado(s) de {totalCount}</p>
        )}
        <div className="flex flex-wrap gap-3 items-end">
          <Button variant="outline" onClick={handleGerarPlanilha} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Gerar Planilha (Prontos)
          </Button>

          <Button variant="outline" onClick={handleMarcarPronto} disabled={selectedIds.size === 0}>
            <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pronto
          </Button>

          <Button variant="outline" onClick={handleMarcarEnviado} disabled={selectedIds.size === 0}>
            <Send className="w-4 h-4 mr-2" /> Marcar como Enviado
          </Button>

          <Button
            variant="outline"
            onClick={handleVerificarTransito}
            disabled={verificandoTransito}
          >
            {verificandoTransito ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scale className="w-4 h-4 mr-2" />}
            Verificar Trânsito em Julgado {selectedIds.size > 0 ? `(${selectedIds.size})` : "(Todos)"}
          </Button>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="w-[150px]" />
            </div>
            <Button variant="outline" size="sm" onClick={handleRegerarPlanilhados}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regerar Planilhados
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegerarProntos}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regerar Prontos
            </Button>
          </div>
        </div>

        {/* Resultado da última geração */}
        {ultimoResultado && ultimoResultado.totalRejeitados > 0 && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>{ultimoResultado.totalValidos}</strong> registro(s) exportado(s) com sucesso.{" "}
              <strong>{ultimoResultado.totalRejeitados}</strong> registro(s) rejeitado(s) por dossiê inválido/não localizado 
              — arquivo de rejeições baixado separadamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabela */}
        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={totalCount > 0 && selectedIds.size === totalCount} onCheckedChange={toggleAll} disabled={loadingSelectAll} />
                </TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Nº Processo</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Tipo Recurso</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{d.dossie || "-"}</TableCell>
                  <TableCell>{d.processo || "-"}</TableCell>
                  <TableCell>{d.tribunal || "-"}</TableCell>
                  <TableCell className="text-xs">{d.tipo_recurso || "-"}</TableCell>
                  <TableCell>{d.turma || "-"}</TableCell>
                  <TableCell>{d.relator || "-"}</TableCell>
                  <TableCell>
                    {(d as any).situacao_processo ? (
                      <Badge variant={(d as any).situacao_processo?.includes("Trânsito") ? "destructive" : "outline"} className="text-xs">
                        {(d as any).situacao_processo}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[d.status] || ""}>{statusLabels[d.status] || d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(d.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              {totalCount} registro(s) — Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Próxima <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Dialog Transito em Julgado */}
        <Dialog open={showTransitoDialog} onOpenChange={setShowTransitoDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Verificação de Trânsito em Julgado
              </DialogTitle>
            </DialogHeader>

            {(verificandoTransito || transitoProgressText) && (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">{transitoProgressText}</span>
                  </div>
                  {verificandoTransito && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { cancelTransitoRef.current = true; }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                <Progress value={transitoProgressPct} className="h-2" />
              </div>
            )}

            {transitoResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <Badge variant="destructive">
                    {transitoResults.filter(r => r.situacao === "Trânsito em Julgado").length} Trânsito em Julgado
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {transitoResults.filter(r => r.situacao === "Ativo").length} Ativo(s)
                  </Badge>
                  <Badge variant="secondary">
                    {transitoResults.filter(r => r.situacao === "Erro" || r.situacao === "Não encontrado").length} Erro/Não encontrado
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Processo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Data Trânsito</TableHead>
                      <TableHead>Grau/Instância</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transitoResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{r.numero}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.situacao === "Trânsito em Julgado" ? "destructive" :
                              r.situacao === "Ativo" ? "outline" : "secondary"
                            }
                            className={r.situacao === "Ativo" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : ""}
                          >
                            {r.situacao}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.data_transito || "-"}</TableCell>
                        <TableCell className="text-xs">{r.grau || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.erro || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
