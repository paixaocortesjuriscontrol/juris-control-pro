import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";

interface Props {
  audienciaId: string | undefined;
}

export function HistoricoReagendamentosAudiencia({ audienciaId }: Props) {
  const { data = [] } = useQuery({
    queryKey: ["historico-reagendamentos", audienciaId],
    queryFn: async () => {
      if (!audienciaId) return [];
      const { data, error } = await supabase
        .from("historico_reagendamentos_audiencia")
        .select("*")
        .eq("audiencia_id", audienciaId)
        .order("alterado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!audienciaId,
  });

  if (!audienciaId || data.length === 0) return null;

  const fmt = (v?: string | null) => {
    if (!v) return "—";
    try { return format(parseISO(v), "dd/MM/yyyy", { locale: ptBR }); } catch { return v; }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <History className="h-4 w-4" /> Histórico de alterações da audiência ({data.length})
      </h3>
      <div className="space-y-2 text-xs">
        {data.map((h: any) => (
          <div key={h.id} className="rounded-md border bg-muted/30 p-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span><b>De:</b> {fmt(h.data_anterior)}{h.hora_anterior ? ` ${h.hora_anterior}` : ""}</span>
              <span><b>Para:</b> {fmt(h.data_nova)}{h.hora_nova ? ` ${h.hora_nova}` : ""}</span>
              {h.tipo_anterior !== h.tipo_novo && (
                <span><b>Tipo:</b> {h.tipo_anterior || "—"} → {h.tipo_novo || "—"}</span>
              )}
              {h.modalidade_anterior !== h.modalidade_nova && (
                <span><b>Modalidade:</b> {h.modalidade_anterior || "—"} → {h.modalidade_nova || "—"}</span>
              )}
            </div>
            {h.motivo && <div className="mt-1 text-muted-foreground"><b>Motivo:</b> {h.motivo}</div>}
            <div className="mt-1 text-muted-foreground">
              {h.alterado_em ? format(parseISO(h.alterado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}