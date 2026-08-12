import { useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TIPOS_TAREFA, TIPOS_TAREFA_LABELS } from "@/constants/tiposTarefa";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, UserCheck } from "lucide-react";

interface Membro {
  usuario?: { id?: string; nome?: string; email?: string } | null;
  cargo?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome?: string;
  membros: Membro[];
}

export function ResponsaveisFixosTipoDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
  membros,
}: Props) {
  const queryClient = useQueryClient();
  const [tipoSelecionado, setTipoSelecionado] = useState<string>(TIPOS_TAREFA[0]);
  const [mapa, setMapa] = useState<Record<string, string[]>>({});

  const pessoas = useMemo(
    () =>
      (membros || [])
        .map((m) => ({
          id: m.usuario?.id as string,
          nome: m.usuario?.nome || m.usuario?.email || "Usuário",
          cargo: m.cargo || "",
        }))
        .filter((p) => !!p.id)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [membros]
  );

  const { data: configs, isLoading } = useQuery({
    queryKey: ["responsaveis-fixos-tipo", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis_fixos_tipo_tarefa")
        .select("tipo_tarefa, responsaveis")
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!configs) return;
    const next: Record<string, string[]> = {};
    configs.forEach((c: any) => {
      next[c.tipo_tarefa] = (c.responsaveis || []) as string[];
    });
    setMapa(next);
  }, [configs]);

  const selecionados = mapa[tipoSelecionado] || [];

  const toggle = (userId: string) => {
    setMapa((prev) => {
      const atuais = prev[tipoSelecionado] || [];
      const novos = atuais.includes(userId)
        ? atuais.filter((id) => id !== userId)
        : [...atuais, userId];
      return { ...prev, [tipoSelecionado]: novos };
    });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const comResponsaveis = Object.entries(mapa).filter(([, ids]) => ids.length > 0);
      const semResponsaveis = Object.entries(mapa)
        .filter(([, ids]) => ids.length === 0)
        .map(([tipo]) => tipo);

      if (comResponsaveis.length > 0) {
        const { error } = await supabase
          .from("responsaveis_fixos_tipo_tarefa")
          .upsert(
            comResponsaveis.map(([tipo, ids]) => ({
              coordenacao_id: coordenacaoId,
              tipo_tarefa: tipo,
              responsaveis: ids,
              created_by: uid,
            })),
            { onConflict: "coordenacao_id,tipo_tarefa" }
          );
        if (error) throw error;
      }

      if (semResponsaveis.length > 0) {
        const { error } = await supabase
          .from("responsaveis_fixos_tipo_tarefa")
          .delete()
          .eq("coordenacao_id", coordenacaoId)
          .in("tipo_tarefa", semResponsaveis);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["responsaveis-fixos-tipo", coordenacaoId] });
      toast({ title: "Responsáveis fixos salvos" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Responsáveis fixos por tipo de tarefa
          </DialogTitle>
          <DialogDescription>
            Defina quem será sugerido automaticamente como responsável para cada tipo de tarefa
            {coordenacaoNome ? ` na ${coordenacaoNome}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
            <ScrollArea className="h-[360px] border rounded-md">
              <div className="p-2 space-y-1">
                {TIPOS_TAREFA.map((tipo) => {
                  const qtd = (mapa[tipo] || []).length;
                  const ativo = tipo === tipoSelecionado;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTipoSelecionado(tipo)}
                      className={`w-full flex items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-md transition-colors ${
                        ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{TIPOS_TAREFA_LABELS[tipo] || tipo}</span>
                      {qtd > 0 && (
                        <Badge variant={ativo ? "secondary" : "outline"}>{qtd}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <ScrollArea className="h-[360px] border rounded-md">
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium mb-2">
                  {TIPOS_TAREFA_LABELS[tipoSelecionado] || tipoSelecionado}
                </p>
                {pessoas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum membro cadastrado nesta coordenação.
                  </p>
                ) : (
                  pessoas.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-1">
                      <Checkbox
                        id={`resp-${tipoSelecionado}-${p.id}`}
                        checked={selecionados.includes(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      <Label
                        htmlFor={`resp-${tipoSelecionado}-${p.id}`}
                        className="flex-1 cursor-pointer text-sm font-normal"
                      >
                        {p.nome}
                        {p.cargo && (
                          <span className="text-muted-foreground"> — {p.cargo}</span>
                        )}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}