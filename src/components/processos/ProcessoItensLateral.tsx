import { useQuery } from "@tanstack/react-query";
import { X, Gavel, ClipboardList, CalendarDays, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProcessoResumoInline } from "@/components/processos/ProcessoResumoInline";

type TipoItem = "audiencia" | "prazo" | "tarefa" | "evento";

interface ItemLateral {
  id: string;
  tipo: TipoItem;
  titulo: string;
  data: string | null;
  hora: string | null;
  status: string | null;
  detalhe: string | null;
}

const TIPO_LABEL: Record<TipoItem, string> = {
  audiencia: "AUDIÊNCIA",
  prazo: "PRAZO",
  tarefa: "TAREFA",
  evento: "EVENTO",
};

const TIPO_COR: Record<TipoItem, string> = {
  audiencia: "text-yellow-600 dark:text-yellow-400",
  prazo: "text-red-600 dark:text-red-400",
  tarefa: "text-blue-600 dark:text-blue-400",
  evento: "text-green-600 dark:text-green-400",
};

const TIPO_ICONE: Record<TipoItem, typeof Gavel> = {
  audiencia: Gavel,
  prazo: Clock,
  tarefa: ClipboardList,
  evento: CalendarDays,
};

const soData = (v?: string | null) => (v ? String(v).slice(0, 10) : null);

const fmtData = (v?: string | null) => {
  const s = soData(v);
  if (!s) return "Sem data";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

const fmtHora = (v?: string | null) => {
  const s = String(v ?? "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) && s !== "00:00" ? s : null;
};

interface Props {
  processoId: string;
  processoNumero: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function ProcessoItensLateral({ processoId, processoNumero, onClose, onNavigate }: Props) {
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["processo-itens-lateral", processoId, processoNumero],
    staleTime: 60_000,
    queryFn: async () => {
      const [tarefasRes, eventosRes, audienciasRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("id, titulo, tipo_tarefa, tipo_registro, status, data_fatal, data_vencimento, data_prevista, hora_prevista, hora_fatal, descricao, created_at")
          .eq("processo_id", processoId),
        supabase
          .from("eventos_agenda")
          .select("id, titulo, tipo, status, data_inicio, dia_inteiro, local, descricao, created_at")
          .eq("processo_id", processoId),
        supabase
          .from("audiencias_detectadas")
          .select("id, titulo, tipo_audiencia, status, data_audiencia, hora, local_audiencia, vara_camara, created_at")
          .or(`processo_id.eq.${processoId},processo_numero.eq.${processoNumero}`),
      ]);

      const lista: ItemLateral[] = [];

      for (const t of ((tarefasRes.data as any[]) || [])) {
        const tipoTexto = String(t.tipo_tarefa ?? t.tipo_registro ?? "").toUpperCase();
        const tipo: TipoItem = tipoTexto.includes("PRAZO") ? "prazo" : "tarefa";
        lista.push({
          id: `tarefa-${t.id}`,
          tipo,
          titulo: t.titulo || t.tipo_tarefa || "Sem título",
          data: soData(t.data_fatal || t.data_vencimento || t.data_prevista || t.created_at),
          hora: fmtHora(t.hora_fatal || t.hora_prevista),
          status: t.status ?? null,
          detalhe: t.descricao ?? null,
        });
      }

      for (const e of ((eventosRes.data as any[]) || [])) {
        lista.push({
          id: `evento-${e.id}`,
          tipo: "evento",
          titulo: e.titulo || e.tipo || "Evento",
          data: soData(e.data_inicio),
          hora: e.dia_inteiro ? null : fmtHora(String(e.data_inicio ?? "").slice(11, 16)),
          status: e.status ?? null,
          detalhe: e.local || e.descricao || null,
        });
      }

      for (const a of ((audienciasRes.data as any[]) || [])) {
        lista.push({
          id: `audiencia-${a.id}`,
          tipo: "audiencia",
          titulo: a.titulo || a.tipo_audiencia || "Audiência",
          data: soData(a.data_audiencia),
          hora: fmtHora(a.hora),
          status: a.status ?? null,
          detalhe: a.local_audiencia || a.vara_camara || null,
        });
      }

      // Do mais novo para o mais antigo (itens sem data no final)
      return lista.sort((x, y) => {
        if (!x.data && !y.data) return 0;
        if (!x.data) return 1;
        if (!y.data) return -1;
        return y.data.localeCompare(x.data);
      });
    },
    enabled: !!processoId,
  });

  return (
    <div className="flex flex-col h-full min-h-0">
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

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground mb-1">Resumo do processo</p>
          <ProcessoResumoInline processoId={processoId} defaultOpen />
        </div>

        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-4 space-y-2">
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
          {!isLoading &&
            itens.map((item) => {
              const Icone = TIPO_ICONE[item.tipo];
              return (
                <div key={item.id} className="px-4 py-3 flex gap-3">
                  <Icone className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", TIPO_COR[item.tipo])} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[10px] font-bold tracking-wide", TIPO_COR[item.tipo])}>
                      {TIPO_LABEL[item.tipo]}
                    </p>
                    <p className="text-sm text-foreground leading-snug break-words">
                      {item.titulo}
                      {item.hora ? `: ${item.hora}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {fmtData(item.data)}
                      {item.status ? ` · ${String(item.status).replace(/_/g, " ")}` : ""}
                    </p>
                    {item.detalhe && (
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                        {item.detalhe}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
