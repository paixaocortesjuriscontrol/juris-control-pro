import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Mail } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome?: string;
}

type Pessoa = { id: string; nome: string; email: string | null; titular: boolean };

export function DestinatariosAlertaDjenDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const queryClient = useQueryClient();
  const [todos, setTodos] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const { data: pessoas, isLoading: loadingPessoas } = useQuery({
    queryKey: ["destinatarios-alerta-djen-pessoas", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async (): Promise<Pessoa[]> => {
      const [coordRes, membrosRes] = await Promise.all([
        supabase
          .from("coordenacoes")
          .select("coordenador_id")
          .eq("id", coordenacaoId)
          .maybeSingle(),
        supabase
          .from("membros_coordenacao")
          .select("usuario_id")
          .eq("coordenacao_id", coordenacaoId),
      ]);

      const titularId = (coordRes.data as any)?.coordenador_id as string | undefined;
      const ids = new Set<string>();
      if (titularId) ids.add(titularId);
      for (const m of membrosRes.data || []) {
        if ((m as any).usuario_id) ids.add((m as any).usuario_id as string);
      }
      if (ids.size === 0) return [];

      const { data: perfis, error } = await supabase
        .from("profiles")
        .select("id, nome, email, ativo")
        .in("id", Array.from(ids));
      if (error) throw error;

      return (perfis || [])
        .filter((p: any) => p.ativo !== false)
        .map((p: any) => ({
          id: p.id as string,
          nome: (p.nome as string) || "(sem nome)",
          email: (p.email as string) ?? null,
          titular: p.id === titularId,
        }))
        .sort((a, b) =>
          a.titular === b.titular
            ? a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
            : a.titular
              ? -1
              : 1,
        );
    },
  });

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["config-alerta-diferenca-djen", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_alerta_diferenca_djen")
        .select("*")
        .eq("coordenacao_id", coordenacaoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    setTodos((config as any)?.todos ?? true);
    setSelecionados(((config as any)?.usuarios as string[] | null) ?? []);
  }, [open, config]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!todos && selecionados.length === 0) {
        throw new Error("Selecione ao menos um destinatário ou volte para 'todos'.");
      }
      const { error } = await supabase.from("config_alerta_diferenca_djen").upsert(
        {
          coordenacao_id: coordenacaoId,
          todos,
          usuarios: todos ? [] : selecionados,
        },
        { onConflict: "coordenacao_id" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["config-alerta-diferenca-djen", coordenacaoId],
      });
      toast({ title: "Destinatários salvos" });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const isLoading = loadingPessoas || loadingConfig;

  const toggle = (id: string, checked: boolean) =>
    setSelecionados((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Alerta DJEN — destinatários{coordenacaoNome ? ` — ${coordenacaoNome}` : ""}
          </DialogTitle>
          <DialogDescription>
            Define quem recebe o e-mail "Publicações DJEN - Alerta - Diferença entre execuções"
            desta coordenação. Por padrão, todos os membros recebem.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Enviar para todos os membros</p>
                <p className="text-xs text-muted-foreground">
                  Inclui o coordenador titular e todos os membros ativos da coordenação.
                </p>
              </div>
              <Switch checked={todos} onCheckedChange={setTodos} />
            </div>

            {!todos && (
              <div className="space-y-2">
                <Label>Selecione quem deve receber</Label>
                {(pessoas || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum membro ativo encontrado nesta coordenação.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {(pessoas || []).map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selecionados.includes(p.id)}
                          onCheckedChange={(c) => toggle(p.id, c === true)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {p.nome}
                            {p.titular ? " (coordenador)" : ""}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.email || "sem e-mail cadastrado"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || isLoading}>
            {salvar.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}