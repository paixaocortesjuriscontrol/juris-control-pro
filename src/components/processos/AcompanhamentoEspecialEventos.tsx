import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  processoId?: string;
  limit?: number;
  showProcesso?: boolean;
  /** Não renderiza nada quando não há eventos (evita mensagem duplicada ao lado das divergências) */
  hideWhenEmpty?: boolean;
}

export function AcompanhamentoEspecialEventos({ processoId, limit = 20, showProcesso = false, hideWhenEmpty = false }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["acompanhamento-eventos", "novidades", processoId, limit],
    queryFn: async () => {
      let q = supabase
        .from("acompanhamento_especial_eventos")
        .select("id, step_date, conteudo, instancia, tribunal, anexos_count, processo_id, criado_em, retroativo, lido_em, processo:processos(numero, polo_ativo)")
        // Novidades = apenas movimentações realmente novas (não retroativas e ainda não lidas)
        .or("retroativo.is.null,retroativo.eq.false")
        .is("lido_em", null)
        .order("step_date", { ascending: false })
        .limit(limit);
      if (processoId) q = q.eq("processo_id", processoId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando novidades…</p>;
  }

  if (!data || data.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        <Sparkles className="w-6 h-6 mx-auto mb-2 text-amber-500/60" />
        Nenhuma novidade do Acompanhamento Especial.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((ev: any) => (
        <div key={ev.id} className="border-l-2 border-amber-500/60 pl-3 py-2">
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{ev.step_date ? format(new Date(ev.step_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</span>
            {ev.tribunal && <Badge variant="outline" className="text-[10px] h-4">{ev.tribunal}</Badge>}
            {ev.instancia && <Badge variant="outline" className="text-[10px] h-4">{ev.instancia}</Badge>}
            {ev.anexos_count > 0 && (
              <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{ev.anexos_count}</span>
            )}
            {showProcesso && ev.processo?.numero && (
              <span className="font-mono">{ev.processo.numero}</span>
            )}
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{ev.conteudo}</p>
        </div>
      ))}
    </div>
  );
}