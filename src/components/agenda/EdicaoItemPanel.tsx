import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

interface EdicaoItemPanelProps {
  item: ItemAgendaUnificado;
  onClose: () => void;
  onUpdate?: () => void;
}

export function EdicaoItemPanel({ item, onClose, onUpdate }: EdicaoItemPanelProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [tarefa, setTarefa] = useState<any | null>(null);
  const [evento, setEvento] = useState<any | null>(null);

  const isParcelamento = item.tipo === "parcelamento";
  const isEvento = item.origem === "evento" || isParcelamento;

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-edicao-painel-lateral", isAdmin, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let q = supabase.from("coordenacoes").select("id, nome, area").order("nome");
      if (!isAdmin) {
        const { data: m } = await supabase
          .from("membros_coordenacao")
          .select("coordenacao_id")
          .eq("usuario_id", user.id);
        const ids = (m || []).map((r: any) => r.coordenacao_id);
        if (ids.length === 0) return [];
        q = q.in("id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !isEvento,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isEvento) {
        const { data } = await supabase
          .from("eventos_agenda")
          .select("*")
          .eq("id", item.id)
          .maybeSingle();
        if (!cancelled) setEvento(data);
      } else {
        const { data } = await supabase
          .from("tarefas")
          .select("*")
          .eq("id", item.id)
          .maybeSingle();
        if (!cancelled) setTarefa(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, isEvento]);

  const closeAfter = () => {
    onUpdate?.();
    onClose();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-end px-2 py-1.5 border-b bg-card flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {isParcelamento ? (
          evento && (
            <GerarParcelasDialog
              inline
              open
              onOpenChange={(o) => {
                if (!o) closeAfter();
              }}
              evento={evento}
            />
          )
        ) : isEvento ? (
          evento && (
            <EventoDialog
              inline
              open
              onOpenChange={(o) => {
                if (!o) closeAfter();
              }}
              evento={evento}
            />
          )
        ) : (
          tarefa && (
            <NovaTarefaDialog
              inline
              open
              onOpenChange={(o) => {
                if (!o) closeAfter();
              }}
              coordenacoes={coordenacoes}
              tarefaParaEditar={tarefa}
              onSuccess={onUpdate}
            />
          )
        )}
      </div>
    </div>
  );
}