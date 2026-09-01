import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import { EditarAudienciaDialog } from "@/components/audiencias/EditarAudienciaDialog";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { AlertTriangle, Calendar as CalendarIcon, CheckCircle2, ExternalLink, User as UserIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

function PrazoFatalReadOnlyPanel({
  processo,
  diasRestantes,
  onConferido,
}: {
  processo: any;
  diasRestantes?: number;
  onConferido?: () => void;
}) {
  if (!processo) return null;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const conferido = !!processo.prazo_fatal_conferido;
  const dataFatal = processo.data_fatal ? format(parseISO(processo.data_fatal), "dd/MM/yyyy", { locale: ptBR }) : "—";
  const atrasado = typeof diasRestantes === "number" && diasRestantes < 0;

  const marcarConferido = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from("processos")
      .update({
        prazo_fatal_conferido: true,
        prazo_fatal_conferido_em: new Date().toISOString(),
        prazo_fatal_conferido_por: user?.id ?? null,
      })
      .eq("id", processo.id);
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao marcar como conferido", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
    await queryClient.invalidateQueries({ queryKey: ["prazos-tst"] });
    toast({ title: "Prazo fatal conferido", description: "O item ficará verde no calendário." });
    onConferido?.();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${conferido ? "bg-green-500/10" : "bg-destructive/10"}`}>
          {conferido ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Prazo Fatal {conferido && "• Conferido"}
          </div>
          <h2 className="text-lg font-semibold leading-tight">{processo.numero}</h2>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3 bg-card">
        <div className="flex items-center gap-2 text-sm">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Data Fatal:</span>
          <span>{dataFatal}</span>
          {typeof diasRestantes === "number" && (
            <Badge variant={atrasado ? "destructive" : "secondary"} className="ml-auto">
              {atrasado ? `${Math.abs(diasRestantes)} dia(s) em atraso` : `${diasRestantes} dia(s) restantes`}
            </Badge>
          )}
        </div>
        {processo.responsavel_tst && (
          <div className="flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Responsável:</span>
            <span>{processo.responsavel_tst}</span>
          </div>
        )}
        {processo.equipe_tst && (
          <div className="text-sm"><span className="font-medium">Equipe:</span> {processo.equipe_tst}</div>
        )}
        {processo.status && (
          <div className="text-sm"><span className="font-medium">Status:</span> {processo.status}</div>
        )}
        {conferido && (
          <div className="text-xs text-green-700 dark:text-green-400">
            Conferido em {processo.prazo_fatal_conferido_em ? format(parseISO(processo.prazo_fatal_conferido_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
          </div>
        )}
      </div>

      {(processo.polo_ativo || processo.polo_passivo) && (
        <div className="rounded-lg border p-4 space-y-2 bg-card text-sm">
          {processo.polo_ativo && (<div><span className="font-medium">Polo ativo:</span> {processo.polo_ativo}</div>)}
          {processo.polo_passivo && (<div><span className="font-medium">Polo passivo:</span> {processo.polo_passivo}</div>)}
        </div>
      )}

      {processo.decisao_tst && (
        <div className="rounded-lg border p-4 bg-card">
          <div className="text-sm font-medium mb-1">Decisão / Observações</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{processo.decisao_tst}</p>
        </div>
      )}

      <Link
        to={`/processos/${processo.id}`}
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        Abrir processo
      </Link>

      <div className="pt-2">
        {conferido ? (
          <Button variant="outline" className="w-full" disabled>
            <CheckCircle2 className="h-4 w-4" /> Prazo fatal conferido
          </Button>
        ) : (
          <Button
            onClick={marcarConferido}
            disabled={salvando}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            {salvando ? "Salvando..." : "Marcar prazo fatal como conferido"}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Este item é gerado automaticamente a partir do campo <strong>Data Fatal</strong> do processo e não pode ser editado pelo painel da agenda. Para alterar, edite o processo.
      </p>
    </div>
  );
}

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

  const isParcela = item.tipo === "prazo_parcela";
  const isParcelamento = item.tipo === "parcelamento" || isParcela;
  const isPrazoFatalTst = typeof item.id === "string" && item.id.startsWith("prazo-tst-");
  const isAudiencia = typeof item.id === "string" && item.id.startsWith("audiencia-det-");
  const isPrazo = item.tipo === "prazo" || String(item.tipo_tarefa || "").toUpperCase().trim() === "PRAZO";
  const isEvento = (item.origem === "evento" || isParcelamento) && !isPrazoFatalTst && !isAudiencia;

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
      if (isPrazoFatalTst) {
        // PRAZO FATAL TST não é tarefa nem evento — dados vêm direto de `processos`
        const processoId = item.processo_id || item.id.replace(/^prazo-tst-/, "");
        const { data } = await supabase
          .from("processos")
          .select("id, numero, polo_ativo, polo_passivo, data_fatal, decisao_tst, responsavel_tst, equipe_tst, status, cliente_id, prazo_fatal_conferido, prazo_fatal_conferido_em, prazo_fatal_conferido_por")
          .eq("id", processoId)
          .maybeSingle();
        if (!cancelled) setEvento(data);
      } else if (isAudiencia) {
        const audId = item.id.replace(/^audiencia-det-/, "");
        const { data } = await supabase
          .from("audiencias_detectadas")
          .select("*")
          .eq("id", audId)
          .maybeSingle();
        if (!cancelled) setEvento(data);
      } else if (isEvento) {
        // Para uma parcela individual, edita o evento-pai (parcelamento)
        const rawId = isParcela
          ? ((item as any).grupo_parcelas as string | undefined) ?? item.id
          : item.id;
        // Ocorrências de recorrência têm id "<eventoId>::YYYY-MM-DD" — usar apenas o eventoId
        const eventoId = ((item as any).recorrencia_pai_id as string | undefined) ?? rawId.split("::")[0];
        const { data } = await supabase
          .from("eventos_agenda")
          .select("*, processo:processos!eventos_agenda_processo_id_fkey(id,numero,polo_ativo,polo_passivo)")
          .eq("id", eventoId)
          .maybeSingle();
        if (!cancelled) setEvento(data);
      } else {
        const tarefaId = String(item.id).split("::")[0];
        const { data } = await supabase
          .from("tarefas")
          .select("*")
          .eq("id", tarefaId)
          .maybeSingle();
        if (!cancelled) setTarefa(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, isEvento, isPrazoFatalTst, item.processo_id]);

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
      {isOcorrenciaRecorrente(item) && !isPrazoFatalTst && !isAudiencia && !isParcelamento && (
        <BaixaOcorrenciaBar item={item} onUpdate={onUpdate} />
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isPrazoFatalTst ? (
          evento && (
            <PrazoFatalReadOnlyPanel
              processo={evento}
              diasRestantes={item.dias_restantes}
              onConferido={closeAfter}
            />
          )
        ) : isAudiencia ? (
          evento && (
            <EditarAudienciaDialog
              audiencia={evento as any}
              open
              inline
              onOpenChange={(o) => {
                if (!o) closeAfter();
              }}
            />
          )
        ) : isParcelamento ? (
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
        ) : isPrazo ? (
          tarefa && (
            <PrazoDialog
              inline
              open
              onOpenChange={(o) => {
                if (!o) closeAfter();
              }}
              prazo={tarefa}
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