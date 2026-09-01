import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Loader2, RotateCcw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissoesSituacao } from "@/hooks/usePermissoesSituacao";
import { situacoesDisponiveis, valorConcluidoSucesso, type TipoSituacaoItem } from "@/constants/situacoesItem";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import {
  buscarBaixaOcorrencia,
  dadosOcorrencia,
  removerBaixaOcorrencia,
  salvarBaixaOcorrencia,
} from "@/lib/baixaOcorrencia";
import { toast } from "sonner";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

interface Props {
  item: ItemAgendaUnificado;
  onUpdate?: () => void;
}

/**
 * Baixa de item recorrente: o usuário escolhe se a situação vale
 * SOMENTE PARA A OCORRÊNCIA exibida ou para TODA A SÉRIE.
 * - "Somente esta": grava em `ocorrencias_recorrentes_status`.
 * - "Toda a série": atualiza o registro-pai (tarefas / eventos_agenda).
 */
export function BaixaOcorrenciaBar({ item, onUpdate }: Props) {
  const info = dadosOcorrencia(item);
  const { user } = useAuth();
  const { isAdmin, role } = useUserRole();
  const queryClient = useQueryClient();
  const { podeUsarSituacao, situacaoAtiva } = usePermissoesSituacao();

  const tipoSituacao: TipoSituacaoItem =
    item.tipo === "prazo" ? "prazo" : item.origem === "tarefa" ? "tarefa" : "evento";

  const [situacao, setSituacao] = useState<string>(
    item.status || valorConcluidoSucesso(tipoSituacao),
  );
  const [observacao, setObservacao] = useState("");
  const [temBaixa, setTemBaixa] = useState(!!item.baixa_individual);
  const [salvando, setSalvando] = useState<"esta" | "serie" | "reabrir" | null>(null);

  useEffect(() => {
    if (!info) return;
    let cancelado = false;
    (async () => {
      const baixa = await buscarBaixaOcorrencia(info);
      if (cancelado) return;
      setTemBaixa(!!baixa);
      if (baixa) {
        setSituacao(baixa.status);
        setObservacao(baixa.observacao ?? "");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [info?.origem, info?.itemId, info?.dataOcorrencia]);

  if (!info) return null;

  const podeGerenciar =
    isAdmin || role === "coordenador" || role === "assistente_coordenador";
  const opcoes = situacoesDisponiveis(tipoSituacao, { podeGerenciar, atual: situacao }).filter(
    (s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value)),
  );

  const dataLabel = format(parseISO(`${info.dataOcorrencia}T12:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  const finalizar = async (msg: string) => {
    await invalidarItensAgenda(queryClient);
    toast.success(msg);
    onUpdate?.();
  };

  const baixarSomenteEsta = async () => {
    setSalvando("esta");
    try {
      await salvarBaixaOcorrencia({
        origem: info.origem,
        itemId: info.itemId,
        dataOcorrencia: info.dataOcorrencia,
        status: situacao,
        observacao: observacao.trim() || null,
        userId: user?.id ?? null,
      });
      setTemBaixa(true);
      await finalizar(`Baixa registrada apenas para ${dataLabel}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar a baixa desta ocorrência.");
    } finally {
      setSalvando(null);
    }
  };

  const baixarSerie = async () => {
    setSalvando("serie");
    try {
      const concluido = situacao === valorConcluidoSucesso(tipoSituacao);
      if (info.origem === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .update({ status: situacao as any })
          .eq("id", info.itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({
            status: situacao,
            concluido_em: concluido ? new Date().toISOString() : null,
          })
          .eq("id", info.itemId);
        if (error) throw error;
      }
      // Baixas individuais deixam de fazer sentido: a série toda foi baixada
      await supabase
        .from("ocorrencias_recorrentes_status")
        .delete()
        .eq("origem", info.origem)
        .eq("item_id", info.itemId);
      setTemBaixa(false);
      await finalizar("Situação aplicada a toda a série recorrente.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aplicar a situação na série.");
    } finally {
      setSalvando(null);
    }
  };

  const reabrirEsta = async () => {
    setSalvando("reabrir");
    try {
      await removerBaixaOcorrencia(info);
      setTemBaixa(false);
      await finalizar(`Baixa de ${dataLabel} removida.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover a baixa.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="border-b bg-muted/40 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Repeat className="w-3.5 h-3.5 text-primary" />
        Item recorrente — baixa da ocorrência de {dataLabel}
        {temBaixa && (
          <span className="ml-1 rounded-full bg-green-600/10 text-green-700 dark:text-green-400 px-2 py-0.5 text-[10px] font-medium">
            baixa individual registrada
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Escolha se a situação vale somente para este dia ou para todas as ocorrências da série.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Situação</Label>
          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label className="text-[11px] text-muted-foreground">Observação (opcional)</Label>
          <Input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: conferido, sem novidades"
            className="h-8 text-xs"
          />
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={baixarSomenteEsta} disabled={!!salvando}>
          {salvando === "esta" ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <CalendarClock className="w-3.5 h-3.5 mr-1" />
          )}
          Somente esta
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={baixarSerie}
          disabled={!!salvando}
        >
          {salvando === "serie" ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Repeat className="w-3.5 h-3.5 mr-1" />
          )}
          Toda a série
        </Button>
        {temBaixa && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={reabrirEsta}
            disabled={!!salvando}
            title="Voltar esta ocorrência à situação da série"
          >
            {salvando === "reabrir" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
            )}
            Reabrir esta
          </Button>
        )}
      </div>
    </div>
  );
}
