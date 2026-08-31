import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ProcessoResumoInline } from "@/components/processos/ProcessoResumoInline";
import { AgendaItemRow } from "@/components/painel/DiaAgendaLateral";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import { useItensComAtividades, getItemRawId } from "@/hooks/useItensComAtividades";
import { dataInicioAudiencia } from "@/utils/date";
import { expandirOcorrencias, janelaRecorrenciaPadrao } from "@/utils/recorrencia";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

const soData = (v?: string | null) => (v ? String(v).slice(0, 10) : null);

const tipoDaTarefa = (t: any): string => {
  const texto = String(t.tipo_tarefa ?? t.tipo_registro ?? "").toUpperCase().trim();
  // Atenção: não mapear "parcelamento" aqui — isso é uma tarefa, não evento-pai.
  if (texto.includes("PRAZO")) return "prazo";
  if (texto.includes("AUDI")) return "audiencia";
  if (texto.includes("EVENTO")) return "evento";
  return "tarefa";
};


interface Props {
  processoId: string;
  processoNumero: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function ProcessoItensLateral({ processoId, processoNumero, onClose, onNavigate }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);

  const { data: itens = [], isLoading } = useQuery<ItemAgendaUnificado[]>({
    queryKey: ["processo-itens-lateral-v2", processoId, processoNumero],
    staleTime: 60_000,
    queryFn: async () => {
      const [tarefasRes, eventosRes, audienciasRes] = await Promise.all([
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
      ]);

      const processo = { id: processoId, numero: processoNumero };
      const lista: ItemAgendaUnificado[] = [];

      for (const t of ((tarefasRes.data as any[]) || [])) {
        lista.push({
          ...t,
          id: String(t.id),
          origem: "tarefa",
          tipo: tipoDaTarefa(t),
          titulo: t.titulo || t.tipo_tarefa || "Sem título",
          data_inicio: t.data_fatal || t.data_vencimento || t.data_prevista || t.created_at,
          processo,
        } as ItemAgendaUnificado);
      }

      const { windowStart, windowEnd } = janelaRecorrenciaPadrao();
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

  if (selectedItem) {
    return (
      <EdicaoItemPanel
        key={selectedItem.id}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["processo-itens-lateral-v2", processoId] });
        }}
      />
    );
  }

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
            itens.map((item) => (
              <AgendaItemRow
                key={item.id}
                item={item}
                userId={user?.id}
                onSelect={setSelectedItem}
                temAtividade={itensComAtividades.has(getItemRawId(item.id))}
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
