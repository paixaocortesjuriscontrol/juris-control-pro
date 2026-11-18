import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, ExternalLink, Loader2, Search, Unlink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import { destinoVinculoProcesso, desvincularProcessoComConfirmacao } from "@/lib/vinculoProcessoItem";

export type ProcessoVinculoResumo = {
  id: string;
  numero: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
  reclamante?: string | null;
  reclamados?: string | null;
  autor?: string | null;
  requerido?: string | null;
};

interface Props {
  item: any;
  processoId?: string | null;
  processoNumero?: string | null;
  onVinculoChange: (processo: ProcessoVinculoResumo | null) => void;
  onUpdate: () => void | Promise<void>;
}

/** Gestão do vínculo exclusiva da ficha ampliada de Minhas Responsabilidades. */
export function ProcessoVinculadoItemResponsabilidade({
  item,
  processoId,
  processoNumero,
  onVinculoChange,
  onUpdate,
}: Props) {
  const queryClient = useQueryClient();
  const destino = destinoVinculoProcesso(item);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setConfirmando(false);
    setBusca("");
  }, [item?.id, processoId]);

  const { data: encontrados = [], isFetching } = useQuery({
    queryKey: ["minhas-responsabilidades", "busca-processo-vinculo", busca.trim()],
    enabled: !!destino && !processoId && busca.trim().length >= 3,
    queryFn: async () => {
      const termo = busca.trim().replace(/[%,]/g, " ");
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo, reclamante, reclamados, autor, requerido")
        .or(`numero.ilike.%${termo}%,polo_ativo.ilike.%${termo}%,polo_passivo.ilike.%${termo}%`)
        .order("numero")
        .limit(8);
      if (error) throw error;
      return (data || []) as ProcessoVinculoResumo[];
    },
  });

  const salvarVinculo = async (processo: ProcessoVinculoResumo | null, confirmado = true) => {
    if (!destino) return;
    setSalvando(true);
    try {
      const executar = async () => {
        const { data, error } = await supabase
          .from(destino.tabela)
          .update({ processo_id: processo?.id ?? null })
          .eq("id", destino.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("A atividade não foi encontrada ou você não tem permissão para alterá-la.");
      };

      if (processo) await executar();
      else await desvincularProcessoComConfirmacao(confirmado, executar);

      await invalidarItensAgenda(queryClient, [["minhas-responsabilidades"]]);
      await onUpdate();
      onVinculoChange(processo);
      setConfirmando(false);
      setBusca("");
      toast.success(processo ? "Processo vinculado à atividade" : "Processo desvinculado da atividade");
    } catch (error: any) {
      toast.error("Não foi possível alterar o vínculo", { description: error?.message || String(error) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex-shrink-0 border-b bg-muted/10 p-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Processo vinculado</h3>
            {processoId ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="break-all text-sm text-muted-foreground">{processoNumero || "Número não informado"}</span>
                <a
                  href={`/processos/${encodeURIComponent(processoId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Abrir processo <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Esta atividade não possui processo vinculado.</p>
            )}
          </div>
          {processoId && destino && !confirmando && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmando(true)} disabled={salvando}>
              <Unlink className="mr-2 h-4 w-4" /> Desvincular
            </Button>
          )}
        </div>

        {confirmando && processoId && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3" role="alert">
            <p className="text-sm font-medium">Confirmar desvinculação?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O processo continuará cadastrado, mas deixará de estar ligado a esta atividade. A alteração será salva imediatamente.
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmando(false)} disabled={salvando}>
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => void salvarVinculo(null, true)} disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                Confirmar desvinculação
              </Button>
            </div>
          </div>
        )}

        {!processoId && destino && (
          <div className="mt-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar processo por número ou parte"
                className="pl-9"
                aria-label="Buscar processo para vincular"
              />
            </div>
            {busca.trim().length > 0 && busca.trim().length < 3 && (
              <p className="text-xs text-muted-foreground">Digite pelo menos 3 caracteres.</p>
            )}
            {isFetching && <p className="text-xs text-muted-foreground">Buscando processos...</p>}
            {!isFetching && busca.trim().length >= 3 && encontrados.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum processo encontrado.</p>
            )}
            {encontrados.length > 0 && (
              <div className="divide-y rounded-md border">
                {encontrados.map((processo) => (
                  <button
                    type="button"
                    key={processo.id}
                    className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/50 disabled:opacity-50"
                    onClick={() => void salvarVinculo(processo)}
                    disabled={salvando}
                  >
                    <span className="min-w-0">
                      <span className="block break-all text-sm font-medium">{processo.numero || "Sem número"}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[processo.polo_ativo || processo.reclamante || processo.autor, processo.polo_passivo || processo.reclamados || processo.requerido]
                          .filter(Boolean)
                          .join(" × ") || "Polos não informados"}
                      </span>
                    </span>
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs text-primary">Vincular</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
