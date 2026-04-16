import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle } from "lucide-react";
import { useDistribuicoesTst, DistribuicaoTst as DistTst } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";
import { Link } from "react-router-dom";

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
  const { dados, loading, fetchDados, saveDado, deleteDado } = useDistribuicoesTst();

  // Filters
  const [filtroAba, setFiltroAba] = useState<string>("todas");
  const [filtroBenner, setFiltroBenner] = useState<string>("todos");
  const [filtroProcesso, setFiltroProcesso] = useState("");
  const [filtroDossie, setFiltroDossie] = useState("");
  const [filtroTurma, setFiltroTurma] = useState("");
  const [filtroRelator, setFiltroRelator] = useState("");
  const [filtroParte, setFiltroParte] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // Extract unique aba_origem values for tabs
  const abas = useMemo(() => {
    const set = new Set<string>();
    dados.forEach(d => { if (d.aba_origem) set.add(d.aba_origem); });
    return [...set].sort();
  }, [dados]);

  // Extract unique month/year values from data_distribuicao
  const [filtroMesAno, setFiltroMesAno] = useState<string>("todos");
  const mesesAnos = useMemo(() => {
    const map = new Map<string, number>();
    dados.forEach(d => {
      if (d.data_distribuicao) {
        const [y, m] = d.data_distribuicao.split("-");
        if (y && m) {
          const key = `${y}-${m}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [dados]);

  const hasFilters = filtroProcesso || filtroDossie || filtroTurma || filtroRelator || filtroParte || filtroDataInicio || filtroDataFim || filtroAba !== "todas" || filtroBenner !== "todos" || filtroMesAno !== "todos";

  const clearFilters = () => {
    setFiltroAba("todas");
    setFiltroBenner("todos");
    setFiltroMesAno("todos");
    setFiltroProcesso("");
    setFiltroDossie("");
    setFiltroTurma("");
    setFiltroRelator("");
    setFiltroParte("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  };

  const dadosFiltrados = useMemo(() => {
    return dados.filter(d => {
      if (filtroAba !== "todas" && d.aba_origem !== filtroAba) return false;
      if (filtroBenner === "sim" && !d.benner_atualizado) return false;
      if (filtroBenner === "nao" && d.benner_atualizado) return false;
      if (filtroMesAno !== "todos" && d.data_distribuicao) {
        const mesAno = d.data_distribuicao.slice(0, 7);
        if (mesAno !== filtroMesAno) return false;
      }
      if (filtroMesAno !== "todos" && !d.data_distribuicao) return false;
      if (filtroProcesso && !d.processo_numero?.toLowerCase().includes(filtroProcesso.toLowerCase())) return false;
      if (filtroDossie && !d.dossie?.toLowerCase().includes(filtroDossie.toLowerCase())) return false;
      if (filtroTurma && !d.turma?.toLowerCase().includes(filtroTurma.toLowerCase())) return false;
      if (filtroRelator && !d.relator?.toLowerCase().includes(filtroRelator.toLowerCase())) return false;
      if (filtroParte && !d.parte_recorrente?.toLowerCase().includes(filtroParte.toLowerCase())) return false;
      if (filtroDataInicio && d.data_distribuicao && d.data_distribuicao < filtroDataInicio) return false;
      if (filtroDataFim && d.data_distribuicao && d.data_distribuicao > filtroDataFim) return false;
      return true;
    });
  }, [dados, filtroAba, filtroBenner, filtroMesAno, filtroProcesso, filtroDossie, filtroTurma, filtroRelator, filtroParte, filtroDataInicio, filtroDataFim]);

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta distribuição?")) {
      await deleteDado(id);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

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

  return (
    <MainLayout title="Distribuição TST">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Distribuição TST</h1>
          <div className="flex gap-2 flex-wrap">
            <DistribuicaoTstImport onImported={fetchDados} />
            <DossieUpdateImport onUpdated={fetchDados} />
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
              Todas ({dados.length})
            </Button>
            {abas.map(aba => {
              const count = dados.filter(d => d.aba_origem === aba).length;
              return (
                <Button
                  key={aba}
                  variant={filtroAba === aba ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroAba(aba)}
                  className="text-xs h-7"
                >
                  {aba} ({count})
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
          </div>
          {hasFilters && (
            <p className="text-xs text-muted-foreground">{dadosFiltrados.length} de {dados.length} registros</p>
          )}
        </div>

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dadosFiltrados.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
              ) : dadosFiltrados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
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
