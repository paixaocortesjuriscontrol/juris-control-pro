import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink, FileText, History, ListChecks, Info, User, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ProcessoLateralResumo } from "@/components/processos/ProcessoLateralResumo";
import {
  TIPO_TEXTO,
  TIPO_LABELS,
  horaDoItem,
  datasDoItem,
} from "@/components/painel/DiaAgendaLateral";
import { TratadoCheck, isItemTratado, isItemRiscado } from "@/components/shared/TratadoCheck";
import { AtividadeBadge } from "@/components/comum/AtividadeBadge";
import { ComentarioBadge } from "@/components/comum/ComentarioBadge";
import { situacoesBase, type TipoSituacaoItem } from "@/constants/situacoesItem";
import { cn } from "@/lib/utils";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import {
  useItensComAtividades,
  useContagemAtividades,
  getItemRawId,
} from "@/hooks/useItensComAtividades";
import { useItensComComentarios, temComentarioItem } from "@/hooks/useItensComComentarios";
import { dataInicioAudiencia } from "@/utils/date";
import { expandirOcorrencias, janelaRecorrenciaPadrao } from "@/utils/recorrencia";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

const soData = (v?: string | null) => (v ? String(v).slice(0, 10) : null);

const fmtDataBr = (v?: string | null) => {
  const s = soData(v);
  if (!s) return "Sem data";
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
};

const tipoDaTarefa = (t: any): string => {
  const texto = String(t.tipo_tarefa ?? t.tipo_registro ?? "").toUpperCase().trim();
  // Atenção: não mapear "parcelamento" aqui — isso é uma tarefa, não evento-pai.
  if (texto.includes("PRAZO")) return "prazo";
  if (texto.includes("AUDI")) return "audiencia";
  if (texto.includes("EVENTO")) return "evento";
  return "tarefa";
};

/** Situação em texto legível (usa o catálogo oficial de situações do item). */
const labelSituacao = (tipo: string, valor?: string | null): string | null => {
  const v = String(valor ?? "").trim();
  if (!v) return null;
  const tipoBase: TipoSituacaoItem =
    tipo === "prazo" || tipo === "prazo_parcela"
      ? "prazo"
      : tipo === "audiencia"
        ? "audiencia"
        : tipo === "evento"
          ? "evento"
          : tipo === "parcelamento"
            ? "parcelamento"
            : "tarefa";
  const achado = situacoesBase(tipoBase).find((s) => s.value === v);
  return achado ? achado.label : v.replace(/_/g, " ");
};

const CONCLUIDOS = new Set(["cumprido", "concluido", "protocolado", "baixado", "tratado"]);

/**
 * Linha detalhada em largura total do painel lateral de Processos.
 * Mostra tipo, título, processo, responsável, situação, datas e observação.
 */
function ProcessoItemRow({
  item,
  userId,
  onSelect,
  temAtividade,
  temComentario,
  qtdAtividades,
}: {
  item: ItemAgendaUnificado;
  userId?: string;
  onSelect: (item: ItemAgendaUnificado) => void;
  temAtividade?: boolean;
  temComentario?: boolean;
  qtdAtividades?: number;
}) {
  const it = item as any;
  const concluido = isItemTratado(item);
  const riscado = isItemRiscado(item);
  const hora = horaDoItem(item);
  const datas = datasDoItem(item);
  const situacao = labelSituacao(String(item.tipo), item.status);
  const cancelado = ["cancelado", "cancelada", "cancelado_oculto"].includes(
    String(item.status ?? "").toLowerCase(),
  );
  const sou =
    !!userId &&
    (item.responsavel_id === userId ||
      item.criado_por === userId ||
      item.participantes?.some((p: any) => p.usuario_id === userId));
  const observacao = it.observacoes || item.descricao || null;
  const local = item.local || it.local_audiencia || it.link_local || null;
  const orgao = it.orgao || it.orgao_julgador || it.vara_camara || null;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex-shrink-0 pt-1">
        <TratadoCheck tratado={concluido} size={15} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-[10px] font-bold tracking-wide",
              TIPO_TEXTO[item.tipo] || "text-muted-foreground",
            )}
          >
            {TIPO_LABELS[item.tipo] || String(item.tipo_tarefa ?? item.tipo).toUpperCase()}
          </span>
          {situacao && (
            <Badge
              variant={
                cancelado
                  ? "destructive"
                  : CONCLUIDOS.has(String(item.status ?? "").toLowerCase())
                    ? "secondary"
                    : "outline"
              }
              className="h-4 px-1.5 text-[10px] font-normal"
            >
              {situacao}
            </Badge>
          )}
          {item.prioridade && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal capitalize">
              {String(item.prioridade)}
            </Badge>
          )}
          {temAtividade && <AtividadeBadge />}
          {temComentario && <ComentarioBadge />}
          {sou && (
            <span className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">
              Eu
            </span>
          )}
        </div>

        <p
          className={cn(
            "text-[15px] font-medium leading-snug text-foreground",
            riscado && "line-through",
            (concluido || cancelado) && "text-muted-foreground",
          )}
        >
          {item.titulo || TIPO_LABELS[item.tipo] || "Sem título"}
          {hora ? `: ${hora}` : ""}
        </p>

        {item.processo?.numero && (
          <p className="font-mono text-[11px] text-muted-foreground">{item.processo.numero}</p>
        )}
        {item.processo?.assunto && (
          <p className="text-[11px] leading-snug text-muted-foreground line-clamp-1">
            {item.processo.assunto}
          </p>
        )}

        {datas.length > 0 && (
          <p className="text-[12px] text-muted-foreground">{datas.join("  ·  ")}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {item.responsavel?.nome && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {item.responsavel.nome}
            </span>
          )}
          {(local || orgao) && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{local || orgao}</span>
            </span>
          )}
          {!!qtdAtividades && qtdAtividades > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {qtdAtividades} {qtdAtividades === 1 ? "atividade" : "atividades"}
            </span>
          )}
        </div>

        {observacao && (
          <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
            {observacao}
          </p>
        )}
      </div>
    </button>
  );
}

const GRUPOS: { chave: string; label: string; tipos: string[] }[] = [
  { chave: "prazo", label: "Prazos", tipos: ["prazo", "prazo_parcela"] },
  { chave: "audiencia", label: "Audiências", tipos: ["audiencia"] },
  { chave: "tarefa", label: "Tarefas", tipos: ["tarefa", "tarefa_delegada"] },
  { chave: "evento", label: "Eventos", tipos: ["evento", "parcelamento"] },
];


interface Props {
  processoId: string;
  processoNumero: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  /** Quando o cabeçalho já é exibido pelo contêiner (ex.: drawer sobreposto). */
  hideHeader?: boolean;
}

export function ProcessoItensLateral({
  processoId,
  processoNumero,
  onClose,
  onNavigate,
  hideHeader = false,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);
  const [aba, setAba] = useState("resumo");

  const { data: itens = [], isLoading } = useQuery<ItemAgendaUnificado[]>({
    queryKey: ["processo-itens-lateral-v3", processoId, processoNumero],
    staleTime: 60_000,
    queryFn: async () => {
      const [tarefasRes, eventosRes, audienciasRes, processoRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("*")
          .eq("processo_id", processoId),
        supabase
          .from("eventos_agenda")
          .select("*")
          .eq("processo_id", processoId),
        supabase
          .from("audiencias_detectadas")
          .select("*")
          .or(`processo_id.eq.${processoId},processo_numero.eq.${processoNumero}`),
        supabase.from("processos").select("id, numero, assunto").eq("id", processoId).maybeSingle(),
      ]);

      const proc: any = processoRes.data || null;
      const processo = { id: processoId, numero: proc?.numero || processoNumero, assunto: proc?.assunto ?? null };
      const lista: ItemAgendaUnificado[] = [];

      const { windowStart, windowEnd } = janelaRecorrenciaPadrao();

      for (const t of ((tarefasRes.data as any[]) || [])) {
        const base = {
          ...t,
          origem: "tarefa",
          tipo: tipoDaTarefa(t),
          titulo: t.titulo || t.tipo_tarefa || "Sem título",
          data_inicio: t.data_fatal || t.data_vencimento || t.data_prevista || t.created_at,
          processo,
        };
        if (!t.recorrencia_tipo) {
          lista.push({ ...base, id: String(t.id) } as ItemAgendaUnificado);
          continue;
        }
        // Tarefas recorrentes ficam em um único registro: expandir ocorrências
        // (inclui as futuras) igual à agenda unificada.
        const ocorrencias = expandirOcorrencias(
          base.data_inicio,
          {
            tipo: t.recorrencia_tipo,
            intervalo: t.recorrencia_intervalo,
            fim: t.recorrencia_fim,
          },
          windowStart,
          windowEnd
        );
        for (const occ of ocorrencias) {
          lista.push({
            ...base,
            id: `${t.id}::${occ.toISOString().slice(0, 10)}`,
            data_inicio: occ.toISOString(),
            recorrencia_pai_id: t.id,
          } as ItemAgendaUnificado);
        }
      }


      for (const e of ((eventosRes.data as any[]) || [])) {
        const base = {
          ...e,
          origem: "evento",
          tipo: e.tipo || "evento",
          titulo: e.titulo || e.tipo || "Evento",
          processo,
        };
        const isRecorrente = !!e.recorrencia_tipo && !e.grupo_parcelas;
        if (!isRecorrente) {
          lista.push({ ...base, id: String(e.id) } as ItemAgendaUnificado);
          continue;
        }
        const ocorrencias = expandirOcorrencias(
          e.data_inicio,
          {
            tipo: e.recorrencia_tipo,
            intervalo: e.recorrencia_intervalo,
            fim: e.recorrencia_fim,
            diasSemana: e.recorrencia_dias_semana,
          },
          windowStart,
          windowEnd
        );
        for (const occ of ocorrencias) {
          lista.push({
            ...base,
            id: `${e.id}::${occ.toISOString().slice(0, 10)}`,
            data_inicio: occ.toISOString(),
            recorrencia_pai_id: e.id,
          } as ItemAgendaUnificado);
        }
      }

      for (const a of ((audienciasRes.data as any[]) || [])) {
        lista.push({
          ...a,
          id: `audiencia-det-${a.id}`,
          origem: "evento",
          tipo: "audiencia",
          titulo: a.titulo || a.tipo_audiencia || "Audiência",
          data_inicio: dataInicioAudiencia(a.data_audiencia, a) ?? a.data_audiencia,
          hora_prevista: a.hora ?? null,
          local: a.local_audiencia || a.vara_camara || null,
          processo,
        } as ItemAgendaUnificado);
      }

      // Nomes dos responsáveis em um único lote (o select "*" não traz o join).
      const ids = [
        ...new Set(
          lista
            .map((i: any) => i.responsavel_id || i.responsavel_tst_id || null)
            .filter(Boolean) as string[],
        ),
      ];
      if (ids.length) {
        const { data: perfis } = await (supabase as any)
          .from("profiles_basic")
          .select("id, nome")
          .in("id", ids);
        const mapa = new Map<string, string>(
          ((perfis as any[]) || []).map((p) => [p.id, p.nome]),
        );
        for (const i of lista as any[]) {
          const rid = i.responsavel_id || i.responsavel_tst_id;
          if (rid && mapa.has(rid)) i.responsavel = { id: rid, nome: mapa.get(rid)! };
        }
      }

      // Do mais novo para o mais antigo (itens sem data no final)
      return lista.sort((x, y) => {
        const dx = soData(x.data_inicio);
        const dy = soData(y.data_inicio);
        if (!dx && !dy) return 0;
        if (!dx) return 1;
        if (!dy) return -1;
        return dy.localeCompare(dx);
      });

    },
    enabled: !!processoId,
  });

  const { data: itensComAtividades = new Set<string>() } = useItensComAtividades(itens);
  const { data: itensComComentarios = new Set<string>() } = useItensComComentarios(itens);
  const { data: contagemAtividades = {} } = useContagemAtividades(itens.map((i) => i.id));

  // Movimentações: carregadas apenas quando a aba é aberta.
  const { data: movimentacoes = [], isLoading: loadingMov } = useQuery({
    queryKey: ["processo-lateral-movimentacoes", processoId],
    enabled: !!processoId && aba === "movimentacoes",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, data_movimentacao, descricao, fonte, tipo")
        .eq("processo_id", processoId)
        .order("data_movimentacao", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const grupos = useMemo(
    () =>
      GRUPOS.map((g) => ({
        ...g,
        itens: itens.filter((i) => g.tipos.includes(String((i as any).tipo || "tarefa"))),
      })).filter((g) => g.itens.length > 0),
    [itens]
  );

  const totalAtividades = useMemo(
    () => Object.values(contagemAtividades as Record<string, number>).reduce((a, b) => a + b, 0),
    [contagemAtividades]
  );

  if (selectedItem) {
    return (
      <EdicaoItemPanel
        key={selectedItem.id}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["processo-itens-lateral-v3", processoId] });
        }}
      />
    );
  }

  const renderItem = (item: ItemAgendaUnificado) => {
    const rawId = getItemRawId(item.id);
    const qtdAtividades = (contagemAtividades as Record<string, number>)[rawId] || 0;
    return (
      <ProcessoItemRow
        key={item.id}
        item={item}
        userId={user?.id}
        onSelect={setSelectedItem}
        temAtividade={itensComAtividades.has(rawId)}
        temComentario={temComentarioItem(itensComComentarios, item)}
        qtdAtividades={qtdAtividades}
      />
    );
  };


  return (
    <div className="flex flex-col h-full min-h-0">
      {!hideHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate font-mono">{processoNumero}</p>
            <p className="text-[11px] text-muted-foreground">
              {isLoading ? "Carregando..." : `${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            title="Abrir processo"
            onClick={() => onNavigate(processoId)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <TabsList className="h-8">
            <TabsTrigger value="resumo" className="h-6 gap-1.5 text-xs">
              <Info className="h-3.5 w-3.5" /> Resumo
            </TabsTrigger>
            <TabsTrigger value="itens" className="h-6 gap-1.5 text-xs">
              <ListChecks className="h-3.5 w-3.5" /> Tarefas e atividades
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {itens.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="movimentacoes" className="h-6 gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" /> Movimentações
            </TabsTrigger>
          </TabsList>
          {hideHeader && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={() => onNavigate(processoId)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir processo
            </Button>
          )}
        </div>

        <TabsContent value="resumo" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
            <ProcessoLateralResumo processoId={processoId} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="itens" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
            {isLoading && (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!isLoading && itens.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">
                Nenhuma audiência, prazo, tarefa ou evento vinculado.
              </p>
            )}
            {!isLoading && itens.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
                  {grupos.map((g) => (
                    <Badge key={g.chave} variant="outline" className="text-[11px]">
                      {g.label}: {g.itens.length}
                    </Badge>
                  ))}
                  {totalAtividades > 0 && (
                    <Badge variant="secondary" className="text-[11px]">
                      Atividades: {totalAtividades}
                    </Badge>
                  )}
                </div>
                {grupos.map((g) => (
                  <section key={g.chave}>
                    <header className="sticky top-0 z-10 flex items-center gap-2 border-y border-border bg-muted/60 px-3 py-1.5 backdrop-blur">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">({g.itens.length})</span>
                    </header>
                    <div className="divide-y divide-border">{g.itens.map(renderItem)}</div>
                  </section>
                ))}
              </>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="movimentacoes" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
            {loadingMov ? (
              <div className="space-y-2 p-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : movimentacoes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada.</p>
              </div>
            ) : (
              <ol className="space-y-0 p-3">
                {movimentacoes.map((mov: any) => (
                  <li key={mov.id} className="border-l-2 border-primary/30 pl-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {fmtDataBr(mov.data_movimentacao)}
                      </span>
                      {mov.fonte && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                          {mov.fonte}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[13px] leading-snug text-foreground whitespace-pre-wrap break-words">
                      {mov.descricao}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
