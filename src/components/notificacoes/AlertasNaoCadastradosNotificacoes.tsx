import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileQuestion, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Props {
  coordenacaoId?: string;
  statusFilter?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  searchQuery?: string;
}

export function AlertasNaoCadastradosNotificacoes({
  coordenacaoId,
  statusFilter = "pendente",
  periodoInicio,
  periodoFim,
  searchQuery,
}: Props) {
  const navigate = useNavigate();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-nao-cadastrados-notificacoes", coordenacaoId, statusFilter, periodoInicio, periodoFim, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("alertas_processos_nao_cadastrados")
        .select(`
          *,
          termo:termos_monitoramento(termo, categoria),
          coordenacao:coordenacoes(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter && statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "tratado" : statusFilter;
        query = query.eq("status", status);
      }
      if (coordenacaoId) {
        query = query.eq("coordenacao_id", coordenacaoId);
      }
      if (periodoInicio) {
        query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      }
      if (periodoFim) {
        const fim = new Date(periodoFim.getTime() + 86400000);
        query = query.lt("created_at", format(fim, "yyyy-MM-dd"));
      }
      if (searchQuery?.trim()) {
        query = query.or(`processo_numero.ilike.%${searchQuery}%,termo_encontrado.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "urgente": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "alta": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "media": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (alertas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileQuestion className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Nenhum alerta de processo não cadastrado</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-3">
        {alertas.map((alerta: any) => (
          <div
            key={alerta.id}
            className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => navigate("/monitoramento360")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium">
                    {alerta.processo_numero}
                  </span>
                  <Badge variant="outline" className={getPrioridadeColor(alerta.prioridade)}>
                    {alerta.prioridade}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {alerta.termo_encontrado}
                  </Badge>
                  {alerta.coordenacao?.nome && (
                    <Badge variant="outline" className="text-xs">
                      {alerta.coordenacao.nome}
                    </Badge>
                  )}
                </div>
                {alerta.contexto && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{alerta.contexto}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
