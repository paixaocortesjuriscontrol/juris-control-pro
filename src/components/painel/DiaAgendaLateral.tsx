import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TratadoCheck, isItemTratado } from "@/components/shared/TratadoCheck";
import { labelSituacaoAtividade } from "@/components/comum/ItemAtividades";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

const TIPO_TEXTO: Record<string, string> = {
  evento: "text-green-600",
  tarefa: "text-blue-600",
  tarefa_delegada: "text-blue-700",
  prazo: "text-red-600",
  audiencia: "text-yellow-600",
  prazo_parcela: "text-red-500",
  parcelamento: "text-emerald-600",
};

const TIPO_LABELS: Record<string, string> = {
  evento: "EVENTO",
  tarefa: "TAREFA",
  tarefa_delegada: "DELEGADA",
  prazo: "PRAZO",
  audiencia: "AUDIÊNCIA",
  prazo_parcela: "PARCELA",
  parcelamento: "PARCELAMENTO",
};

const normalize = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const isCancelado = (item: ItemAgendaUnificado) =>
  ["cancelado", "cancelada"].includes(normalize(item.status));

const horaDoItem = (item: ItemAgendaUnificado) => {
  const bruta =
    item.hora_prevista ||
    item.hora_fatal ||
    (item.dia_inteiro ? null : item.data_inicio?.slice(11, 16));
  if (!bruta) return null;
  const hhmm = String(bruta).slice(0, 5);
  return /^\d{2}:\d{2}$/.test(hhmm) && hhmm !== "00:00" ? hhmm : null;
};

/** Linha de item usada no menu lateral (mesmo layout no Painel de Controle e em Processos). */
export function AgendaItemRow({
  item,
  userId,
  onSelect,
}: {
  item: ItemAgendaUnificado;
  userId?: string;
  onSelect: (item: ItemAgendaUnificado) => void;
}) {
  const concluido = isItemTratado(item);
  const cancelado = isCancelado(item);
  const hora = horaDoItem(item);
  const sou =
    !!userId &&
    (item.responsavel_id === userId ||
      item.criado_por === userId ||
      item.participantes?.some((p) => p.usuario_id === userId));

  return (
    <button
      onClick={() => onSelect(item)}
      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors"
    >
      <div className="pt-0.5 flex-shrink-0">
        <TratadoCheck tratado={concluido} size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[10px] font-bold tracking-wide",
            TIPO_TEXTO[item.tipo] || "text-muted-foreground"
          )}
        >
          {TIPO_LABELS[item.tipo] || (item.tipo_tarefa ?? item.tipo).toUpperCase()}
        </p>
        <p
          className={cn(
            "text-sm text-foreground leading-snug",
            (concluido || cancelado) && "line-through text-muted-foreground"
          )}
        >
          {item.titulo || TIPO_LABELS[item.tipo] || "Sem título"}
          {hora ? `: ${hora}` : ""}
        </p>
        {(item.local || item.descricao) && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
            {item.local || item.descricao}
          </p>
        )}
        {(item.processo?.assunto || item.processo?.numero) && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            {[item.processo?.assunto, item.processo?.numero].filter(Boolean).join(" - ")}
          </p>
        )}
        {item.responsavel?.nome && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Responsável: {item.responsavel.nome}
          </p>
        )}
      </div>
      {sou && (
        <span className="flex-shrink-0 self-start text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
          Eu
        </span>
      )}
    </button>
  );
}

interface DiaAgendaLateralProps {
  dia: Date;
  itens: ItemAgendaUnificado[];
  userId?: string;
  atividades?: any[];
  onSelectItem: (item: ItemAgendaUnificado) => void;
  onSelectAtividade?: (atividade: any) => void;
  onClose: () => void;
}

export function DiaAgendaLateral({
  dia,
  itens,
  userId,
  atividades = [],
  onSelectItem,
  onSelectAtividade,
  onClose,
}: DiaAgendaLateralProps) {
  const total = itens.length + atividades.length;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground capitalize truncate">
            {format(dia, "EEE, d MMM yyyy", { locale: ptBR })}
            <span className="text-muted-foreground font-normal">
              {"  ·  "}
              {total} {total === 1 ? "atividade" : "atividades"}
            </span>
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border">
          {total === 0 && (
            <p className="p-4 text-xs text-muted-foreground">Nenhuma atividade neste dia.</p>
          )}
          {itens.map((item) => (
            <AgendaItemRow key={item.id} item={item} userId={userId} onSelect={onSelectItem} />
          ))}
          {atividades.map((a: any) => {
            const encerrada = a.situacao === "concluida" || a.situacao === "cancelada";
            const sou = !!userId && (a.responsavel_id === userId || a.criado_por === userId);
            return (
              <button
                key={`ativ-${a.id}`}
                onClick={() => onSelectAtividade?.(a)}
                className="w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors"
              >
                <div className="pt-0.5 flex-shrink-0">
                  <ListChecks className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-wide text-blue-600 dark:text-blue-400">
                    ATIVIDADE
                  </p>
                  <p
                    className={cn(
                      "text-sm text-foreground leading-snug",
                      encerrada && "line-through text-muted-foreground"
                    )}
                  >
                    {a.titulo || "Atividade"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Situação: {labelSituacaoAtividade(a.situacao)}
                  </p>
                  {a.observacao && (
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                      {a.observacao}
                    </p>
                  )}
                </div>
                {sou && (
                  <span className="flex-shrink-0 self-start text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                    Eu
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
