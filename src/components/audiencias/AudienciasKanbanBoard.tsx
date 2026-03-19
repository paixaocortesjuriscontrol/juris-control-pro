import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { AudienciaKanbanCard, getDaysUntil } from "./AudienciaKanbanCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface Column {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  filter: (a: AudienciaDetectada) => boolean;
}

const columns: Column[] = [
  { key: "sem-data", label: "Sem Data", color: "text-slate-500", bgColor: "bg-slate-500/10 border-slate-500/30", filter: (a) => getDaysUntil(a.data_audiencia) === null },
  { key: "5+", label: "Mais de 5 dias", color: "text-green-600", bgColor: "bg-green-500/10 border-green-500/30", filter: (a) => { const d = getDaysUntil(a.data_audiencia); return d !== null && d >= 5; } },
  { key: "4", label: "4 dias", color: "text-yellow-600", bgColor: "bg-yellow-500/10 border-yellow-500/30", filter: (a) => getDaysUntil(a.data_audiencia) === 4 },
  { key: "3", label: "3 dias", color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/30", filter: (a) => getDaysUntil(a.data_audiencia) === 3 },
  { key: "2", label: "2 dias", color: "text-red-400", bgColor: "bg-red-400/10 border-red-400/30", filter: (a) => getDaysUntil(a.data_audiencia) === 2 },
  { key: "fatal", label: "Urgente", color: "text-red-600", bgColor: "bg-red-600/10 border-red-600/30", filter: (a) => { const d = getDaysUntil(a.data_audiencia); return d !== null && d <= 1; } },
];

interface Props {
  audiencias: AudienciaDetectada[];
  onDetalhes: (a: AudienciaDetectada) => void;
  onEditar: (a: AudienciaDetectada) => void;
  onCriarTarefa: (a: AudienciaDetectada) => void;
  onMarcarTratado: (id: string) => void;
  onIgnorar: (id: string) => void;
  isPending: boolean;
}

export function AudienciasKanbanBoard({ audiencias, onDetalhes, onEditar, onCriarTarefa, onMarcarTratado, onIgnorar, isPending }: Props) {
  const isMobile = useIsMobile();
  const orderedColumns = isMobile ? [...columns].reverse() : columns;

  return (
    <div className="flex-1 min-h-0 overflow-hidden pb-2">
      <div className="grid grid-cols-1 gap-3 min-h-0 md:grid-cols-6 h-full">
        {orderedColumns.map((col) => {
          const items = audiencias.filter((a) => col.filter(a));
          return (
            <div key={col.key} className={`flex min-w-0 flex-col rounded-lg border ${col.bgColor} min-h-[300px] overflow-hidden`}>
              <div className={`px-3 py-2 border-b ${col.bgColor}`}>
                <h3 className={`text-sm font-semibold ${col.color} truncate`}>{col.label}</h3>
                <span className="text-xs text-muted-foreground">{items.length} audiência(s)</span>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {items
                    .sort((a, b) => {
                      if (!a.data_audiencia && !b.data_audiencia) return 0;
                      if (!a.data_audiencia) return 1;
                      if (!b.data_audiencia) return -1;
                      return new Date(a.data_audiencia).getTime() - new Date(b.data_audiencia).getTime();
                    })
                    .map((a) => (
                      <AudienciaKanbanCard
                        key={a.id}
                        audiencia={a}
                        onDetalhes={onDetalhes}
                        onEditar={onEditar}
                        onCriarTarefa={onCriarTarefa}
                        onMarcarTratado={onMarcarTratado}
                        onIgnorar={onIgnorar}
                        isPending={isPending}
                      />
                    ))}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma audiência</p>
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
