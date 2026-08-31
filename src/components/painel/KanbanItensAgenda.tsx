import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { isItemTratado } from "@/components/shared/TratadoCheck";
import { AtividadeBadge } from "@/components/comum/AtividadeBadge";
import { useItensComAtividades, getItemRawId } from "@/hooks/useItensComAtividades";
import { WorkflowBadge } from "@/components/comum/WorkflowBadge";
import { ComentarioBadge } from "@/components/comum/ComentarioBadge";
import { useItensDeWorkflow } from "@/hooks/useItensDeWorkflow";
import { useItensComComentarios } from "@/hooks/useItensComComentarios";
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface KanbanItensAgendaProps {
  itens: ItemAgendaUnificado[];
  onItemClick: (item: ItemAgendaUnificado) => void;
  emptyLabel?: string;
}

type ColunaKey = "vencidos" | "hoje" | "proximos" | "futuro" | "concluidos";

const COLUNAS: Array<{
  key: ColunaKey;
  label: string;
  color: string;
  ring: string;
  icon: typeof AlertTriangle;
}> = [
  { key: "vencidos",   label: "Vencidos",   color: "bg-red-50 dark:bg-red-950/30",       ring: "border-red-300 dark:border-red-800",       icon: AlertTriangle },
  { key: "hoje",       label: "Hoje",       color: "bg-amber-50 dark:bg-amber-950/30",   ring: "border-amber-300 dark:border-amber-800",   icon: Clock },
  { key: "proximos",   label: "Próx. 7 dias", color: "bg-blue-50 dark:bg-blue-950/30",   ring: "border-blue-300 dark:border-blue-800",     icon: CalendarClock },
  { key: "futuro",     label: "Futuro / Sem data", color: "bg-slate-50 dark:bg-slate-900/40", ring: "border-slate-300 dark:border-slate-700", icon: CalendarDays },
  { key: "concluidos", label: "Concluídos", color: "bg-emerald-50 dark:bg-emerald-950/30", ring: "border-emerald-300 dark:border-emerald-800", icon: CheckCircle2 },
];

function getRefDate(item: ItemAgendaUnificado): Date | null {
  const raw = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
  if (!raw) return null;
  const d = parseISO(raw);
  return isValid(d) ? d : null;
}

function classifyItem(item: ItemAgendaUnificado): ColunaKey {
  if (isItemTratado(item)) return "concluidos";
  const d = getRefDate(item);
  if (!d) return "futuro";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return "vencidos";
  if (diff === 0) return "hoje";
  if (diff <= 7) return "proximos";
  return "futuro";
}

export function KanbanItensAgenda({ itens, onItemClick, emptyLabel = "Nenhum item" }: KanbanItensAgendaProps) {
  const { data: itensComAtividades = new Set<string>() } = useItensComAtividades(itens);
  const { data: itensDeWorkflow = new Set<string>() } = useItensDeWorkflow(itens);
  const { data: itensComComentarios = new Set<string>() } = useItensComComentarios(itens);

  const grupos = useMemo(() => {
    const m = new Map<ColunaKey, ItemAgendaUnificado[]>();
    COLUNAS.forEach((c) => m.set(c.key, []));
    itens.forEach((it) => m.get(classifyItem(it))!.push(it));
    // sort by date ascending within column
    m.forEach((arr) =>
      arr.sort((a, b) => {
        const da = getRefDate(a)?.getTime() ?? Infinity;
        const db = getRefDate(b)?.getTime() ?? Infinity;
        return da - db;
      }),
    );
    return m;
  }, [itens]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {COLUNAS.map((col) => {
        const items = grupos.get(col.key) ?? [];
        const Icon = col.icon;
        return (
          <div key={col.key} className={cn("rounded-lg border p-2 flex flex-col min-h-[200px]", col.color, col.ring)}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Icon className="w-4 h-4" />
              <span className="font-semibold text-sm">{col.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{emptyLabel}</p>
              )}
              {items.map((item) => {
                const d = getRefDate(item);
                const temAtividade = itensComAtividades.has(getItemRawId(item.id));
                const veioDeWorkflow = itensDeWorkflow.has(getItemRawId(item.id));
                return (
                  <Card
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    className="p-2 cursor-pointer hover:shadow-md transition-shadow bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium line-clamp-2 flex-1">{item.titulo || "(sem título)"}</p>
                      {temAtividade && <AtividadeBadge className="w-3.5 h-3.5 text-[8px]" />}
                      {veioDeWorkflow && <WorkflowBadge className="w-3.5 h-3.5 text-[8px]" />}
                      {itensComComentarios.has(getItemRawId(item.id)) && <ComentarioBadge className="w-3.5 h-3.5 text-[8px]" />}
                    </div>
                    {item.processo?.numero && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                        {item.processo.numero}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}
                      </span>
                      {item.responsavel?.nome && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[50%]">
                          {item.responsavel.nome}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}