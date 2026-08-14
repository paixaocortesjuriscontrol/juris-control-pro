import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Radar,
  Search,
  RefreshCw,
  Paperclip,
  ChevronRight,
  X,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEscopoAcompanhamentoEspecial } from "@/hooks/useEscopoAcompanhamentoEspecial";
import { useUserRole } from "@/hooks/useUserRole";
import { useMonitoramentoCounts } from "@/hooks/useMonitoramentoCounts";
import { MainLayout } from "@/components/layout/MainLayout";


type Evento = {
  id: string;
  processo_id: string;
  step_date: string | null;
  criado_em: string;
  conteudo: string | null;
  instancia: string | null;
  tribunal: string | null;
  anexos_count: number | null;
  lido_em: string | null;
  processo?: {
    numero: string | null;
    polo_ativo: string | null;
    polo_passivo: string | null;
    coordenacao_id: string | null;
  } | null;
};

type Grupo = {
  processoId: string;
  numero: string;
  parte: string;
  coordenacaoId: string | null;
  eventos: Evento[];
  naoLidos: number;
  ultima: string | null;
};

type Divergencia = {
  id: string;
  processo_id: string;
  campo: string;
  valor_atual: string | null;
  valor_judit: string | null;
  detectado_em: string;
  resolvido_em: string | null;
  processo?: {
    numero: string | null;
    polo_ativo: string | null;
    polo_passivo: string | null;
    coordenacao_id: string | null;
  } | null;
};

type GrupoDivergencia = {
  processoId: string;
  numero: string;
  parte: string;
  coordenacaoId: string | null;
  divergencias: Divergencia[];
  pendentes: number;
  ultima: string | null;
};


const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "todos", label: "Todo o período" },
];

const LABEL_CAMPO: Record<string, string> = {
  tribunal: "Tribunal",
  orgao_julgador: "Órgão julgador",
  classe: "Classe",
  natureza: "Natureza",
  assunto: "Assunto",
  materia: "Matéria",
  comarca: "Comarca",
  vara: "Vara/Câmara",
  uf: "UF",
  instancia: "Instância",
  justica: "Justiça",
  esfera: "Esfera",
  area: "Área",
  sistema: "Sistema",
  data_distribuicao: "Data de distribuição",
  data_citacao: "Data de citação",
  data_recebimento: "Data de recebimento",
  valor_causa: "Valor da causa",
  polo_ativo: "Polo ativo",
  polo_passivo: "Polo passivo",
  reclamante: "Reclamante",
  reclamados: "Reclamado(s)",
  terceiro_envolvido: "Terceiro envolvido",
  pedidos: "Pedidos",
  fase: "Fase",
  segredo_justica: "Segredo de justiça",
};

const POR_PAGINA = 100;

export default function Monitoramento() {
  const qc = useQueryClient();
  const { isAdminOrCoordinator } = useUserRole();
  const { processoIds, semRestricao, isLoading: escopoLoading } = useEscopoAcompanhamentoEspecial();
  const { movimentacoes: countMov, divergencias: countDiv } = useMonitoramentoCounts();

  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("30");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [coordenacaoId, setCoordenacaoId] = useState("todas");
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [pagina, setPagina] = useState(1);

  const [buscaDiv, setBuscaDiv] = useState("");
  const [periodoDiv, setPeriodoDiv] = useState("30");
  const [dataInicialDiv, setDataInicialDiv] = useState("");
  const [dataFinalDiv, setDataFinalDiv] = useState("");
  const [coordenacaoIdDiv, setCoordenacaoIdDiv] = useState("todas");
  const [somentePendentes, setSomentePendentes] = useState(true);
  const [selecionadoDiv, setSelecionadoDiv] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState(false);
  const [paginaDiv, setPaginaDiv] = useState(1);


  useEffect(() => {
    document.title = "Monitoramento de Processos | Juris Control";
  }, []);

  const { data: coordenacoes } = useQuery({
    queryKey: ["monitoramento-coordenacoes"],
    enabled: isAdminOrCoordinator,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: eventos,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "monitoramento-eventos",
      semRestricao ? "all" : processoIds.join(","),
      periodo,
      dataInicial,
      dataFinal,
      somenteNaoLidas ? "nao-lidas" : "todas",
    ],
    enabled: !escopoLoading,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      if (!semRestricao && processoIds.length === 0) return [] as Evento[];

      let q = supabase
        .from("acompanhamento_especial_eventos")
        .select(
          "id, processo_id, step_date, criado_em, conteudo, instancia, tribunal, anexos_count, lido_em, processo:processos(numero, polo_ativo, polo_passivo, coordenacao_id)"
        )
        .order("criado_em", { ascending: false })
        .limit(2000);

      // Filtro de não lidas aplicado no banco: garante que registros antigos
      // não lidos apareçam mesmo com "Todo o período" (evita corte pelo limite).
      if (somenteNaoLidas) q = q.is("lido_em", null);

      if (!dataInicial && !dataFinal && periodo !== "todos") {
        const desde = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte("criado_em", desde);
      }
      if (dataInicial) q = q.gte("criado_em", `${dataInicial}T00:00:00-03:00`);
      if (dataFinal) q = q.lte("criado_em", `${dataFinal}T23:59:59.999-03:00`);
      if (!semRestricao) q = q.in("processo_id", processoIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Evento[];
    },
  });

  const {
    data: divergencias,
    isLoading: isLoadingDiv,
    isFetching: isFetchingDiv,
    refetch: refetchDiv,
  } = useQuery({
    queryKey: [
      "monitoramento-divergencias",
      semRestricao ? "all" : processoIds.join(","),
      periodoDiv,
      dataInicialDiv,
      dataFinalDiv,
      somentePendentes ? "pendentes" : "todas",
    ],
    enabled: !escopoLoading,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      if (!semRestricao && processoIds.length === 0) return [] as Divergencia[];

      let q = supabase
        .from("acompanhamento_especial_divergencias")
        .select(
          "id, processo_id, campo, valor_atual, valor_judit, detectado_em, resolvido_em, processo:processos(numero, polo_ativo, polo_passivo, coordenacao_id)"
        )
        .order("detectado_em", { ascending: false })
        .limit(2000);

      if (somentePendentes) q = q.is("resolvido_em", null);

      if (!dataInicialDiv && !dataFinalDiv && periodoDiv !== "todos") {
        const desde = new Date(Date.now() - Number(periodoDiv) * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte("detectado_em", desde);
      }
      if (dataInicialDiv) q = q.gte("detectado_em", `${dataInicialDiv}T00:00:00-03:00`);
      if (dataFinalDiv) q = q.lte("detectado_em", `${dataFinalDiv}T23:59:59.999-03:00`);
      if (!semRestricao) q = q.in("processo_id", processoIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Divergencia[];
    },
  });


  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>();
    for (const ev of eventos ?? []) {
      const g = map.get(ev.processo_id) ?? {
        processoId: ev.processo_id,
        numero: ev.processo?.numero || "Processo sem número",
        parte: [ev.processo?.polo_ativo, ev.processo?.polo_passivo].filter(Boolean).join(" × "),
        coordenacaoId: ev.processo?.coordenacao_id ?? null,
        eventos: [],
        naoLidos: 0,
        ultima: null,
      };
      g.eventos.push(ev);
      if (!ev.lido_em) g.naoLidos += 1;
      const data = ev.step_date || ev.criado_em;
      if (data && (!g.ultima || data > g.ultima)) g.ultima = data;
      map.set(ev.processo_id, g);
    }

    const termo = busca.trim().toLowerCase();
    const somenteDigitos = termo.replace(/\D/g, "");

    return Array.from(map.values())
      .filter((g) => {
        if (somenteNaoLidas && g.naoLidos === 0) return false;
        if (coordenacaoId !== "todas" && g.coordenacaoId !== coordenacaoId) return false;
        if (!termo) return true;
        const numeroDigitos = g.numero.replace(/\D/g, "");
        return (
          g.numero.toLowerCase().includes(termo) ||
          g.parte.toLowerCase().includes(termo) ||
          (somenteDigitos.length >= 4 && numeroDigitos.includes(somenteDigitos))
        );
      })
      .sort((a, b) => {
        if (a.naoLidos !== b.naoLidos) return b.naoLidos - a.naoLidos;
        return (b.ultima ?? "").localeCompare(a.ultima ?? "");
      });
  }, [eventos, busca, somenteNaoLidas, coordenacaoId]);

  const grupoAtivo = useMemo(
    () => grupos.find((g) => g.processoId === selecionado) ?? null,
    [grupos, selecionado]
  );

  const totalNaoLidos = grupos.reduce((acc, g) => acc + g.naoLidos, 0);

  const totalPaginas = Math.max(1, Math.ceil(grupos.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const gruposPagina = useMemo(
    () => grupos.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [grupos, paginaAtual]
  );
  useEffect(() => {
    setPagina(1);
  }, [busca, periodo, dataInicial, dataFinal, coordenacaoId, somenteNaoLidas]);

  const marcarLidas = async (grupo: Grupo) => {
    const ids = grupo.eventos.filter((e) => !e.lido_em).map((e) => e.id);
    if (ids.length === 0) return;
    setMarcando(true);
    try {
      const { error } = await supabase
        .from("acompanhamento_especial_eventos")
        .update({ lido_em: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["monitoramento-eventos"] }),
        qc.invalidateQueries({ queryKey: ["monitoramento-counts"] }),
        qc.invalidateQueries({ queryKey: ["acomp-especial-novidades"] }),
      ]);
      toast.success(`${ids.length} movimentação(ões) marcada(s) como lida(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível marcar como lidas");
    } finally {
      setMarcando(false);
    }
  };

  // Marca TODAS as movimentações não lidas do escopo do usuário (ignora filtros de data)
  const marcarTodasLidas = async () => {
    setMarcando(true);
    try {
      const agora = new Date().toISOString();
      if (semRestricao) {
        const { error } = await supabase
          .from("acompanhamento_especial_eventos")
          .update({ lido_em: agora })
          .is("lido_em", null);
        if (error) throw error;
      } else {
        for (let i = 0; i < processoIds.length; i += 150) {
          const lote = processoIds.slice(i, i + 150);
          const { error } = await supabase
            .from("acompanhamento_especial_eventos")
            .update({ lido_em: agora })
            .is("lido_em", null)
            .in("processo_id", lote);
          if (error) throw error;
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["monitoramento-eventos"] }),
        qc.invalidateQueries({ queryKey: ["monitoramento-counts"] }),
        qc.invalidateQueries({ queryKey: ["acomp-especial-novidades"] }),
      ]);
      toast.success("Todas as movimentações foram marcadas como lidas");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível marcar todas como lidas");
    } finally {
      setMarcando(false);
    }
  };

  const gruposDiv = useMemo<GrupoDivergencia[]>(() => {
    const map = new Map<string, GrupoDivergencia>();
    for (const d of divergencias ?? []) {
      const g = map.get(d.processo_id) ?? {
        processoId: d.processo_id,
        numero: d.processo?.numero || "Processo sem número",
        parte: [d.processo?.polo_ativo, d.processo?.polo_passivo].filter(Boolean).join(" × "),
        coordenacaoId: d.processo?.coordenacao_id ?? null,
        divergencias: [],
        pendentes: 0,
        ultima: null,
      };
      g.divergencias.push(d);
      if (!d.resolvido_em) g.pendentes += 1;
      if (d.detectado_em && (!g.ultima || d.detectado_em > g.ultima)) g.ultima = d.detectado_em;
      map.set(d.processo_id, g);
    }

    const termo = buscaDiv.trim().toLowerCase();
    const somenteDigitos = termo.replace(/\D/g, "");

    return Array.from(map.values())
      .filter((g) => {
        if (somentePendentes && g.pendentes === 0) return false;
        if (coordenacaoIdDiv !== "todas" && g.coordenacaoId !== coordenacaoIdDiv) return false;
        if (!termo) return true;
        const numeroDigitos = g.numero.replace(/\D/g, "");
        return (
          g.numero.toLowerCase().includes(termo) ||
          g.parte.toLowerCase().includes(termo) ||
          (somenteDigitos.length >= 4 && numeroDigitos.includes(somenteDigitos))
        );
      })
      .sort((a, b) => {
        if (a.pendentes !== b.pendentes) return b.pendentes - a.pendentes;
        return (b.ultima ?? "").localeCompare(a.ultima ?? "");
      });
  }, [divergencias, buscaDiv, somentePendentes, coordenacaoIdDiv]);

  const grupoDivAtivo = useMemo(
    () => gruposDiv.find((g) => g.processoId === selecionadoDiv) ?? null,
    [gruposDiv, selecionadoDiv]
  );

  const totalPendentes = gruposDiv.reduce((acc, g) => acc + g.pendentes, 0);

  const totalPaginasDiv = Math.max(1, Math.ceil(gruposDiv.length / POR_PAGINA));
  const paginaAtualDiv = Math.min(paginaDiv, totalPaginasDiv);
  const gruposDivPagina = useMemo(
    () => gruposDiv.slice((paginaAtualDiv - 1) * POR_PAGINA, paginaAtualDiv * POR_PAGINA),
    [gruposDiv, paginaAtualDiv]
  );
  useEffect(() => {
    setPaginaDiv(1);
  }, [buscaDiv, periodoDiv, dataInicialDiv, dataFinalDiv, coordenacaoIdDiv, somentePendentes]);

  const marcarCiente = async (grupo: GrupoDivergencia) => {
    const ids = grupo.divergencias.filter((d) => !d.resolvido_em).map((d) => d.id);
    if (ids.length === 0) return;
    setResolvendo(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase
          .from("acompanhamento_especial_divergencias")
          .update({ resolvido_em: new Date().toISOString(), resolvido_por: userData.user?.id ?? null })
          .in("id", ids.slice(i, i + 200));
        if (error) throw error;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["monitoramento-divergencias"] }),
        qc.invalidateQueries({ queryKey: ["monitoramento-counts"] }),
        qc.invalidateQueries({ queryKey: ["acomp-especial-novidades"] }),
        qc.invalidateQueries({ queryKey: ["acomp-especial-divergencias"] }),
      ]);
      toast.success(`${ids.length} divergência(s) marcada(s) como ciente`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível marcar como ciente");
    } finally {
      setResolvendo(false);
    }
  };

  return (
    <MainLayout
      title="Monitoramento"
      subtitle="Movimentações encontradas nos processos em acompanhamento e divergências Judit"
      headerActions={(
        <Button
          variant="outline"
          size="sm"
          onClick={() => Promise.all([refetch(), refetchDiv()])}
          disabled={isFetching || isFetchingDiv}
        >
          {isFetching || isFetchingDiv ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </Button>
      )}
    >
    <div className="flex flex-col border border-border rounded-lg bg-background">
      <Tabs defaultValue="movimentacoes" className="flex flex-col">
        <div className="px-4 md:px-6 pt-3 border-b border-border bg-card">
          <TabsList>
            <TabsTrigger value="movimentacoes" className="gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Movimentações
              {countMov > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {countMov}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="divergencias" className="gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              Divergências Judit
              {countDiv > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {countDiv}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="movimentacoes" className="m-0 flex flex-col">
          {/* Filtros */}
          <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por número do processo ou parte…"
                className="pl-8 h-9"
              />
            </div>
             <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             <div className="flex items-center gap-1.5">
               <Label htmlFor="mov-data-inicial" className="text-xs whitespace-nowrap">De</Label>
               <Input
                 id="mov-data-inicial"
                 type="date"
                 value={dataInicial}
                 max={dataFinal || undefined}
                 onChange={(e) => {
                   setDataInicial(e.target.value);
                   if (e.target.value) setPeriodo("todos");
                 }}
                 className="h-9 w-[145px]"
               />
               <Label htmlFor="mov-data-final" className="text-xs whitespace-nowrap">Até</Label>
               <Input
                 id="mov-data-final"
                 type="date"
                 value={dataFinal}
                 min={dataInicial || undefined}
                 onChange={(e) => {
                   setDataFinal(e.target.value);
                   if (e.target.value) setPeriodo("todos");
                 }}
                 className="h-9 w-[145px]"
               />
             </div>
            {isAdminOrCoordinator && (
              <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações</SelectItem>
                  {(coordenacoes ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="nao-lidas"
                checked={somenteNaoLidas}
                onCheckedChange={setSomenteNaoLidas}
              />
              <Label htmlFor="nao-lidas" className="text-xs">
                Só não lidas
              </Label>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {grupos.length} processo(s) · {totalNaoLidos} não lida(s)
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={marcarTodasLidas}
                disabled={marcando || countMov === 0}
                title="Marca como lidas todas as movimentações do seu escopo, inclusive fora do período filtrado"
              >
                {marcando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Marcar todas como lidas
              </Button>
            </div>
          </div>

          {/* Lista + painel lateral */}
          <div className="flex flex-col lg:flex-row lg:items-start">
            <div
              className={cn(
                "border-b lg:border-b-0 lg:border-r border-border",
                grupoAtivo ? "lg:w-[38%]" : "w-full"
              )}
            >
              <div>
                <div className="p-3 md:p-4 space-y-2">
                  {isLoading || escopoLoading ? (
                    [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                  ) : grupos.length === 0 ? (
                    <div className="text-center py-16 text-sm text-muted-foreground">
                      <Radar className="w-8 h-8 mx-auto mb-3 text-amber-500/50" />
                      Nenhuma movimentação encontrada com os filtros atuais.
                    </div>
                  ) : (
                    gruposPagina.map((g) => (
                      <button
                        key={g.processoId}
                        onClick={() =>
                          setSelecionado((prev) => (prev === g.processoId ? null : g.processoId))
                        }
                        className={cn(
                          "w-full text-left rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors",
                          selecionado === g.processoId && "border-amber-500/70 bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm truncate">{g.numero}</p>
                            {g.parte && (
                              <p className="text-xs text-muted-foreground truncate">{g.parte}</p>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {g.eventos.length} movimentação(ões)
                              {g.ultima
                                ? ` · última em ${format(new Date(g.ultima), "dd/MM/yyyy", { locale: ptBR })}`
                                : ""}
                            </p>
                          </div>
                          {g.naoLidos > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              {g.naoLidos}
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Página {paginaAtual} de {totalPaginas} · {grupos.length} processo(s)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual <= 1}
                        onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual >= totalPaginas}
                        onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {grupoAtivo && (
              <div className="flex-1 flex flex-col bg-background animate-fade-in lg:sticky lg:top-4">
                <div className="px-4 py-3 border-b border-border flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm truncate">{grupoAtivo.numero}</p>
                    {grupoAtivo.parte && (
                      <p className="text-xs text-muted-foreground truncate">{grupoAtivo.parte}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/processos/${grupoAtivo.processoId}`}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Abrir processo
                    </Link>
                  </Button>
                  {grupoAtivo.naoLidos > 0 && (
                    <Button
                      size="sm"
                      onClick={() => marcarLidas(grupoAtivo)}
                      disabled={marcando}
                    >
                      {marcando ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Marcar como lidas
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setSelecionado(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="lg:max-h-[70vh] lg:overflow-y-auto">
                  <div className="p-4 space-y-3">
                    {grupoAtivo.eventos.map((ev) => (
                      <Card
                        key={ev.id}
                        className={cn(
                          "p-3 border-l-2",
                          ev.lido_em ? "border-l-border" : "border-l-amber-500"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span>
                            {ev.step_date
                              ? format(new Date(ev.step_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "—"}
                          </span>
                          {ev.tribunal && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {ev.tribunal}
                            </Badge>
                          )}
                          {ev.instancia && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {ev.instancia}
                            </Badge>
                          )}
                          {(ev.anexos_count ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {ev.anexos_count}
                            </span>
                          )}
                          {!ev.lido_em && (
                            <Badge variant="destructive" className="text-[10px] h-4">
                              Nova
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1.5 whitespace-pre-wrap">{ev.conteudo}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="divergencias" className="m-0 flex flex-col">
          {/* Filtros */}
          <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={buscaDiv}
                onChange={(e) => setBuscaDiv(e.target.value)}
                placeholder="Buscar por número do processo ou parte…"
                className="pl-8 h-9"
              />
            </div>
            <Select value={periodoDiv} onValueChange={setPeriodoDiv}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="div-data-inicial" className="text-xs whitespace-nowrap">De</Label>
              <Input
                id="div-data-inicial"
                type="date"
                value={dataInicialDiv}
                max={dataFinalDiv || undefined}
                onChange={(e) => {
                  setDataInicialDiv(e.target.value);
                  if (e.target.value) setPeriodoDiv("todos");
                }}
                className="h-9 w-[145px]"
              />
              <Label htmlFor="div-data-final" className="text-xs whitespace-nowrap">Até</Label>
              <Input
                id="div-data-final"
                type="date"
                value={dataFinalDiv}
                min={dataInicialDiv || undefined}
                onChange={(e) => {
                  setDataFinalDiv(e.target.value);
                  if (e.target.value) setPeriodoDiv("todos");
                }}
                className="h-9 w-[145px]"
              />
            </div>
            {isAdminOrCoordinator && (
              <Select value={coordenacaoIdDiv} onValueChange={setCoordenacaoIdDiv}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações</SelectItem>
                  {(coordenacoes ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="pendentes-div"
                checked={somentePendentes}
                onCheckedChange={setSomentePendentes}
              />
              <Label htmlFor="pendentes-div" className="text-xs">
                Só pendentes
              </Label>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {gruposDiv.length} processo(s) · {totalPendentes} pendente(s)
              </span>
            </div>
          </div>

          {/* Lista + painel lateral */}
          <div className="flex flex-col lg:flex-row lg:items-start">
            <div
              className={cn(
                "border-b lg:border-b-0 lg:border-r border-border",
                grupoDivAtivo ? "lg:w-[38%]" : "w-full"
              )}
            >
              <div>
                <div className="p-3 md:p-4 space-y-2">
                  {isLoadingDiv || escopoLoading ? (
                    [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                  ) : gruposDiv.length === 0 ? (
                    <div className="text-center py-16 text-sm text-muted-foreground">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500/50" />
                      Nenhuma divergência encontrada com os filtros atuais.
                    </div>
                  ) : (
                    gruposDivPagina.map((g) => (
                      <button
                        key={g.processoId}
                        onClick={() =>
                          setSelecionadoDiv((prev) => (prev === g.processoId ? null : g.processoId))
                        }
                        className={cn(
                          "w-full text-left rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors",
                          selecionadoDiv === g.processoId && "border-amber-500/70 bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm truncate">{g.numero}</p>
                            {g.parte && (
                              <p className="text-xs text-muted-foreground truncate">{g.parte}</p>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {g.divergencias.length} divergência(s)
                              {g.ultima
                                ? ` · última em ${format(new Date(g.ultima), "dd/MM/yyyy", { locale: ptBR })}`
                                : ""}
                            </p>
                          </div>
                          {g.pendentes > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                              {g.pendentes}
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {totalPaginasDiv > 1 && (
                  <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Página {paginaAtualDiv} de {totalPaginasDiv} · {gruposDiv.length} processo(s)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paginaAtualDiv <= 1}
                        onClick={() => setPaginaDiv((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paginaAtualDiv >= totalPaginasDiv}
                        onClick={() => setPaginaDiv((p) => Math.min(totalPaginasDiv, p + 1))}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {grupoDivAtivo && (
              <div className="flex-1 flex flex-col bg-background animate-fade-in lg:sticky lg:top-4">
                <div className="px-4 py-3 border-b border-border flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm truncate">{grupoDivAtivo.numero}</p>
                    {grupoDivAtivo.parte && (
                      <p className="text-xs text-muted-foreground truncate">{grupoDivAtivo.parte}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/processos/${grupoDivAtivo.processoId}`}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Abrir processo
                    </Link>
                  </Button>
                  {grupoDivAtivo.pendentes > 0 && (
                    <Button size="sm" onClick={() => marcarCiente(grupoDivAtivo)} disabled={resolvendo}>
                      {resolvendo ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Marcar como ciente
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setSelecionadoDiv(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="lg:max-h-[70vh] lg:overflow-y-auto">
                  <div className="p-4 space-y-3">
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Detectado</TableHead>
                            <TableHead>Campo</TableHead>
                            <TableHead>No formulário</TableHead>
                            <TableHead>Judit</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupoDivAtivo.divergencias.map((d) => (
                            <TableRow key={d.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {format(new Date(d.detectado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {LABEL_CAMPO[d.campo] ?? d.campo}
                              </TableCell>
                              <TableCell className="text-xs max-w-[220px] truncate" title={d.valor_atual ?? ""}>
                                {d.valor_atual || "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[220px] truncate text-emerald-700" title={d.valor_judit ?? ""}>
                                {d.valor_judit || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {!d.resolvido_em ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={resolvendo}
                                    onClick={() => marcarCiente({ ...grupoDivAtivo, divergencias: [d], pendentes: 1 })}
                                  >
                                    {resolvendo ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Check className="mr-1 h-3 w-3" /> Ciente
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">
                                    Ciente
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
    </MainLayout>
  );
}
