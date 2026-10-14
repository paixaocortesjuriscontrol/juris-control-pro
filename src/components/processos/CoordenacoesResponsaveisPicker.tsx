import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useProcessoCoordenacoes,
  useSetProcessoCoordenacoes,
} from "@/hooks/useProcessoCoordenacoes";

interface Props {
  processoId?: string | null;
  /** Coordenação de origem do processo, sempre mantida na lista. */
  coordenacaoPrincipalId?: string | null;
  /** Chamado quando a coordenação principal é retirada (nova principal ou null). */
  onPrincipalChange?: (novaPrincipalId: string | null) => void;
}

/**
 * Um processo pode ter mais de uma coordenação responsável. A visualização do
 * processo é livre para todas as coordenações — aqui define-se apenas quem
 * responde por ele.
 */
export function CoordenacoesResponsaveisPicker({ processoId, coordenacaoPrincipalId, onPrincipalChange }: Props) {
  const [open, setOpen] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const { data: vinculos = [], isLoading } = useProcessoCoordenacoes(processoId);
  const setCoordenacoes = useSetProcessoCoordenacoes(processoId);

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-todas-picker"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const ids = vinculos.map((v) => v.coordenacao_id);
    if (coordenacaoPrincipalId && !ids.includes(coordenacaoPrincipalId)) {
      ids.push(coordenacaoPrincipalId);
    }
    setSelecionadas(ids);
  }, [JSON.stringify(vinculos), coordenacaoPrincipalId]);

  const nomePorId = useMemo(
    () => new Map((coordenacoes as any[]).map((c) => [c.id as string, c.nome as string])),
    [coordenacoes]
  );

  const toggle = async (coordenacaoId: string) => {
    if (!processoId) {
      toast.info("Salve o processo antes de definir as coordenações responsáveis.");
      return;
    }
    const novas = selecionadas.includes(coordenacaoId)
      ? selecionadas.filter((c) => c !== coordenacaoId)
      : [...selecionadas, coordenacaoId];
    const removendoPrincipal =
      !!coordenacaoPrincipalId && coordenacaoId === coordenacaoPrincipalId && !novas.includes(coordenacaoId);
    if (removendoPrincipal) {
      const nome = nomePorId.get(coordenacaoId) || "esta coordenação";
      if (!window.confirm(`Retirar ${nome} como responsável por este processo?`)) return;
    }
    setSelecionadas(novas);
    try {
      if (removendoPrincipal) {
        const nova = novas[0] ?? null;
        const { error } = await supabase
          .from("processos")
          .update({ coordenacao_id: nova } as any)
          .eq("id", processoId);
        if (error) throw error;
        onPrincipalChange?.(nova);
      }
      await setCoordenacoes.mutateAsync(novas);
      toast.success("Coordenações responsáveis atualizadas");
    } catch (e: any) {
      setSelecionadas(selecionadas);
      toast.error(e.message || "Não foi possível atualizar as coordenações");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      ) : selecionadas.length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhuma</span>
      ) : (
        selecionadas.map((id) => (
          <Badge key={id} variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {nomePorId.get(id) || "Coordenação"}
            <button
              type="button"
              aria-label="Retirar coordenação"
              title="Retirar coordenação"
              className="ml-1 rounded hover:text-destructive disabled:opacity-50"
              disabled={setCoordenacoes.isPending}
              onClick={() => toggle(id)}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Coordenações
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <ScrollArea className="max-h-72">
            <div className="p-2 space-y-1">
              {(coordenacoes as any[]).map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selecionadas.includes(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    disabled={setCoordenacoes.isPending}
                  />
                  <span className="truncate">{c.nome}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
