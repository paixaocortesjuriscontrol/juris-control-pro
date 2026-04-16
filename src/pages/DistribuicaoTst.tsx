import { useState, useMemo, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, ExternalLink, Search, X, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useDistribuicoesTst, DistribuicaoTst as DistTst, DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { DossieUpdateImport } from "@/components/distribuicao-tst/DossieUpdateImport";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
        mesAno: filtroMesAno !== "todos" ? filtroMesAno : undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [filtroProcesso, filtroDossie, filtroTurma, filtroRelator, filtroParte, filtroAba, filtroBenner, filtroMesAno, filtroDataInicio, filtroDataFim]);

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
      if (start > 2) pages.push(-1); // ellipsis
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push(-2); // ellipsis
      pages.push(totalPages);
    }
    return pages;
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

  const mesesLabels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <MainLayout title="Distribuição TST">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Distribuição TST</h1>
          <div className="flex gap-2 flex-wrap">
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
          </div>
          <p className="text-xs text-muted-foreground">{totalCount} registros encontrados</p>
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
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
              ) : dados.map(d => (
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
