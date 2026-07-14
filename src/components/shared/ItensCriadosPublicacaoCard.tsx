import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Calendar, ListChecks, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemCriadoTipo = "prazo" | "evento" | "tarefa" | "audiencia";

export interface ItemCriado {
  id: string;
  tipo: ItemCriadoTipo;
  titulo: string;
  createdAt: number;
}

interface Props {
  itens: ItemCriado[];
  className?: string;
}

const TIPO_META: Record<ItemCriadoTipo, { label: string; icon: React.ComponentType<any> }> = {
  prazo: { label: "Prazo", icon: Clock },
  evento: { label: "Evento", icon: Calendar },
  tarefa: { label: "Tarefa", icon: ListChecks },
  audiencia: { label: "Audiência", icon: Gavel },
};

/**
 * Card verde retrátil exibido acima da publicação na Análise DJEN, listando
 * os itens (prazos/eventos/tarefas/audiências) que acabaram de ser criados
 * a partir da publicação selecionada durante esta sessão. Some quando a lista
 * está vazia.
 */
export function ItensCriadosPublicacaoCard({ itens, className }: Props) {
  const [aberto, setAberto] = useState(true);
  const [flashId, setFlashId] = useState<string | null>(null);
  const ultimo = itens[itens.length - 1];

  // Destaca por 2.5s o item mais recente adicionado.
  useEffect(() => {
    if (!ultimo) return;
    setFlashId(ultimo.id);
    setAberto(true);
    const t = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(t);
  }, [ultimo?.id]);

  if (!itens.length) return null;

  return (
    <div className={cn("border border-emerald-300 rounded-lg overflow-hidden bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800", className)}>
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              Itens criados a partir desta publicação
            </span>
            <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-800 dark:text-emerald-300">
              {itens.length}
            </Badge>
          </div>
          {aberto ? (
            <ChevronDown className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {itens.map((item) => {
              const meta = TIPO_META[item.tipo];
              const Icon = meta.icon;
              const isFlash = flashId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 text-sm rounded px-2 py-1 border transition-colors",
                    isFlash
                      ? "bg-emerald-200 dark:bg-emerald-900/60 border-emerald-400 dark:border-emerald-700"
                      : "bg-white/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-800 dark:text-emerald-300 shrink-0">
                    {meta.label}
                  </Badge>
                  <span className="truncate text-emerald-950 dark:text-emerald-100">
                    {item.titulo}
                  </span>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}