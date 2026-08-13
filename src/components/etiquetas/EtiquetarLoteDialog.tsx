import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tag, Loader2, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useEtiquetas,
  moduloDaEntidade,
  type EtiquetaEntidade,
} from "@/hooks/useEtiquetas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entidade: EtiquetaEntidade;
  /** Ids das entidades selecionadas que receberão as etiquetas. */
  entidadeIds: string[];
  /** Coordenação usada para filtrar o catálogo (opcional). */
  coordenacaoId?: string | null;
  coordenacaoNome?: string | null;
}

const LOTE = 200;

/**
 * Aplica (ou remove) etiquetas em lote para várias entidades selecionadas.
 * Usado na Análise DJEN para etiquetar publicações selecionadas de uma vez.
 */
export function EtiquetarLoteDialog({
  open,
  onOpenChange,
  entidade,
  entidadeIds,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const modulo = moduloDaEntidade(entidade);
  const { data: catalogo = [], isLoading } = useEtiquetas(coordenacaoId ?? undefined, modulo);
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    if (open) {
      setMarcadas(new Set());
      setBusca("");
      setProgresso(0);
    }
  }, [open]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? catalogo.filter((e) => e.nome.toLowerCase().includes(q)) : catalogo;
  }, [catalogo, busca]);

  const toggleMarcada = (id: string, checked: boolean) => {
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const executar = async (acao: "aplicar" | "remover") => {
    const etiquetaIds = Array.from(marcadas);
    if (etiquetaIds.length === 0) {
      toast.error("Selecione pelo menos uma etiqueta.");
      return;
    }
    if (entidadeIds.length === 0) {
      toast.error("Nenhum item selecionado.");
      return;
    }
    try {
      setProcessando(true);
      setProgresso(0);
      const { data: userData } = await supabase.auth.getUser();
      const criadoPor = userData.user?.id ?? null;

      if (acao === "aplicar") {
        // Monta todos os vínculos e grava em lotes, ignorando os já existentes.
        const rows = entidadeIds.flatMap((entidadeId) =>
          etiquetaIds.map((etiquetaId) => ({
            etiqueta_id: etiquetaId,
            entidade,
            entidade_id: entidadeId,
            created_by: criadoPor,
          })),
        );
        for (let i = 0; i < rows.length; i += LOTE) {
          const slice = rows.slice(i, i + LOTE);
          const { error } = await (supabase as any)
            .from("etiquetas_itens")
            .upsert(slice, { onConflict: "etiqueta_id,entidade,entidade_id", ignoreDuplicates: true });
          if (error) throw error;
          setProgresso(Math.round(((i + slice.length) / rows.length) * 100));
        }
        toast.success(
          `${etiquetaIds.length} etiqueta(s) aplicada(s) em ${entidadeIds.length} item(ns).`,
        );
      } else {
        for (let i = 0; i < entidadeIds.length; i += LOTE) {
          const slice = entidadeIds.slice(i, i + LOTE);
          const { error } = await supabase
            .from("etiquetas_itens")
            .delete()
            .eq("entidade", entidade)
            .in("entidade_id", slice)
            .in("etiqueta_id", etiquetaIds);
          if (error) throw error;
          setProgresso(Math.round(((i + slice.length) / entidadeIds.length) * 100));
        }
        toast.success(
          `${etiquetaIds.length} etiqueta(s) removida(s) de ${entidadeIds.length} item(ns).`,
        );
      }

      await qc.invalidateQueries({ queryKey: ["etiquetas-itens"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro ao etiquetar em lote: ${e?.message || e}`);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !processando && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4" /> Etiquetar selecionadas
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            {entidadeIds.length} item(ns) selecionado(s)
            {coordenacaoNome ? ` — ${coordenacaoNome}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar etiqueta..."
          className="h-8 text-xs"
        />

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2 space-y-1">
            <p>
              Nenhuma etiqueta cadastrada para este módulo
              {coordenacaoNome ? ` na coordenação ${coordenacaoNome}` : ""}.
            </p>
            <Link to="/etiquetas" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Plus className="w-3 h-3" /> Gerenciar etiquetas
            </Link>
          </div>
        ) : (
          <div className="max-h-64 overflow-auto space-y-1">
            {filtradas.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/60 cursor-pointer"
              >
                <Checkbox
                  checked={marcadas.has(e.id)}
                  disabled={processando}
                  onCheckedChange={(v) => toggleMarcada(e.id, !!v)}
                />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.cor }} />
                <span className="truncate">{e.nome}</span>
              </label>
            ))}
          </div>
        )}

        {processando && (
          <div className="space-y-1">
            <Progress value={progresso} className="h-2" />
            <p className="text-[11px] text-muted-foreground text-center">{progresso}%</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            disabled={processando || marcadas.size === 0}
            onClick={() => executar("remover")}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover das selecionadas
          </Button>
          <Button
            size="sm"
            disabled={processando || marcadas.size === 0}
            onClick={() => executar("aplicar")}
          >
            {processando ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Tag className="w-3.5 h-3.5 mr-1" />
            )}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
