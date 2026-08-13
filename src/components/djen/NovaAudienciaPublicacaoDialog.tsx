import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Gavel } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatDateOnlyFull } from "@/utils/formatConteudo";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { BotaoPreencherIA } from "@/components/tarefas/BotaoPreencherIA";
import { AudienciaFormSimplificado } from "@/components/audiencias/AudienciaFormSimplificado";
import { ensureProcessoFromPublicacao } from "@/lib/ensureProcessoFromPublicacao";
import { useAuth } from "@/contexts/AuthContext";

interface NovaAudienciaPublicacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicacao: PublicacaoUnificada | null;
  defaultProcessoNumero?: string;
  defaultProcessoId?: string;
  inline?: boolean;
  onMarkAsRead?: () => Promise<void> | void;
  tertiarySave?: {
    label: string;
    onAfterSuccess: () => Promise<void> | void;
  };
  onAfterCreate?: (info: { id: string; titulo: string }) => void;
}

export function NovaAudienciaPublicacaoDialog({
  open,
  onOpenChange,
  publicacao,
  defaultProcessoNumero,
  defaultProcessoId,
  inline = false,
  onMarkAsRead,
  tertiarySave,
  onAfterCreate,
}: NovaAudienciaPublicacaoDialogProps) {
  const hasPublicacao = !!publicacao;
  const { user } = useAuth();
  const [aiDefaults, setAiDefaults] = useState<{
    titulo?: string;
    observacoes?: string;
    data_audiencia?: string;
  } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [resolvedProcessoId, setResolvedProcessoId] = useState<string | undefined>(defaultProcessoId);
  const [resolvedProcessoNumero, setResolvedProcessoNumero] = useState<string | undefined>(defaultProcessoNumero);

  useEffect(() => {
    if (!open) {
      setAiDefaults(null);
      setFormKey(0);
      setResolvedProcessoId(defaultProcessoId);
      setResolvedProcessoNumero(defaultProcessoNumero);
    }
  }, [open]);

  // Ao abrir com uma publicação, garantir que o processo esteja cadastrado e vinculado
  useEffect(() => {
    if (!open || !publicacao || !user?.id) return;
    if (resolvedProcessoId) return;
    let cancelled = false;
    (async () => {
      try {
        const proc = await ensureProcessoFromPublicacao(
          publicacao,
          user.id,
          null,
          publicacao.coordenacao_id || null,
        );
        if (cancelled) return;
        if (proc?.id) {
          setResolvedProcessoId(proc.id);
          setResolvedProcessoNumero(proc.numero);
          setFormKey((k) => k + 1);
        }
      } catch (err) {
        console.error("[NovaAudienciaPub] ensureProcesso falhou:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, publicacao?.id, user?.id, resolvedProcessoId]);

  const secondarySave = onMarkAsRead
    ? { label: "Salvar e ler", onAfterSuccess: async () => { await onMarkAsRead(); } }
    : undefined;

  const body = (
    <div className={cn("flex flex-1 min-h-0 overflow-hidden", hasPublicacao ? "flex-col lg:flex-row" : "flex-col")}>
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
                        Disponibilização: {formatDateOnlyFull((publicacao as any).data_disponibilizacao)}
                      </span>
                    )}
                    {publicacao?.data_publicacao && (
                      <span>
                        Publicação: {formatDateOnlyFull(publicacao.data_publicacao)}
                      </span>
                    )}
                    {publicacao?.tribunal && <Badge variant="outline">{publicacao.tribunal}</Badge>}
                    {publicacao?.tipo_comunicacao && <Badge variant="outline">{publicacao.tipo_comunicacao}</Badge>}
                  </div>
                  {(publicacao?.polo_ativo || publicacao?.polo_passivo) && (
                    <div className="text-xs text-muted-foreground pt-1">
                      {publicacao?.polo_ativo} {publicacao?.polo_passivo ? `× ${publicacao.polo_passivo}` : ""}
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

          <div className={cn("flex flex-col min-h-0", hasPublicacao ? "w-full lg:w-[540px] bg-background" : "flex-1")}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 border-b">
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
                <Gavel className="h-4 w-4" /> Nova Audiência
              </h3>
              {hasPublicacao && (
                <BotaoPreencherIA
                  conteudo={publicacao?.conteudo}
                  tipoTarefa="AUDIÊNCIA"
                  processoNumero={publicacao?.processo_numero}
                  dataPublicacao={publicacao?.data_publicacao}
                  size="sm"
                  onResultado={(resultado) => {
                    setAiDefaults({
                      titulo: resultado.titulo,
                      observacoes: [resultado.descricao, resultado.observacoes].filter(Boolean).join("\n\n"),
                      data_audiencia: resultado.data_vencimento,
                    });
                    setFormKey((k) => k + 1);
                  }}
                />
              )}
            </div>
            <ScrollArea className="flex-1 p-5">
              <AudienciaFormSimplificado
                key={`${resolvedProcessoNumero ?? defaultProcessoNumero ?? "novo"}-${resolvedProcessoId ?? ""}-${formKey}`}
                defaultProcessoNumero={resolvedProcessoNumero ?? defaultProcessoNumero}
                defaultProcessoId={resolvedProcessoId ?? defaultProcessoId}
                showProcessoField={!hasPublicacao}
                defaultTitulo={aiDefaults?.titulo}
                defaultObservacoes={aiDefaults?.observacoes}
                defaultDataAudiencia={aiDefaults?.data_audiencia}
                publicacaoId={publicacao?.id}
                publicacaoTipoOrigem={publicacao?.tipo_origem}
                publicacaoConteudo={publicacao?.conteudo}
                publicacaoDataBase={
                  (publicacao as any)?.data_publicacao ||
                  (publicacao as any)?.data_disponibilizacao ||
                  null
                }
                resolveProcessoBeforeSubmit={publicacao && user?.id ? async () => {
                  const proc = await ensureProcessoFromPublicacao(
                    publicacao,
                    user.id,
                    null,
                    publicacao.coordenacao_id || null,
                  );
                  if (proc?.id) {
                    setResolvedProcessoId(proc.id);
                    setResolvedProcessoNumero(proc.numero);
                  }
                  return proc;
                } : undefined}
                hideTitleHeader
                onSuccess={() => onOpenChange(false)}
                secondarySave={secondarySave}
                tertiarySave={tertiarySave}
                onAfterCreate={onAfterCreate}
              />
            </ScrollArea>
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
          hasPublicacao ? "max-w-5xl w-[95vw] h-[90vh]" : "max-w-3xl max-h-[90vh]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Nova Audiência</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}