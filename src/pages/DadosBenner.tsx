import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileSpreadsheet, Send, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { useDadosBenner, DadoBenner } from "@/hooks/useDadosBenner";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";

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

function gerarPlanilha(dados: DadoBenner[]) {
  const headers = [
    "Dossiê", "Contrato", "Tribunal", "Tipo de Recurso", "Data Distribuição", "Turma", "Relator",
    "Análise Quarteirizado", "Risco Mídia Negativa", "Risco", "Provas Digitais",
    "Data Julgamento?", "Data Julgamento", "Horário", "Tipo Julgamento",
    "Matéria de Honra", "Entrega Memoriais", "Sustentação Oral",
    "Sem Transcendência", "Não Conhecido", "Conhecido e Provido", "Conhecido e Não Provido",
    "Outra", "Observações", "Ganhamos", "Perdemos", "Processo Baixado", "Recorrente",
    "Posição Turma Favorável", "Posição Turma Desfavorável",
    "Posição Relator Favorável", "Posição Relator Desfavorável",
    "Recurso Bem Aparelhado", "Recurso Mal Aparelhado", "Chance de Êxito"
  ];

  const rows = dados.map(d => [
    d.dossie || "", d.contrato || "", d.tribunal || "", d.tipo_recurso || "",
    d.data_distribuicao || "", d.turma || "", d.relator || "",
    d.analise_quarteirizado || "", d.risco_midia || "", d.risco_descricao || "",
    d.provas_digitais || "", d.tem_data_julgamento || "",
    d.data_julgamento || "", d.horario_julgamento || "", d.tipo_julgamento || "",
    d.materia_honra || "", d.entrega_memoriais || "", d.sustentacao_oral || "",
    d.resultado_sem_transcendencia ? "S" : "", d.resultado_nao_conhecido ? "S" : "",
    d.resultado_conhecido_provido ? "S" : "", d.resultado_conhecido_nao_provido ? "S" : "",
    d.resultado_outra || "", d.observacoes || "",
    d.ganhamos ? "S" : "", d.perdemos ? "S" : "",
    d.processo_baixado || "", d.recorrente || "",
    d.posicao_turma_favoravel ? "S" : "", d.posicao_turma_desfavoravel ? "S" : "",
    d.posicao_relator_favoravel ? "S" : "", d.posicao_relator_desfavoravel ? "S" : "",
    d.recurso_bem_aparelhado ? "S" : "", d.recurso_mal_aparelhado ? "S" : "",
    d.chance_exito || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Layout Carga");
  const filename = `Layout_Carga_Benner_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

export default function DadosBenner() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DadoBenner | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [gerando, setGerando] = useState(false);

  const { dados, loading, saveDado, deleteDado, updateStatus, fetchDados } = useDadosBenner(statusFilter);

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

  const handleGerarPlanilha = async () => {
    const prontos = dados.filter(d => d.status === "pronto_envio");
    if (!prontos.length) { toast.warning("Nenhum registro pronto para enviar"); return; }
    setGerando(true);
    const filename = gerarPlanilha(prontos);
    await updateStatus(prontos.map(d => d.id), "planilhado");
    setGerando(false);
    toast.success(`Planilha "${filename}" gerada com ${prontos.length} registros!`);
  };

  const handleRegerarPlanilhados = async () => {
    let filtrados = dados.filter(d => d.status === "planilhado");
    if (periodoInicio) filtrados = filtrados.filter(d => d.created_at >= periodoInicio);
    if (periodoFim) filtrados = filtrados.filter(d => d.created_at <= periodoFim + "T23:59:59");
    if (!filtrados.length) { toast.warning("Nenhum registro planilhado no período"); return; }
    gerarPlanilha(filtrados);
    toast.success(`Planilha regerada com ${filtrados.length} registros!`);
  };

  const handleRegerarProntos = () => {
    const prontos = dados.filter(d => d.status === "pronto_envio");
    if (!prontos.length) { toast.warning("Nenhum registro pronto para enviar"); return; }
    gerarPlanilha(prontos);
    toast.success(`Planilha gerada com ${prontos.length} registros prontos!`);
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
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <DadosBennerForm
            dado={editando}
            onSave={saveDado}
            onCancel={() => { setShowForm(false); setEditando(null); }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Dados Benner</h1>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Cadastro
          </Button>
        </div>

        {/* Filtros e Ações */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="pronto_envio">Pronto p/ Enviar</SelectItem>
                <SelectItem value="planilhado">Planilhado</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleGerarPlanilha} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Gerar Planilha (Prontos)
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

        {/* Tabela */}
        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={dados.length > 0 && selectedIds.size === dados.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{d.dossie || "-"}</TableCell>
                  <TableCell>{d.contrato || "-"}</TableCell>
                  <TableCell>{d.tribunal || "-"}</TableCell>
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
    </AppLayout>
  );
}
