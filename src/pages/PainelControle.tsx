import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  startOfDay,
  differenceInDays,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Gavel,
  Bell,
  FileText,
  X,
  ExternalLink,
  Users,
  Tag,
  MapPin,
  CalendarCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useAgendaUnificada,
  ItemAgendaUnificado,
} from "@/hooks/useAgendaUnificada";
import { toZonedTime } from "date-fns-tz";
import { useNavigate } from "react-router-dom";

const TIME_ZONE = "America/Sao_Paulo";

type TabMode = "pessoal" | "escritorio";

// Cores dos tipos
const TIPO_CORES: Record<string, string> = {
  evento: "bg-blue-500",
  tarefa: "bg-amber-500",
  tarefa_delegada: "bg-orange-500",
  prazo: "bg-red-500",
  audiencia: "bg-purple-500",
  prazo_parcela: "bg-emerald-500",
  parcelamento: "bg-teal-500",
};

const TIPO_LABELS: Record<string, string> = {
  evento: "Evento",
  tarefa: "Tarefa",
  tarefa_delegada: "Delegada",
  prazo: "Prazo",
  audiencia: "Audiência",
  prazo_parcela: "Parcela",
  parcelamento: "Parcelamento",
};

const diasDaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function PainelControle() {
  const { user } = useAuth();
  const { isAdminOrCoordinator } = useUserRole();
  const navigate = useNavigate();
  const [tabMode, setTabMode] = useState<TabMode>("pessoal");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);

  const nowBrt = toZonedTime(new Date(), TIME_ZONE);
  const hoje = startOfDay(nowBrt);

  // Filtros conforme aba selecionada
  const filters = useMemo(() => {
    if (tabMode === "pessoal") {
      return {
        responsavelIds: user?.id ? [user.id] : undefined,
        fetchAll: false,
      };
    }
    // escritório: tudo
    return { fetchAll: true };
  }, [tabMode, user?.id]);

  const { data: itensAgenda = [], isLoading } = useAgendaUnificada(filters);

  // ===== CARDS DE RESUMO =====
  const hoje_inicio = startOfDay(nowBrt);
  const hoje_fim = new Date(hoje_inicio.getTime() + 86400000 - 1);

  const resumo = useMemo(() => {
    const tarefas = itensAgenda.filter((i) =>
      ["tarefa", "tarefa_delegada", "prazo"].includes(i.tipo)
    );
    const audiencias = itensAgenda.filter((i) => i.tipo === "audiencia");
    const compromissos = itensAgenda.filter((i) =>
      ["evento", "prazo_parcela", "parcelamento"].includes(i.tipo)
    );

    const agora = nowBrt;

    const calcStats = (items: ItemAgendaUnificado[]) => {
      const atrasadas = items.filter((i) => i.is_atrasado && i.status !== "cumprido" && i.status !== "concluido").length;
      const hoje_count = items.filter((i) => {
        const d = parseISO(i.data_inicio);
        return isToday(d) && i.status !== "cumprido" && i.status !== "concluido";
      }).length;
      const futuras = items.filter((i) => {
        const d = parseISO(i.data_inicio);
        return differenceInDays(startOfDay(d), hoje) > 0 && i.status !== "cumprido" && i.status !== "concluido";
      }).length;
      return { atrasadas, hoje: hoje_count, futuras, total: items.length };
    };

    // Andamentos / publicações DJEN — mock: buscaremos da query de notificações
    return {
      tarefas: calcStats(tarefas),
      audiencias: calcStats(audiencias),
      compromissos: calcStats(compromissos),
    };
  }, [itensAgenda, nowBrt, hoje]);

  // Intimações não lidas
  const { data: intimacoesPendentes = 0 } = useQuery({
    queryKey: ["painel-controle-intimacoes", tabMode, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("intimacoes_detectadas")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      if (tabMode === "pessoal" && user?.id) {
        q = q.eq("processo_id", user.id); // melhorar se tiver campo responsável
      }
      const { count } = await q;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Publicações DJEN não lidas
  const { data: andamentosNaoLidos = 0 } = useQuery({
    queryKey: ["painel-controle-andamentos", tabMode, user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("publicacoes_djen")
        .select("id", { count: "exact", head: true })
        .eq("lida", false);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // ===== CALENDÁRIO MENSAL =====
  const diasDoCalendario = useMemo(() => {
    const inicioMes = startOfMonth(mesAtual);
    const fimMes = endOfMonth(mesAtual);
    const inicioCal = startOfWeek(inicioMes, { weekStartsOn: 0 });
    const fimCal = endOfWeek(fimMes, { weekStartsOn: 0 });

    const dias: Date[] = [];
    let d = inicioCal;
    while (d <= fimCal) {
      dias.push(d);
      d = addDays(d, 1);
    }
    return dias;
  }, [mesAtual]);

  // Mapa de itens por dia (chave: "YYYY-MM-DD")
  const itensPorDia = useMemo(() => {
    const map = new Map<string, ItemAgendaUnificado[]>();
    itensAgenda.forEach((item) => {
      const key = item.data_inicio.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [itensAgenda]);

  const handleDayClick = (dia: Date) => {
    // Apenas para visualização — se quiser navegar para agenda filtrada
  };

  const handleItemClick = (item: ItemAgendaUnificado) => {
    setSelectedItem(item);
  };

  const navMes = (delta: number) => {
    setMesAtual((prev) => (delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1)));
  };

  // ===== CARD SUMÁRIO =====
  const SummaryCard = ({
    label,
    total,
    stats,
    ringClass,
  }: {
    label: string;
    total: number;
    stats: { label: string; value: number; highlight?: boolean }[];
    ringClass: string;
  }) => (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg px-5 py-4 flex-1 min-w-0">
      <div
        className={cn(
          "w-14 h-14 rounded-full border-4 flex items-center justify-center text-2xl font-bold flex-shrink-0",
          ringClass
        )}
      >
        {total}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="space-y-0.5">
          {stats.map((s) => (
            <p
              key={s.label}
              className={cn(
                "text-xs",
                s.highlight && s.value > 0
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {s.value} {s.label}
            </p>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout title="Painel de Controle">
      <div className="flex flex-col -m-4 md:-m-6" style={{ height: "calc(100vh - 64px)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-card border-b border-border flex-shrink-0">
          <h1 className="text-xl font-bold text-foreground">Painel de Controle</h1>
          <div className="flex gap-1 ml-2">
            <Button
              size="sm"
              variant={tabMode === "pessoal" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setTabMode("pessoal")}
            >
              Pessoal
            </Button>
            <Button
              size="sm"
              variant={tabMode === "escritorio" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setTabMode("escritorio")}
            >
              Escritório
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-border bg-card">
          {isLoading ? (
            <div className="flex gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 flex-1 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {/* Data Atual */}
              <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-lg px-4 py-3 flex-shrink-0">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                    {format(nowBrt, "MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-4xl font-bold leading-none">
                    {format(nowBrt, "dd")}
                  </p>
                  <p className="text-xs opacity-80 capitalize">
                    {format(nowBrt, "EEEE", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <SummaryCard
                label="Tarefas"
                total={resumo.tarefas.total}
                ringClass="border-amber-400/40 bg-amber-400/10 text-amber-600"
                stats={[
                  { label: "atrasadas", value: resumo.tarefas.atrasadas, highlight: true },
                  { label: "hoje", value: resumo.tarefas.hoje },
                  { label: "futuras", value: resumo.tarefas.futuras },
                ]}
              />

              <SummaryCard
                label="Intimações"
                total={intimacoesPendentes}
                ringClass="border-blue-400/40 bg-blue-400/10 text-blue-600"
                stats={[
                  { label: "pendentes", value: intimacoesPendentes, highlight: true },
                ]}
              />

              <SummaryCard
                label="Andamentos"
                total={andamentosNaoLidos}
                ringClass="border-primary/30 bg-primary/10 text-primary"
                stats={[
                  { label: "não lidos", value: andamentosNaoLidos, highlight: true },
                  { label: "lidos", value: 0 },
                ]}
              />

              <SummaryCard
                label="Audiências"
                total={resumo.audiencias.total}
                ringClass="border-purple-400/40 bg-purple-400/10 text-purple-600"
                stats={[
                  { label: "atrasadas", value: resumo.audiencias.atrasadas, highlight: true },
                  { label: "hoje", value: resumo.audiencias.hoje },
                  { label: "futuras", value: resumo.audiencias.futuras },
                ]}
              />

              <SummaryCard
                label="Compromissos"
                total={resumo.compromissos.total}
                ringClass="border-emerald-400/40 bg-emerald-400/10 text-emerald-600"
                stats={[
                  { label: "atrasados", value: resumo.compromissos.atrasadas, highlight: true },
                  { label: "hoje", value: resumo.compromissos.hoje },
                  { label: "futuros", value: resumo.compromissos.futuras },
                ]}
              />
            </div>
          )}
        </div>

        {/* Corpo principal: calendário + painel detalhe */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Calendário Mensal */}
          <div
            className={cn(
              "flex flex-col border-r border-border bg-card transition-all duration-300",
              selectedItem ? "w-[55%]" : "flex-1"
            )}
          >
            {/* Cabeçalho calendário */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base font-bold text-foreground flex-1">Agenda</h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navMes(-1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-semibold"
                  onClick={() => setMesAtual(new Date())}
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navMes(1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <span className="text-sm font-semibold text-foreground capitalize min-w-[140px] text-center">
                {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>

            {/* Grade do calendário */}
            <div className="flex-1 overflow-auto">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 border-b border-border">
                {diasDaSemana.map((d) => (
                  <div
                    key={d}
                    className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Semanas */}
              {Array.from({ length: Math.ceil(diasDoCalendario.length / 7) }).map(
                (_, semanaIdx) => (
                  <div
                    key={semanaIdx}
                    className="grid grid-cols-7 border-b border-border last:border-b-0"
                    style={{ minHeight: "80px" }}
                  >
                    {diasDoCalendario
                      .slice(semanaIdx * 7, semanaIdx * 7 + 7)
                      .map((dia, i) => {
                        const key = format(dia, "yyyy-MM-dd");
                        const itens = itensPorDia.get(key) || [];
                        const ehHoje = isToday(dia);
                        const ehMesAtual = isSameMonth(dia, mesAtual);
                        const MAX_VISIBLE = selectedItem ? 2 : 3;
                        const visiveis = itens.slice(0, MAX_VISIBLE);
                        const extras = itens.length - MAX_VISIBLE;

                        return (
                          <div
                            key={i}
                            className={cn(
                              "border-r border-border last:border-r-0 p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                              !ehMesAtual && "bg-muted/10",
                              ehHoje && "bg-primary/5"
                            )}
                            onClick={() => handleDayClick(dia)}
                          >
                            {/* Número do dia */}
                            <div className="flex justify-start mb-1">
                              <span
                                className={cn(
                                  "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                                  ehHoje
                                    ? "bg-primary text-primary-foreground font-bold"
                                    : ehMesAtual
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                )}
                              >
                                {format(dia, "d")}
                              </span>
                            </div>

                            {/* Itens do dia */}
                            <div className="space-y-0.5">
                              {visiveis.map((item) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-pointer text-white font-medium flex items-center gap-1",
                                    TIPO_CORES[item.tipo] || "bg-muted"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleItemClick(item);
                                  }}
                                  title={item.titulo}
                                >
                                  {item.status === "cumprido" ||
                                  item.status === "concluido" ? (
                                    <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0 opacity-90" />
                                  ) : (
                                    <FileText className="w-2.5 h-2.5 flex-shrink-0 opacity-90" />
                                  )}
                                  <span className="truncate">
                                    {item.titulo || TIPO_LABELS[item.tipo]}
                                  </span>
                                </div>
                              ))}
                              {extras > 0 && (
                                <div className="text-[10px] text-muted-foreground px-1">
                                  +{extras} mais
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Painel de detalhes */}
          {selectedItem && (
            <div className="w-[45%] flex flex-col border-l border-border bg-card overflow-hidden">
              {/* Header do painel */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm text-foreground truncate">
                    {selectedItem.identificador_projuris ||
                      (selectedItem.origem === "tarefa" ? "TAR" : "EVT") +
                        "." +
                        selectedItem.id.slice(0, 7).toUpperCase()}
                  </span>
                  <Badge
                    variant={
                      selectedItem.status === "cumprido" || selectedItem.status === "concluido"
                        ? "default"
                        : selectedItem.is_atrasado
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {selectedItem.status === "cumprido" || selectedItem.status === "concluido"
                      ? "Concluída"
                      : selectedItem.is_atrasado
                      ? "Atrasada"
                      : "Pendente"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => setSelectedItem(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Conteúdo do painel */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Processo vinculado */}
                  {selectedItem.processo && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-semibold">
                        Processo vinculado
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-primary hover:underline font-medium"
                          onClick={() =>
                            navigate(`/processos/${selectedItem.processo_id}`)
                          }
                        >
                          {selectedItem.processo.numero}
                        </button>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  )}

                  {/* Tipo e Título */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5 font-semibold">
                        Tipo
                      </p>
                      <p className="text-sm text-foreground">
                        {selectedItem.tipo_tarefa ||
                          TIPO_LABELS[selectedItem.tipo] ||
                          "Não informado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5 font-semibold">
                        Título
                      </p>
                      <p className="text-sm text-foreground">
                        {selectedItem.titulo || "Não informado"}
                      </p>
                    </div>
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5 font-semibold">
                        Data de vencimento
                      </p>
                      <p className="text-sm text-foreground">
                        {selectedItem.data_vencimento
                          ? format(parseISO(selectedItem.data_vencimento), "dd/MM/yyyy")
                          : selectedItem.data_inicio
                          ? format(parseISO(selectedItem.data_inicio), "dd/MM/yyyy")
                          : "Não informado"}
                      </p>
                    </div>
                    {selectedItem.data_fatal && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5 font-semibold">
                          Data Fatal
                        </p>
                        <p className="text-sm text-foreground">
                          {format(parseISO(selectedItem.data_fatal), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                    {selectedItem.concluido_em && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5 font-semibold">
                          Data de conclusão
                        </p>
                        <p className="text-sm text-foreground">
                          {format(parseISO(selectedItem.concluido_em), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Responsável */}
                  {selectedItem.responsavel && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3" /> Responsável
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold flex-shrink-0">
                          {selectedItem.responsavel.nome
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground">
                          {selectedItem.responsavel.nome}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Partes */}
                  {(selectedItem.partes_ativas || selectedItem.partes_passivas) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-semibold">
                        Envolvidos
                      </p>
                      {selectedItem.partes_ativas && (
                        <div className="text-xs bg-muted border border-border rounded px-2 py-1 mb-1">
                          <span className="text-muted-foreground">Ativo: </span>
                          <span className="text-foreground">{selectedItem.partes_ativas}</span>
                        </div>
                      )}
                      {selectedItem.partes_passivas && (
                        <div className="text-xs bg-muted border border-border rounded px-2 py-1">
                          <span className="text-muted-foreground">Passivo: </span>
                          <span className="text-foreground">{selectedItem.partes_passivas}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Local */}
                  {selectedItem.local && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5 font-semibold flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Local
                      </p>
                      <p className="text-sm text-foreground">{selectedItem.local}</p>
                    </div>
                  )}

                  {/* Marcadores */}
                  {selectedItem.marcadores && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5 font-semibold flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Marcadores
                      </p>
                      <p className="text-sm text-foreground">{selectedItem.marcadores}</p>
                    </div>
                  )}

                  {/* Descrição */}
                  {selectedItem.descricao && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5 font-semibold">
                        Descrição
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                        {selectedItem.descricao}
                      </p>
                    </div>
                  )}

                  {/* Botão para ver na agenda */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => navigate("/minha-agenda")}
                    >
                      <CalendarDays className="w-3 h-3 mr-1" />
                      Ver na Agenda completa
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
