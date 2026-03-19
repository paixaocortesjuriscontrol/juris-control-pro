import { ProcessoTst } from "@/hooks/usePrazosTst";
import { TstPrazoCard } from "./TstPrazoCard";
import { differenceInCalendarDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Column {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  filter: (p: ProcessoTst) => boolean;
}

function getDias(p: ProcessoTst): number | null {
  if (!p.data_fatal) return null;
  return differenceInCalendarDays(new Date(p.data_fatal + "T12:00:00"), new Date());
}

const columns: Column[] = [
  { key: "sem-prazo", label: "Sem Prazo", color: "text-slate-500", bgColor: "bg-slate-500/10 border-slate-500/30", filter: (p) => getDias(p) === null },
  { key: "5+", label: "Mais de 5 dias", color: "text-green-600", bgColor: "bg-green-500/10 border-green-500/30", filter: (p) => { const d = getDias(p); return d !== null && d >= 5; } },
  { key: "4", label: "4 dias", color: "text-yellow-600", bgColor: "bg-yellow-500/10 border-yellow-500/30", filter: (p) => getDias(p) === 4 },
  { key: "3", label: "3 dias", color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/30", filter: (p) => getDias(p) === 3 },
  { key: "2", label: "2 dias", color: "text-red-400", bgColor: "bg-red-400/10 border-red-400/30", filter: (p) => getDias(p) === 2 },
  { key: "fatal", label: "Prazo Fatal", color: "text-red-600", bgColor: "bg-red-600/10 border-red-600/30", filter: (p) => { const d = getDias(p); return d !== null && d <= 1; } },
];

interface Props {
  prazos: ProcessoTst[];
  onCardClick: (p: ProcessoTst) => void;
}

export function TstKanbanBoard({ prazos, onCardClick }: Props) {
  // On mobile/tablet, show urgent first (reversed order)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const orderedColumns = isMobile ? [...columns].reverse() : columns;

  return (
    <div className="flex-1 min-h-0 overflow-hidden pb-2">
      <div className="grid grid-cols-1 gap-3 min-h-0 md:grid-cols-6 h-full">
        {orderedColumns.map((col) => {
          const items = prazos.filter((p) => col.filter(p));
          return (
            <div key={col.key} className={`flex w-full min-w-0 flex-col rounded-lg border ${col.bgColor} min-h-[300px]`}>
              <div className={`px-3 py-2 border-b ${col.bgColor}`}>
                <h3 className={`text-sm font-semibold ${col.color} truncate`}>{col.label}</h3>
                <span className="text-xs text-muted-foreground">{items.length} processo(s)</span>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {items
                    .sort((a, b) => {
                      if (!a.data_fatal && !b.data_fatal) return 0;
                      if (!a.data_fatal) return 1;
                      if (!b.data_fatal) return -1;
                      return new Date(a.data_fatal).getTime() - new Date(b.data_fatal).getTime();
                    })
                    .map((p) => (
                      <TstPrazoCard key={p.id} processo={p} onClick={() => onCardClick(p)} />
                    ))}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum processo</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
