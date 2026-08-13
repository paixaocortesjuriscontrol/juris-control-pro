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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { AcompanhamentoEspecialDivergencias } from "@/components/djen/AcompanhamentoEspecialDivergencias";

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


export default function Monitoramento() {
  const qc = useQueryClient();
  const { isAdmin, isAdminOrCoordinator } = useUserRole();
  const { processoIds, semRestricao, isLoading: escopoLoading } = useEscopoAcompanhamentoEspecial();
  const { movimentacoes: countMov, divergencias: countDiv } = useMonitoramentoCounts();

  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("30");
  const [coordenacaoId, setCoordenacaoId] = useState("todas");
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);

  const [buscaDiv, setBuscaDiv] = useState("");
  const [periodoDiv, setPeriodoDiv] = useState("30");
  const [coordenacaoIdDiv, setCoordenacaoIdDiv] = useState("todas");
  const [somentePendentes, setSomentePendentes] = useState(true);
  const [selecionadoDiv, setSelecionadoDiv] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState(false);


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
        .order("step_date", { ascending: false })
        .limit(1000);

      if (periodo !== "todos") {
        const desde = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte("criado_em", desde);
      }
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
        .limit(1000);

      if (periodoDiv !== "todos") {
        const desde = new Date(Date.now() - Number(periodoDiv) * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte("detectado_em", desde);
      }
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

    <div className="flex flex-col h-full">
      <header className="px-4 md:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Radar className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold">Monitoramento</h1>
              <p className="text-xs text-muted-foreground">
                Movimentações encontradas nos processos em acompanhamento e divergências Judit
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </header>

      <Tabs defaultValue="movimentacoes" className="flex-1 flex flex-col min-h-0">
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

        <TabsContent value="movimentacoes" className="flex-1 min-h-0 m-0 flex flex-col">
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
            </div>
          </div>

          {/* Lista + painel lateral */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            <div
              className={cn(
                "min-h-0 border-b lg:border-b-0 lg:border-r border-border transition-all duration-300",
                grupoAtivo ? "lg:w-[38%]" : "w-full"
              )}
            >
              <ScrollArea className="h-[40vh] lg:h-full">
                <div className="p-3 md:p-4 space-y-2">
                  {isLoading || escopoLoading ? (
                    [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                  ) : grupos.length === 0 ? (
                    <div className="text-center py-16 text-sm text-muted-foreground">
                      <Radar className="w-8 h-8 mx-auto mb-3 text-amber-500/50" />
                      Nenhuma movimentação encontrada com os filtros atuais.
                    </div>
                  ) : (
                    grupos.map((g) => (
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
              </ScrollArea>
            </div>

            {grupoAtivo && (
              <div className="flex-1 min-h-0 flex flex-col bg-background animate-fade-in">
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

                <ScrollArea className="flex-1">
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
                </ScrollArea>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="divergencias" className="flex-1 min-h-0 m-0 overflow-y-auto p-4 md:p-6">
          <AcompanhamentoEspecialDivergencias />
        </TabsContent>
      </Tabs>
    </div>
  );
}
