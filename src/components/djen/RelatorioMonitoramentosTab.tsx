import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  Calendar,
  Filter,
  Search,
  Users,
  Download,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  monitoramentos: any[];
  coordenacoes: { id: string; nome: string }[];
}

export function RelatorioMonitoramentosTab({ monitoramentos, coordenacoes }: Props) {
  // Filtros
  const [coordenacaoFilter, setCoordenacaoFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [tribunalFilter, setTribunalFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [termoSearch, setTermoSearch] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("hoje");
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(new Date(), "yyyy-MM-dd"));

  // Calcular datas do período
  const { dataInicioCalc, dataFimCalc } = useMemo(() => {
    const hoje = new Date();
    let inicio: Date;
    let fim: Date = hoje;

    switch (periodoFilter) {
      case "hoje":
        inicio = hoje;
        fim = hoje;
        break;
      case "7dias":
        inicio = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30dias":
        inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "mes-atual":
        inicio = startOfMonth(hoje);
        fim = endOfMonth(hoje);
        break;
      case "mes-anterior":
        const mesAnterior = subMonths(hoje, 1);
        inicio = startOfMonth(mesAnterior);
        fim = endOfMonth(mesAnterior);
        break;
      case "personalizado":
        inicio = parseISO(dataInicio);
        fim = parseISO(dataFim);
        break;
      default:
        inicio = hoje;
    }

    return {
      dataInicioCalc: format(inicio, "yyyy-MM-dd"),
      dataFimCalc: format(fim, "yyyy-MM-dd"),
    };
  }, [periodoFilter, dataInicio, dataFim]);

  // Buscar contagens por monitoramento no período via RPC (server-side)
  const { data: contagensPeriodo = [], isLoading } = useQuery({
    queryKey: ["publicacoes-relatorio-contagens", dataInicioCalc, dataFimCalc],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_publicacoes_contagens_por_monitoramento_periodo",
        {
          p_inicio: `${dataInicioCalc}T00:00:00+00:00`,
          p_fim: `${dataFimCalc}T23:59:59.999+00:00`,
        }
      );

      if (error) {
        console.error("Erro ao buscar contagens do período:", error);
        return [];
      }
      return (data || []).map((item: { monitoramento_id: string; total: number; nao_lidas: number }) => ({
        monitoramento_id: item.monitoramento_id,
        total: Number(item.total),
        nao_lidas: Number(item.nao_lidas),
      }));
    },
  });

  // Extrair tribunais e tipos únicos
  const tribunaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    monitoramentos.forEach((m) => {
      if (m.tribunais && Array.isArray(m.tribunais)) {
        m.tribunais.forEach((t: string) => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [monitoramentos]);

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    monitoramentos.forEach((m) => {
      if (m.tipo) set.add(m.tipo);
    });
    return Array.from(set).sort();
  }, [monitoramentos]);

  // Aplicar filtros aos monitoramentos
  const monitoramentosFiltrados = useMemo(() => {
    return monitoramentos.filter((m) => {
      if (coordenacaoFilter !== "todas" && m.coordenacao_id !== coordenacaoFilter) {
        return false;
      }
      if (tipoFilter !== "todos" && m.tipo !== tipoFilter) {
        return false;
      }
      if (statusFilter !== "todos") {
        if (statusFilter === "ativo" && !m.ativo) return false;
        if (statusFilter === "pausado" && m.ativo) return false;
      }
      if (tribunalFilter !== "todos") {
        if (tribunalFilter === "sem-tribunal") {
          if (m.tribunais && m.tribunais.length > 0) return false;
        } else {
          if (!m.tribunais || !m.tribunais.includes(tribunalFilter)) return false;
        }
      }
      if (termoSearch.trim()) {
        const search = termoSearch.toLowerCase();
        const matchTermo = m.termo_busca?.toLowerCase().includes(search);
        const matchDescricao = m.descricao?.toLowerCase().includes(search);
        const matchOab = m.oab?.toLowerCase().includes(search);
        if (!matchTermo && !matchDescricao && !matchOab) {
          return false;
        }
      }
      return true;
    });
  }, [monitoramentos, coordenacaoFilter, tipoFilter, statusFilter, tribunalFilter, termoSearch]);

  // Calcular contagem por monitoramento usando dados agregados da RPC
  const dadosRelatorio = useMemo(() => {
    // Criar Map a partir das contagens do período (RPC)
    const contagem = new Map<string, number>();
    contagensPeriodo.forEach((c: { monitoramento_id: string; total: number }) => {
      contagem.set(c.monitoramento_id, c.total);
    });

    return monitoramentosFiltrados.map((m) => ({
      ...m,
      totalPublicacoes: contagem.get(m.id) || 0,
      coordenacaoNome: coordenacoes.find((c) => c.id === m.coordenacao_id)?.nome || "-",
    })).sort((a, b) => b.totalPublicacoes - a.totalPublicacoes);
  }, [monitoramentosFiltrados, contagensPeriodo, coordenacoes]);

  // Totalizadores
  const totais = useMemo(() => {
    const totalPublicacoes = dadosRelatorio.reduce((sum, m) => sum + m.totalPublicacoes, 0);
    const termosComPublicacoes = dadosRelatorio.filter((m) => m.totalPublicacoes > 0).length;
    const termosSemPublicacoes = dadosRelatorio.filter((m) => m.totalPublicacoes === 0).length;
    return { totalPublicacoes, termosComPublicacoes, termosSemPublicacoes };
  }, [dadosRelatorio]);

  const limparFiltros = () => {
    setCoordenacaoFilter("todas");
    setTipoFilter("todos");
    setTribunalFilter("todos");
    setStatusFilter("todos");
    setTermoSearch("");
    setPeriodoFilter("hoje");
  };

  const filtrosAtivos =
    coordenacaoFilter !== "todas" ||
    tipoFilter !== "todos" ||
    tribunalFilter !== "todos" ||
    statusFilter !== "todos" ||
    termoSearch.trim() !== "";

  const exportarCSV = () => {
    const headers = ["Termo", "Descrição", "Tipo", "OAB/UF", "Coordenação", "Tribunais", "Status", "Total Publicações"];
    const rows = dadosRelatorio.map((m) => [
      m.termo_busca,
      m.descricao || "",
      m.tipo,
      m.oab && m.uf ? `${m.oab}/${m.uf}` : "",
      m.coordenacaoNome,
      m.tribunais?.join(", ") || "Todos",
      m.ativo ? "Ativo" : "Pausado",
      m.totalPublicacoes,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_djen_${dataInicioCalc}_${dataFimCalc}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* Período */}
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                <SelectItem value="mes-atual">Mês atual</SelectItem>
                <SelectItem value="mes-anterior">Mês anterior</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodoFilter === "personalizado" && (
              <>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-[150px] h-9"
                />
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-[150px] h-9"
                />
              </>
            )}

            {/* Busca por termo */}
            <div className="relative w-full sm:w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar termo, OAB..."
                value={termoSearch}
                onChange={(e) => setTermoSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* Coordenação */}
            <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas coordenações</SelectItem>
                {coordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>
                    {coord.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo */}
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                {tiposDisponiveis.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tribunal */}
            <Select value={tribunalFilter} onValueChange={setTribunalFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="Tribunal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tribunais</SelectItem>
                <SelectItem value="sem-tribunal">Sem tribunal (todos)</SelectItem>
                {tribunaisDisponiveis.map((trib) => (
                  <SelectItem key={trib} value={trib}>
                    {trib}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="pausado">Pausados</SelectItem>
              </SelectContent>
            </Select>

            {filtrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Publicações</p>
                <p className="text-2xl font-bold">{totais.totalPublicacoes}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Termos com Publicações</p>
                <p className="text-2xl font-bold text-green-600">{totais.termosComPublicacoes}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Termos sem Publicações</p>
                <p className="text-2xl font-bold text-muted-foreground">{totais.termosSemPublicacoes}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-muted-foreground opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Publicações por Termo ({dadosRelatorio.length} termos)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Período: {format(parseISO(dataInicioCalc), "dd/MM/yyyy", { locale: ptBR })} a{" "}
            {format(parseISO(dataFimCalc), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Termo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Coordenação</TableHead>
                  <TableHead className="hidden md:table-cell">Tribunais</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Publicações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRelatorio.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6">
                      <div className="max-w-[200px]">
                        <div className="font-medium truncate">{m.termo_busca}</div>
                        {m.descricao && (
                          <div className="text-xs text-muted-foreground truncate">{m.descricao}</div>
                        )}
                        {m.oab && m.uf && (
                          <div className="text-xs text-muted-foreground">
                            OAB: {m.oab}/{m.uf}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.tipo}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{m.coordenacaoNome}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {m.tribunais && m.tribunais.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {m.tribunais.length <= 2 ? (
                            m.tribunais.map((t: string) => (
                              <Badge key={t} variant="secondary" className="text-xs">
                                {t}
                              </Badge>
                            ))
                          ) : (
                            <>
                              <Badge variant="secondary" className="text-xs">
                                {m.tribunais[0]}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                +{m.tribunais.length - 1}
                              </Badge>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Todos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.ativo ? "default" : "secondary"}>
                        {m.ativo ? "Ativo" : "Pausado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span
                        className={`font-bold ${
                          m.totalPublicacoes > 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {m.totalPublicacoes}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {dadosRelatorio.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum monitoramento encontrado com os filtros aplicados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
