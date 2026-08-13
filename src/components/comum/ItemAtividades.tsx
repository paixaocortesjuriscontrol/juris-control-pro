import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, ListChecks } from "lucide-react";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type TipoItemAtividade = "tarefa" | "prazo" | "evento" | "audiencia" | "parcelamento";

/**
 * Situações próprias das ATIVIDADES (subatividades).
 * São independentes das situações do item pai (prazo, audiência, tarefa etc.).
 */
export const SITUACOES_ATIVIDADE: { value: string; label: string }[] = [
  { value: "pendente", label: "⏳ Pendente" },
  { value: "em_execucao", label: "▶️ Em execução" },
  { value: "aguardando", label: "⏸️ Aguardando terceiros" },
  { value: "revisao", label: "🔍 Em revisão" },
  { value: "concluida", label: "✔️ Concluída" },
  { value: "nao_realizada", label: "⚠️ Não realizada" },
  { value: "cancelada", label: "❌ Cancelada" },
];

export function labelSituacaoAtividade(valor?: string | null): string {
  return SITUACOES_ATIVIDADE.find((s) => s.value === (valor ?? "pendente"))?.label ?? (valor ?? "Pendente");
}

export interface Subatividade {
  id: string;
  tipo_item: string;
  item_id: string;
  titulo: string;
  responsavel_id: string | null;
  data_prevista: string | null;
  situacao: string;
  observacao: string | null;
  concluida_em: string | null;
  criado_por: string | null;
  created_at: string;
}

export function subatividadesQueryKey(tipo: TipoItemAtividade, itemId?: string | null) {
  return ["subatividades-item", tipo, itemId ?? null];
}

export function useSubatividades(tipo: TipoItemAtividade, itemId?: string | null) {
  return useQuery({
    queryKey: subatividadesQueryKey(tipo, itemId),
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subatividades_item")
        .select("*")
        .eq("tipo_item", tipo)
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Subatividade[];
    },
  });
}

interface Props {
  tipo: TipoItemAtividade;
  itemId?: string | null;
  className?: string;
}

export function ItemAtividades({ tipo, itemId, className }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: atividades = [], isLoading } = useSubatividades(tipo, itemId);

  const [titulo, setTitulo] = useState("");
  const [responsavelIds, setResponsavelIds] = useState<string[]>([]);
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacao, setObservacao] = useState("");
  const [situacaoNova, setSituacaoNova] = useState("pendente");

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: subatividadesQueryKey(tipo, itemId), refetchType: "all" });
    // O calendário do Painel de Controle e a agenda unificada leem as atividades
    // por queries próprias — precisam ser atualizadas junto.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["painel-subatividades-calendario"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada-infinite"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"], refetchType: "all" }),
    ]);
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título da atividade");
      const { error } = await (supabase as any).from("subatividades_item").insert({
        tipo_item: tipo,
        item_id: itemId,
        titulo: titulo.trim(),
        responsavel_id: responsavelIds[0] ?? null,
        data_prevista: dataPrevista || null,
        observacao: observacao.trim() || null,
        situacao: situacaoNova || "pendente",
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitulo("");
      setResponsavelIds([]);
      setDataPrevista("");
      setObservacao("");
      setSituacaoNova("pendente");
      await invalidar();
      toast.success("Atividade adicionada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar atividade"),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from("subatividades_item").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error(e.message || "Erro ao salvar atividade"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("subatividades_item").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidar();
      toast.success("Atividade removida");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover atividade"),
  });

  if (!itemId) {
    return (
      <p className={cn("text-sm text-muted-foreground py-6 text-center", className)}>
        Salve o item para adicionar atividades.
      </p>
    );
  }

  const toggleConcluida = (a: Subatividade) => {
    const concluir = a.situacao !== "concluida";
    atualizar.mutate({
      id: a.id,
      patch: {
        situacao: concluir ? "concluida" : "pendente",
        concluida_em: concluir ? new Date().toISOString() : null,
        concluida_por: concluir ? user?.id ?? null : null,
      },
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-[11px] text-muted-foreground">
        As atividades são independentes: concluir o item (prazo, audiência, tarefa etc.) não conclui as atividades — cada
        uma deve ser marcada manualmente.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : atividades.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <ListChecks className="h-5 w-5 mx-auto mb-1 opacity-60" />
          Nenhuma atividade
        </div>
      ) : (
        <ul className="space-y-2">
          {atividades.map((a) => {
            const concluida = a.situacao === "concluida";
            return (
              <li key={a.id} className="rounded-md border p-2.5 bg-card space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={concluida}
                    onCheckedChange={() => toggleConcluida(a)}
                    className="mt-0.5"
                  />
                  <Input
                    defaultValue={a.titulo}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== a.titulo) atualizar.mutate({ id: a.id, patch: { titulo: v } });
                    }}
                    className={cn("h-8 border-transparent px-1 focus-visible:border-input", concluida && "line-through text-muted-foreground")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remover.mutate(a.id)}
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                  <Input
                    type="date"
                    defaultValue={a.data_prevista ?? ""}
                    onChange={(e) => atualizar.mutate({ id: a.id, patch: { data_prevista: e.target.value || null } })}
                    className="h-8 text-xs"
                  />
                  <PeoplePicker
                    selectedIds={a.responsavel_id ? [a.responsavel_id] : []}
                    onChange={(ids) => atualizar.mutate({ id: a.id, patch: { responsavel_id: ids[ids.length - 1] ?? null } })}
                    placeholder="Responsável"
                    emptyLabel="Sem responsável"
                  />
                </div>
                <div className="pl-6">
                  <Select
                    value={a.situacao ?? "pendente"}
                    onValueChange={(v) =>
                      atualizar.mutate({
                        id: a.id,
                        patch: {
                          situacao: v,
                          concluida_em: v === "concluida" ? new Date().toISOString() : null,
                          concluida_por: v === "concluida" ? user?.id ?? null : null,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Situação da atividade" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUACOES_ATIVIDADE.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  defaultValue={a.observacao ?? ""}
                  placeholder="Observação"
                  rows={2}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (a.observacao ?? "")) atualizar.mutate({ id: a.id, patch: { observacao: v || null } });
                  }}
                  className="text-xs ml-6 w-[calc(100%-1.5rem)]"
                />
                {concluida && a.concluida_em && (
                  <p className="pl-6 text-[11px] text-emerald-600 dark:text-emerald-400">
                    Concluída em {format(parseISO(a.concluida_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-md border p-2.5 space-y-2 bg-muted/30">
        <div className="flex gap-2">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Nova atividade"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!criar.isPending) criar.mutate();
              }
            }}
          />
          <Button type="button" size="sm" onClick={() => criar.mutate()} disabled={criar.isPending || !titulo.trim()}>
            {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className="h-8 text-xs" />
          <PeoplePicker
            selectedIds={responsavelIds}
            onChange={(ids) => setResponsavelIds(ids.slice(-1))}
            placeholder="Responsável"
            emptyLabel="Sem responsável"
          />
        </div>
        <Select value={situacaoNova} onValueChange={setSituacaoNova}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Situação da atividade" />
          </SelectTrigger>
          <SelectContent>
            {SITUACOES_ATIVIDADE.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observação (opcional)"
          rows={2}
          className="text-xs"
        />
      </div>
    </div>
  );
}
