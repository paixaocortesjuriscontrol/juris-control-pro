import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PublicacaoLike {
  id?: string;
  processo_numero?: string | null;
  data_publicacao?: string | null;
  data_disponibilizacao?: string | null;
  tribunal?: string | null;
  tipo_comunicacao?: string | null;
  conteudo?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
}

interface Props {
  publicacao: PublicacaoLike | null | undefined;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Card verde retrátil exibindo a publicação DJEN vinculada.
 * Recebe o objeto da publicação diretamente (não consulta o banco).
 */
export function PublicacaoVinculadaCollapsible({ publicacao, className, defaultOpen = false }: Props) {
  const [aberto, setAberto] = useState(defaultOpen);
  const navigate = useNavigate();

  if (!publicacao) return null;

  const numeroProcesso = publicacao.processo_numero || "";
  const numeroMascarado = numeroProcesso ? aplicarMascaraCnj(numeroProcesso) : "";
  const dataRef = publicacao.data_publicacao || publicacao.data_disponibilizacao || null;

  const irParaProcesso = async () => {
    if (!numeroProcesso) return;
    const digits = numeroProcesso.replace(/\D/g, "");
    const candidatos = Array.from(new Set([numeroMascarado, numeroProcesso, digits].filter(Boolean)));
    const orExpr = candidatos.map((c) => `numero.ilike.%${c}%`).join(",");
    const { data } = await supabase
      .from("processos")
      .select("id")
      .or(orExpr)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      navigate(`/processos/${data.id}`);
    } else {
      toast.error("Processo não encontrado em Processos e Casos");
    }
  };

  return (
    <div className={cn("border border-emerald-300 rounded-lg overflow-hidden bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800", className)}>
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              Publicação DJEN vinculada
            </span>
            {publicacao.tribunal && (
              <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-800 dark:text-emerald-300">
                {publicacao.tribunal}
              </Badge>
            )}
            {dataRef && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400">
                Pub. {format(parseISO(dataRef), "dd/MM/yyyy", { locale: ptBR })}
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
            {(publicacao.polo_ativo || publicacao.polo_passivo) && (
              <div className="text-xs text-muted-foreground">
                {publicacao.polo_ativo}
                {publicacao.polo_passivo ? ` × ${publicacao.polo_passivo}` : ""}
              </div>
            )}
            <div className={cn("text-sm", conteudoDisplayClasses)}>
              {formatConteudoParaExibicao(publicacao.conteudo || "").replace(
                /\b\d{20}\b/g,
                (m) => aplicarMascaraCnj(m),
              )}
            </div>
            {numeroProcesso && (
              <div className="flex items-center gap-2 pt-1 border-t border-emerald-200 dark:border-emerald-800 mt-2">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Processo:</span>
                <span className="font-mono text-xs">{numeroMascarado}</span>
                <CopyButton value={numeroMascarado} label="número do processo" />
                <button
                  type="button"
                  onClick={irParaProcesso}
                  title="Abrir em Processos e Casos"
                  className="inline-flex items-center justify-center rounded p-0.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}