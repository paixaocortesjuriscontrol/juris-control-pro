import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  formatarDataDetalhe,
  mesclarPublicacoesItem,
  type PublicacaoDetalheItem,
} from "@/lib/detalheItemResponsabilidade";
import {
  formatConteudoParaExibicao,
  stripHtmlAndDecodeEntities,
} from "@/utils/formatConteudo";
import { cn } from "@/lib/utils";

function PublicacaoCard({ publicacao }: { publicacao: PublicacaoDetalheItem }) {
  const [aberta, setAberta] = useState(publicacao.vinculada_item);
  const conteudo = String(publicacao.conteudo ?? "");
  const resumo = stripHtmlAndDecodeEntities(conteudo).slice(0, 260);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        publicacao.vinculada_item && "border-primary/50",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        onClick={() => setAberta((valor) => !valor)}
        aria-expanded={aberta}
      >
        <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Newspaper className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 space-y-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {String(publicacao.processo_numero ?? "Publicação")}
            </span>
            {publicacao.vinculada_item && <Badge>Origem desta atividade</Badge>}
            {publicacao.lida === false && <Badge variant="secondary">Não lida</Badge>}
            <Badge variant="outline">
              {publicacao.origem_publicacao === "processo" ? "Processo cadastrado" : "Monitoramento DJEN"}
            </Badge>
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Disponibilização: {formatarDataDetalhe(publicacao.data_disponibilizacao)}</span>
            <span>Publicação: {formatarDataDetalhe(publicacao.data_publicacao)}</span>
            <span>Captura: {formatarDataDetalhe(publicacao.created_at, true)}</span>
          </span>
          {(publicacao.fonte || publicacao.tribunal || publicacao.tipo_comunicacao) && (
            <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {[publicacao.fonte, publicacao.tribunal, publicacao.tipo_comunicacao]
                .filter(Boolean)
                .map(String)
                .join(" · ")}
            </span>
          )}
          {!aberta && resumo && (
            <span className="block text-sm leading-relaxed text-muted-foreground">
              {resumo}{stripHtmlAndDecodeEntities(conteudo).length > 260 ? "…" : ""}
            </span>
          )}
        </span>
        {aberta ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {aberta && (
        <div className="border-t bg-muted/10 p-5">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
            {formatConteudoParaExibicao(conteudo)}
          </p>
        </div>
      )}
    </article>
  );
}

interface Props {
  itemId: string;
  processoId?: string | null;
  active: boolean;
}

export function PublicacoesItemResponsabilidade({ itemId, processoId, active }: Props) {
  const { data: publicacoes = [], isLoading, error } = useQuery({
    queryKey: ["minhas-responsabilidades", "publicacoes-item", itemId, processoId],
    enabled: active && !!itemId,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = supabase as any;
      const [vinculosTermo, vinculosProcesso, pubsProcesso] = await Promise.all([
        sb.from("tarefas_publicacoes").select("publicacao_id").eq("tarefa_id", itemId),
        sb.from("tarefas_publicacoes_processos").select("publicacao_processo_id").eq("tarefa_id", itemId),
        processoId
          ? sb.from("publicacoes_djen_processos").select("*").eq("processo_id", processoId).order("data_publicacao", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (vinculosTermo.error) throw vinculosTermo.error;
      if (vinculosProcesso.error) throw vinculosProcesso.error;
      if (pubsProcesso.error) throw pubsProcesso.error;

      const idsTermos = (vinculosTermo.data ?? []).map((row: any) => row.publicacao_id).filter(Boolean);
      const idsProcesso = (vinculosProcesso.data ?? []).map((row: any) => row.publicacao_processo_id).filter(Boolean);
      let pubsTermos: any[] = [];
      if (idsTermos.length > 0) {
        const { data, error: erroTermos } = await sb.from("publicacoes_djen").select("*").in("id", idsTermos);
        if (erroTermos) throw erroTermos;
        pubsTermos = data ?? [];
      }
      return mesclarPublicacoesItem(pubsProcesso.data ?? [], pubsTermos, idsProcesso, idsTermos);
    },
  });

  if (!active) return null;
  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Carregando publicações...</div>;
  }
  if (error) {
    return <div className="m-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar as publicações: {(error as Error).message}</div>;
  }
  if (publicacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <Newspaper className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-medium">Nenhuma publicação vinculada</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">Não há publicações do processo nem uma publicação de origem ligada diretamente a esta atividade.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-semibold">Publicações relacionadas</h3>
          <p className="text-xs text-muted-foreground">A publicação que originou a atividade aparece primeiro.</p>
        </div>
        <Badge variant="secondary">{publicacoes.length} {publicacoes.length === 1 ? "publicação" : "publicações"}</Badge>
      </div>
      {publicacoes.map((publicacao) => (
        <PublicacaoCard key={`${publicacao.origem_publicacao}:${publicacao.id}`} publicacao={publicacao} />
      ))}
    </div>
  );
}
