import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { cn } from "@/lib/utils";

interface Props {
  tarefaId: string;
  className?: string;
}

/**
 * Exibe (de forma colapsável) a publicação DJEN vinculada a uma tarefa.
 * Procura vínculo em `tarefas_publicacoes` e `tarefas_publicacoes_processos`.
 * Renderiza nada quando não há vínculo.
 */
export function TarefaPublicacaoVinculada({ tarefaId, className }: Props) {
  const [aberto, setAberto] = useState(false);

  const { data: publicacao } = useQuery({
    queryKey: ["tarefa-publicacao-vinculada", tarefaId],
    queryFn: async () => {
      // 1) Vínculo por termo
      const { data: vinculoTermo } = await supabase
        .from("tarefas_publicacoes")
        .select("publicacao_id")
        .eq("tarefa_id", tarefaId)
        .maybeSingle();

      if (vinculoTermo?.publicacao_id) {
        const { data: pub } = await supabase
          .from("publicacoes_djen")
          .select("id, processo_numero, data_publicacao, data_disponibilizacao, tribunal, tipo_comunicacao, conteudo, polo_ativo, polo_passivo")
          .eq("id", vinculoTermo.publicacao_id)
          .maybeSingle<any>();
        if (pub) return { ...(pub as any), _tipo: "termo" as const };
      }

      // 2) Vínculo por publicação de processo
      const { data: vinculoProc } = await supabase
        .from("tarefas_publicacoes_processos")
        .select("publicacao_processo_id")
        .eq("tarefa_id", tarefaId)
        .maybeSingle();

      if (vinculoProc?.publicacao_processo_id) {
        const { data: pub } = await supabase
          .from("publicacoes_djen_processos")
          .select("id, processo_numero, data_publicacao, data_disponibilizacao, tribunal, tipo_comunicacao, conteudo, polo_ativo, polo_passivo")
          .eq("id", vinculoProc.publicacao_processo_id)
          .maybeSingle<any>();
        if (pub) return { ...(pub as any), _tipo: "processo" as const };
      }

      return null;
    },
    enabled: !!tarefaId,
    staleTime: 60_000,
  });

  if (!publicacao) return null;

  return (
    <div className={cn("border border-emerald-300 rounded-lg overflow-hidden bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800", className)}>
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              Publicação DJEN vinculada
            </span>
            {(publicacao as any).tribunal && (
              <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-800 dark:text-emerald-300">
                {(publicacao as any).tribunal}
              </Badge>
            )}
            {(publicacao as any).data_publicacao && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400">
                Pub. {format(parseISO((publicacao as any).data_publicacao), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
          </div>
          {aberto ? (
            <ChevronDown className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {(publicacao as any).processo_numero && (
              <div className="font-mono text-xs">{(publicacao as any).processo_numero}</div>
            )}
            {((publicacao as any).polo_ativo || (publicacao as any).polo_passivo) && (
              <div className="text-xs text-muted-foreground">
                {(publicacao as any).polo_ativo}
                {(publicacao as any).polo_passivo ? ` × ${(publicacao as any).polo_passivo}` : ""}
              </div>
            )}
            <div className={cn("text-sm", conteudoDisplayClasses)}>
              {formatConteudoParaExibicao((publicacao as any).conteudo || "")}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}