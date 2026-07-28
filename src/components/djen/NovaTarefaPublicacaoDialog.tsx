import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatConteudoParaExibicao,
  conteudoDisplayClasses,
} from "@/utils/formatConteudo";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { ensureProcessoFromPublicacao } from "@/lib/ensureProcessoFromPublicacao";
import { formatProcessoNumero } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicacao: PublicacaoUnificada | null;
  defaultProcessoId?: string;
  /**
   * Quando true, renderiza o conteúdo diretamente na página (sem Dialog/modal).
   * Usado na Análise DJEN para esconder a lista e abrir o formulário na mesma tela.
   */
  inline?: boolean;
  /**
   * Se true, ao criar a tarefa a publicação é marcada como lida.
   * Se false (padrão), a publicação NÃO é marcada como lida ao salvar —
   * o usuário deve usar o botão "Salvar e ler" para marcar.
   */
  markAsReadOnCreate?: boolean;
  /**
   * Callback usado pelo botão "Salvar e ler" (secondarySave.onAfterSuccess).
   */
  onMarkAsRead?: () => Promise<void> | void;
  /**
   * Botão "Salvar e fechar" (Análise DJEN). Fecha o wrapper após salvar.
   */
  tertiarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  /**
   * Chamado após criar a tarefa. Alimenta o card verde "Itens criados a
   * partir desta publicação" na Análise DJEN.
   */
  onAfterCreate?: (info: { id: string; titulo: string }) => void;
}

/**
 * Wrapper para criar tarefa a partir de uma publicação DJEN reutilizando
 * exatamente o mesmo NovaTarefaDialog usado no Painel de Controle.
 * Toda a lógica de coordenação (filtragem por usuário logado + obrigatoriedade
 * para admin/multi-coordenação) fica no próprio NovaTarefaDialog.
 */
export function NovaTarefaPublicacaoDialog({
  open,
  onOpenChange,
  publicacao,
  defaultProcessoId,
  inline = false,
  markAsReadOnCreate = false,
  onMarkAsRead,
  tertiarySave,
  onAfterCreate,
}: Props) {
  const hasPublicacao = !!publicacao;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [processoPre, setProcessoPre] = useState<{ id: string; numero: string } | null>(null);

  // Lista todas as coordenações (o NovaTarefaDialog filtra internamente via hook)
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["nova-tarefa-publicacao-coordenacoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      return (data || []) as Array<{ id: string; nome: string; area: string }>;
    },
    enabled: open,
  });

  // Resolve processo pré-selecionado a partir de defaultProcessoId ou da publicação
  useEffect(() => {
    if (!open) {
      setProcessoPre(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const id = defaultProcessoId || publicacao?.processo_id || null;
      const numero = publicacao?.processo_numero || "";
      // Sem publicação — comportamento original.
      if (!publicacao) {
        if (id || numero) setProcessoPre({ id: id || "", numero });
        else setProcessoPre(null);
        return;
      }
      // Já temos id: usar direto (mascarado)
      if (id) {
        setProcessoPre({ id, numero: formatProcessoNumero(numero) || numero });
        return;
      }
      // Não temos id: garantir criação/vínculo do processo a partir da publicação
      if (numero && user?.id) {
        try {
          const proc = await ensureProcessoFromPublicacao(
            publicacao,
            user.id,
            null,
            publicacao.coordenacao_id || null,
          );
          if (cancelled) return;
          if (proc?.id) {
            setProcessoPre({ id: proc.id, numero: formatProcessoNumero(proc.numero) || proc.numero });
            return;
          }
        } catch (err) {
          console.error("[NovaTarefaPub] ensureProcesso falhou:", err);
        }
      }
      setProcessoPre(numero ? { id: "", numero: formatProcessoNumero(numero) || numero } : null);
    })();
    return () => { cancelled = true; };
  }, [open, defaultProcessoId, publicacao?.id, publicacao?.processo_id, publicacao?.processo_numero, user?.id]);

  const handleCreated = async (tarefaId: string) => {
    if (!publicacao) return;
    const tipoLeitura = publicacao.tipo_origem === "processo"
      ? "processo"
      : publicacao.tipo_origem === "descartada"
        ? "descartada"
        : "termo";
    try {
      if (publicacao.tipo_origem === "termo") {
        const { error: vErr } = await supabase
          .from("tarefas_publicacoes")
          .insert({ tarefa_id: tarefaId, publicacao_id: publicacao.id });
        if (vErr) console.error("[NovaTarefaPub] vincular termo:", vErr);
        if (markAsReadOnCreate) {
          const { error: uErr } = await supabase
            .from("publicacoes_djen")
            .update({ lida: true })
            .eq("id", publicacao.id);
          if (uErr) console.error("[NovaTarefaPub] update publicacoes_djen.lida:", uErr);
        }
      } else if (publicacao.tipo_origem === "processo") {
        const { error: vErr } = await supabase
          .from("tarefas_publicacoes_processos")
          .insert({ tarefa_id: tarefaId, publicacao_processo_id: publicacao.id });
        if (vErr) console.error("[NovaTarefaPub] vincular processo:", vErr);
        if (markAsReadOnCreate) {
          const { error: uErr, data: uData } = await supabase
            .from("publicacoes_djen_processos")
            .update({ lida: true })
            .eq("id", publicacao.id)
            .select("id");
          if (uErr) console.error("[NovaTarefaPub] update publicacoes_djen_processos.lida:", uErr);
          else console.log("[NovaTarefaPub] marcado como lida:", uData);
        }
      }

      if (user?.id && markAsReadOnCreate) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", user.id)
          .maybeSingle();

        const leiturasMap = new Map<string, "termo" | "processo" | "descartada">();
        leiturasMap.set(publicacao.id, tipoLeitura);

        try {
          const { data: relacionadas, error: relErr } = await (supabase as any).rpc(
            "get_publicacoes_relacionadas_por_dedup",
            {
              p_ids_termos: tipoLeitura === "termo" ? [publicacao.id] : null,
              p_ids_processos: tipoLeitura === "processo" ? [publicacao.id] : null,
              p_ids_descartadas: tipoLeitura === "descartada" ? [publicacao.id] : null,
            }
          );
          if (!relErr && Array.isArray(relacionadas)) {
            relacionadas.forEach((r: any) => {
              if (
                r?.publicacao_id &&
                (r.tabela_origem === "termo" || r.tabela_origem === "processo" || r.tabela_origem === "descartada")
              ) {
                leiturasMap.set(r.publicacao_id, r.tabela_origem);
              }
            });
          }
        } catch (err) {
          console.warn("[NovaTarefaPub] expansão de leituras ignorada:", err);
        }

        const rows = Array.from(leiturasMap.entries()).map(([publicacao_id, tabela_origem]) => ({
          publicacao_id,
          tabela_origem,
          usuario_id: user.id,
          usuario_nome: profile?.nome || user.email || "Desconhecido",
        }));

        const { error: lErr } = await (supabase as any)
          .from("publicacoes_djen_leituras")
          .upsert(rows, { onConflict: "publicacao_id,tabela_origem,usuario_id" });
        if (lErr) console.error("[NovaTarefaPub] upsert leitura:", lErr);
      }

      await supabase
        .from("tarefas")
        .update({ origem: "analise_djen" } as any)
        .eq("id", tarefaId);
    } catch (err) {
      console.error("Erro ao vincular tarefa à publicação:", err);
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas-servidor"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-unificadas-stats-header"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-djen"] }),
        queryClient.invalidateQueries({ queryKey: ["publicacoes-djen-processo"] }),
        queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-termo"] }),
        queryClient.invalidateQueries({ queryKey: ["tarefas-publicacao-processo"] }),
        queryClient.invalidateQueries({ queryKey: ["notificacoes-counts"] }),
      ]);
      queryClient.refetchQueries({ queryKey: ["publicacoes-djen-processo"] });
    }
  };

  const body = (
    <div
          className={cn(
            "flex flex-1 min-h-0 overflow-hidden",
            hasPublicacao ? "flex-col lg:flex-row" : "flex-col"
          )}
        >
          {hasPublicacao && (
            <div className="hidden lg:flex flex-1 border-r flex-col min-h-0">
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Publicação
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {publicacao?.processo_numero && (
                    <div className="font-mono text-xs">{aplicarMascaraCnj(publicacao.processo_numero)}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {(publicacao as any)?.data_disponibilizacao && (
                      <span>
                        Disponibilização:{" "}
                        {formatDateOnlyFull((publicacao as any).data_disponibilizacao)}
                      </span>
                    )}
                    {publicacao?.data_publicacao && (
                      <span>
                        Publicação: {formatDateOnlyFull(publicacao.data_publicacao)}
                      </span>
                    )}
                    {publicacao?.tribunal && (
                      <Badge variant="outline">{publicacao.tribunal}</Badge>
                    )}
                    {publicacao?.tipo_comunicacao && (
                      <Badge variant="outline">{publicacao.tipo_comunicacao}</Badge>
                    )}
                  </div>
                  {(publicacao?.polo_ativo || publicacao?.polo_passivo) && (
                    <div className="text-xs text-muted-foreground pt-1">
                      {publicacao?.polo_ativo}{" "}
                      {publicacao?.polo_passivo ? `× ${publicacao.polo_passivo}` : ""}
                    </div>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className={cn("text-sm", conteudoDisplayClasses)}>
                  {formatConteudoParaExibicao(publicacao?.conteudo || "")}
                </div>
              </ScrollArea>
            </div>
          )}

          <div
            className={cn(
              "flex flex-col min-h-0",
              hasPublicacao ? "w-full lg:w-[560px] bg-background" : "flex-1"
            )}
          >
            <NovaTarefaDialog
              inline
              open={open}
              onOpenChange={onOpenChange}
              coordenacoes={coordenacoes}
              processoPreSelecionado={processoPre}
              publicacao={publicacao}
              onCreated={handleCreated}
              secondarySave={
                onMarkAsRead
                  ? { label: "Salvar e ler", onAfterSuccess: async () => { await onMarkAsRead(); } }
                  : undefined
              }
              tertiarySave={tertiarySave}
              onAfterCreate={onAfterCreate}
            />
          </div>
    </div>
  );

  if (inline) {
    if (!open) return null;
    return (
      <div className="rounded-md border bg-background overflow-hidden flex flex-col min-h-[70vh] max-h-[calc(100vh-12rem)]">
        {body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden flex flex-col",
          hasPublicacao ? "max-w-5xl w-[95vw] h-[90vh]" : "max-w-2xl max-h-[90vh]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}