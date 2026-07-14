import { FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import {
  formatConteudoParaExibicao,
  conteudoDisplayClasses,
} from "@/utils/formatConteudo";

interface PublicacaoSidePanelProps {
  publicacao: any;
  className?: string;
}

/**
 * Painel lateral que exibe os metadados e o conteúdo integral de uma publicação
 * DJEN. Reutilizado pelos formulários "inline" da Análise DJEN (Tarefa/Prazo/
 * Evento) para manter o layout lado-a-lado.
 */
export function PublicacaoSidePanel({ publicacao, className }: PublicacaoSidePanelProps) {
  if (!publicacao) return null;
  return (
    <div className={cn("hidden lg:flex flex-1 border-r flex-col min-h-0", className)}>
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Publicação
          </span>
        </div>
        <div className="space-y-1 text-sm">
          {publicacao?.processo_numero && (
            <div className="font-mono text-xs">
              {aplicarMascaraCnj(publicacao.processo_numero)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {publicacao?.data_publicacao && (
              <span>
                Publicado em{" "}
                {format(parseISO(publicacao.data_publicacao), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
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
  );
}