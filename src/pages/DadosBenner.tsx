import { useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileSpreadsheet, Send, RefreshCw, Loader2, Trash2, CheckCircle, ExternalLink, AlertTriangle, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DadosBennerImport } from "@/components/benner/DadosBennerImport";
import { useDadosBenner, DadoBenner, DadosBennerFilters } from "@/hooks/useDadosBenner";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
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

export default function DadosBenner() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [filterRelator, setFilterRelator] = useState("");
  const [filterDossie, setFilterDossie] = useState("");
  const [filterContrato, setFilterContrato] = useState("");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterTipoRecurso, setFilterTipoRecurso] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DadosBennerFilters>({ status: "todos" });
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DadoBenner | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoGeracaoBenner | null>(null);

  const { dados, loading, saveDado, deleteDado, updateStatus, fetchDados } = useDadosBenner(appliedFilters);

  const applyFilters = () => {
    setAppliedFilters({
      status: statusFilter,
      relator: filterRelator.trim() || undefined,
      dossie: filterDossie.trim() || undefined,
      contrato: filterContrato.trim() || undefined,
      turma: filterTurma.trim() || undefined,
      tipo_recurso: filterTipoRecurso.trim() || undefined,
    });
  };

  const clearFilters = () => {
    setStatusFilter("todos");
    setFilterRelator("");
    setFilterDossie("");
    setFilterContrato("");
    setFilterTurma("");
    setFilterTipoRecurso("");
    setAppliedFilters({ status: "todos" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === dados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dados.map(d => d.id)));
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

  if (showForm || editando) {
    return (
      <MainLayout title="Dados Benner">
        <div className="max-w-4xl mx-auto">
          <DadosBennerForm
            dado={editando}
            onSave={saveDado}
            onCancel={() => { setShowForm(false); setEditando(null); }}
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
            <Input placeholder="Buscar processo..." value={filterContrato} onChange={e => setFilterContrato(e.target.value)} className="w-[140px]" onKeyDown={e => e.key === "Enter" && applyFilters()} />
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
          <Button variant="outline" size="sm" onClick={applyFilters}>
            <Search className="w-4 h-4 mr-1" /> Filtrar
          </Button>
          {(filterRelator || filterDossie || filterContrato || filterTurma || filterTipoRecurso) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
          )}
        </div>

        {/* Ações */}
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
                  <Checkbox checked={dados.length > 0 && selectedIds.size === dados.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Nº Processo</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Tipo Recurso</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{d.dossie || "-"}</TableCell>
                  <TableCell>{d.contrato || "-"}</TableCell>
                  <TableCell>{d.tribunal || "-"}</TableCell>
                  <TableCell className="text-xs">{d.tipo_recurso || "-"}</TableCell>
                  <TableCell>{d.turma || "-"}</TableCell>
                  <TableCell>{d.relator || "-"}</TableCell>
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
      </div>
    </MainLayout>
  );
}
