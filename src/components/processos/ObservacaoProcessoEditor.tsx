import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { criarAtualizacaoObservacaoProcesso } from "@/lib/observacaoProcesso";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  processoId: string;
  onSaved?: (observacao: string | null) => void;
  autoFocus?: boolean;
}

/** Editor compartilhado pela ficha, pelo resumo lateral e pela Análise DJEN. */
export function ObservacaoProcessoEditor({ processoId, onSaved, autoFocus = false }: Props) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");
  const [textoSalvo, setTextoSalvo] = useState("");
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { data: observacaoAtual, isLoading } = useQuery({
    queryKey: ["processo-observacao-advogado", processoId],
    enabled: !!processoId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("observacao_advogado")
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return data?.observacao_advogado || "";
    },
  });

  useEffect(() => {
    if (observacaoAtual !== undefined && !alterado) {
      setTexto(observacaoAtual);
      setTextoSalvo(observacaoAtual);
    }
  }, [processoId, alterado, observacaoAtual]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const payload = criarAtualizacaoObservacaoProcesso(texto);
      const { data, error } = await supabase
        .from("processos")
        .update(payload)
        .eq("id", processoId)
        .select("id, observacao_advogado")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Nenhuma alteração foi gravada. Verifique sua permissão para editar este processo.");

      const valorSalvo = data.observacao_advogado || "";
      setTexto(valorSalvo);
      setTextoSalvo(valorSalvo);
      setAlterado(false);
      queryClient.setQueryData(["processo-observacao-advogado", processoId], valorSalvo);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["processo"] }),
        queryClient.invalidateQueries({ queryKey: ["processos"] }),
        queryClient.invalidateQueries({ queryKey: ["processos-paginados"] }),
        queryClient.invalidateQueries({ queryKey: ["processo-lateral-resumo", processoId] }),
      ]);
      toast.success("Observação do processo salva com sucesso.");
      onSaved?.(data.observacao_advogado);
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : "tente novamente.";
      toast.error("Erro ao salvar observação: " + mensagem);
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando observação...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={texto}
        autoFocus={autoFocus}
        rows={6}
        className="min-h-[140px] resize-y text-sm"
        placeholder="Registre uma observação sobre este processo..."
        onChange={(event) => {
          setTexto(event.target.value);
          setAlterado(true);
        }}
        disabled={salvando}
        aria-label="Observação do advogado"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Este texto aparece na ficha e no resumo lateral do processo.
        </p>
        <div className="flex items-center gap-2">
          {alterado && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={salvando}
              onClick={() => {
                setTexto(textoSalvo);
                setAlterado(false);
              }}
            >
              Cancelar
            </Button>
          )}
          <Button type="button" size="sm" onClick={salvar} disabled={salvando || !alterado}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar observação
          </Button>
        </div>
      </div>
    </div>
  );
}
