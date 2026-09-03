import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, Loader2, Repeat, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  situacoesDisponiveis,
  valorConcluidoSucesso,
  type TipoSituacaoItem,
} from "@/constants/situacoesItem";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import {
  buscarBaixaOcorrencia,
  dadosOcorrencia,
  parseOcorrenciaId,
  removerBaixaOcorrencia,
  salvarBaixaOcorrencia,
} from "@/lib/baixaOcorrencia";
import { toast } from "sonner";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

interface Props {
  item: ItemAgendaUnificado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

/**
 * Pop-up de baixa rápida (estilo Ástrea): permite dar baixa na pendência
 * direto da tela principal, sem abrir o formulário completo.
 * - Item recorrente: escolhe entre "Somente esta ocorrência" e "Toda a série".
 * - Item comum: atualiza a situação do registro.
 * O comentário da mudança de situação vai para o histórico do item.
 */
export function BaixaRapidaDialog({ item, open, onOpenChange, onUpdate }: Props) {
  const { user } = useAuth();
  const { isAdmin, role } = useUserRole();
  const queryClient = useQueryClient();

  const tipoSituacao: TipoSituacaoItem = item
    ? item.tipo === "prazo"
      ? "prazo"
      : item.origem === "tarefa"
        ? "tarefa"
        : "evento"
    : "tarefa";

  const { podeUsarSituacao, situacaoAtiva, comentarioObrigatorio } = usePermissoesSituacao();

  const [situacao, setSituacao] = useState<string>("");
  const [situacaoInicial, setSituacaoInicial] = useState<string>("");
  const [comentario, setComentario] = useState("");
  const [dataCumprimento, setDataCumprimento] = useState("");
  const [temBaixa, setTemBaixa] = useState(false);
  const [salvando, setSalvando] = useState<"esta" | "serie" | "reabrir" | null>(null);

  const info = item ? dadosOcorrencia(item) : null;
  const recorrente = !!info;

  useEffect(() => {
    if (!open || !item) return;
    const atual = item.status || "pendente";
    setSituacao(atual);
    setSituacaoInicial(atual);
    setComentario("");
    setDataCumprimento(format(new Date(), "yyyy-MM-dd"));
    setTemBaixa(!!(item as any).baixa_individual);
    if (!info) return;
    let cancelado = false;
    (async () => {
      const baixa = await buscarBaixaOcorrencia(info);
      if (cancelado || !baixa) return;
      setTemBaixa(true);
      setSituacao(baixa.status);
      setComentario(baixa.observacao ?? "");
    })();
    return () => {
      cancelado = true;
    };
  }, [open, item?.id]);

  if (!item) return null;

  const podeGerenciar = isAdmin || role === "coordenador" || role === "assistente_coordenador";
  const opcoes = situacoesDisponiveis(tipoSituacao, { podeGerenciar, atual: situacao }).filter(
    (s) => s.value === situacao || (situacaoAtiva(s.value) && podeUsarSituacao(s.value)),
  );

  const dataLabel = info
    ? format(parseISO(`${info.dataOcorrencia}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })
    : item.data_inicio
      ? format(new Date(item.data_inicio), "dd/MM/yyyy", { locale: ptBR })
      : "";

  const situacaoMudou = situacao !== situacaoInicial;

  const finalizar = async (msg: string) => {
    await invalidarItensAgenda(queryClient);
    toast.success(msg);
    onUpdate?.();
    onOpenChange(false);
  };

  const validar = () => {
    if (!situacao) {
      toast.error("Escolha a situação.");
      return false;
    }
    if (situacaoMudou && comentarioObrigatorio && !comentario.trim()) {
      toast.error("O comentário da mudança de situação é obrigatório.");
      return false;
    }
    return true;
  };

  const gravarComentario = async (tarefaId: string) => {
    if (!comentario.trim() || !user?.id) return;
    const { error } = await supabase.from("comentarios_tarefas").insert({
      tarefa_id: tarefaId,
      autor_id: user.id,
      conteudo: `[Situação: ${situacaoInicial} → ${situacao}] ${comentario.trim()}`,
    });
    if (error) console.error("Falha ao gravar comentário da situação:", error);
  };

  const baixarSomenteEsta = async () => {
    if (!info || !validar()) return;
    setSalvando("esta");
    try {
      await salvarBaixaOcorrencia({
        origem: info.origem,
        itemId: info.itemId,
        dataOcorrencia: info.dataOcorrencia,
        status: situacao,
        observacao: comentario.trim() || null,
        userId: user?.id ?? null,
      });
      await finalizar(`Situação aplicada somente à ocorrência de ${dataLabel}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aplicar a situação nesta ocorrência.");
    } finally {
      setSalvando(null);
    }
  };

  const baixarItem = async () => {
    if (!validar()) return;
    setSalvando("serie");
    try {
      const concluido = situacao === valorConcluidoSucesso(tipoSituacao);
      const rawId = info?.itemId ?? parseOcorrenciaId(String(item.id)).rawId;
      const concluidoEm = concluido
        ? new Date(`${dataCumprimento || format(new Date(), "yyyy-MM-dd")}T12:00:00`).toISOString()
        : null;

      if ((info?.origem ?? item.origem) === "tarefa") {
        const { error } = await supabase
          .from("tarefas")
          .update({ status: situacao as any, concluido_em: concluidoEm } as any)
          .eq("id", rawId);
        if (error) throw error;
        await gravarComentario(rawId);
      } else {
        const { error } = await supabase
          .from("eventos_agenda")
          .update({ status: situacao, concluido_em: concluidoEm })
          .eq("id", rawId);
        if (error) throw error;
      }

      if (recorrente) {
        await supabase
          .from("ocorrencias_recorrentes_status")
          .delete()
          .eq("origem", info!.origem)
          .eq("item_id", info!.itemId);
      }
      await finalizar(recorrente ? "Situação aplicada a toda a série." : "Baixa registrada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar a baixa.");
    } finally {
      setSalvando(null);
    }
  };

  const reabrirEsta = async () => {
    if (!info) return;
    setSalvando("reabrir");
    try {
      await removerBaixaOcorrencia(info);
      await finalizar(`Situação de ${dataLabel} voltou a seguir a série.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover a baixa.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Dar baixa
            {recorrente && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Repeat className="w-3 h-3" /> recorrente
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {item.titulo || "Item sem título"}
            {dataLabel ? ` — ${dataLabel}` : ""}
            {item.processo?.numero ? ` · ${item.processo.numero}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Situação</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione a situação" />
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

          <div className="space-y-1">
            <Label className="text-xs">Data do cumprimento</Label>
            <Input
              type="date"
              value={dataCumprimento}
              onChange={(e) => setDataCumprimento(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Comentário{comentarioObrigatorio ? " (obrigatório)" : " (opcional)"}
            </Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ex.: protocolado no PJe às 14h32"
              rows={3}
              className="text-sm"
            />
          </div>

          {recorrente && (
            <p className="text-[11px] text-muted-foreground">
              Este item se repete. "Somente esta" registra a baixa apenas em {dataLabel};
              "Toda a série" altera a situação de todas as ocorrências.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {recorrente && temBaixa && (
              <Button variant="ghost" size="sm" onClick={reabrirEsta} disabled={!!salvando}>
                {salvando === "reabrir" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                )}
                Reabrir esta
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={!!salvando}>
              Cancelar
            </Button>
            {recorrente && (
              <Button size="sm" onClick={baixarSomenteEsta} disabled={!!salvando}>
                {salvando === "esta" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CalendarClock className="w-3.5 h-3.5 mr-1" />
                )}
                Somente esta
              </Button>
            )}
            <Button
              size="sm"
              variant={recorrente ? "outline" : "default"}
              onClick={baixarItem}
              disabled={!!salvando}
            >
              {salvando === "serie" ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : recorrente ? (
                <Repeat className="w-3.5 h-3.5 mr-1" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              )}
              {recorrente ? "Toda a série" : "Dar baixa"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
