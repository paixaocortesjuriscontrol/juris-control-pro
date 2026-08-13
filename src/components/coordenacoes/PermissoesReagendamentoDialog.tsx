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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { SITUACAO_REAGENDAR, TIPOS_REAGENDAMENTO } from "@/hooks/usePodeReagendar";

const PERFIS: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "coordenador", label: "Coordenador" },
  { value: "assistente_coordenador", label: "Assistente Coordenador" },
  { value: "advogado", label: "Advogado" },
  { value: "advogado_temporario", label: "Advogado Temporário" },
  { value: "estagiario", label: "Estagiário" },
  { value: "assistente", label: "Assistente" },
  { value: "secretaria", label: "Secretária" },
];

type Regra = { restrito: boolean; perfis: string[]; usuarios: string[] };

const regraVazia = (): Regra => ({ restrito: false, perfis: [], usuarios: [] });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome?: string;
}

export function PermissoesReagendamentoDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const queryClient = useQueryClient();
  const [tipoSel, setTipoSel] = useState(TIPOS_REAGENDAMENTO[0].key);
  const [regras, setRegras] = useState<Record<string, Regra>>({});

  const { data: pessoas = [] } = useQuery({
    queryKey: ["coordenacao-integrantes-reagendamento", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const ids = new Set<string>();
      const { data: mem } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .eq("coordenacao_id", coordenacaoId);
      (mem || []).forEach((m: any) => m.usuario_id && ids.add(m.usuario_id));
      const { data: coord } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .eq("id", coordenacaoId)
        .maybeSingle();
      if (coord?.coordenador_id) ids.add(coord.coordenador_id);
      if (ids.size === 0) return [] as { id: string; nome: string }[];
      const { data: profiles } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .in("id", Array.from(ids));
      return Array.from(ids)
        .map((id) => ({
          id,
          nome: (profiles || []).find((p: any) => p.id === id)?.nome || "Usuário",
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["permissoes-reagendamento-coord", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("perfis, usuarios, tipo_tarefa")
        .eq("coordenacao_id", coordenacaoId)
        .eq("situacao", SITUACAO_REAGENDAR);
      if (error) throw error;
      return (data || []) as { perfis: string[] | null; usuarios: string[] | null; tipo_tarefa: string | null }[];
    },
  });

  useEffect(() => {
    if (!open) return;
    const base: Record<string, Regra> = {};
    TIPOS_REAGENDAMENTO.forEach((t) => (base[t.key] = regraVazia()));
    // Regra legada (sem tipo) vale como padrão inicial para todos os tipos.
    const legada = configs.find((c) => (c.tipo_tarefa || "").toUpperCase() === "REAGENDAMENTO");
    if (legada) {
      TIPOS_REAGENDAMENTO.forEach((t) => {
        base[t.key] = {
          perfis: legada.perfis || [],
          usuarios: legada.usuarios || [],
          restrito: (legada.perfis || []).length + (legada.usuarios || []).length > 0,
        };
      });
    }
    configs.forEach((c) => {
      const key = (c.tipo_tarefa || "").toUpperCase();
      if (!base[key]) return;
      base[key] = {
        perfis: c.perfis || [],
        usuarios: c.usuarios || [],
        restrito: (c.perfis || []).length + (c.usuarios || []).length > 0,
      };
    });
    setRegras(base);
  }, [configs, open]);

  const atual = regras[tipoSel] ?? regraVazia();
  const setAtual = (patch: Partial<Regra>) =>
    setRegras((prev) => ({ ...prev, [tipoSel]: { ...(prev[tipoSel] ?? regraVazia()), ...patch } }));

  const toggle = (lista: string[], campo: "perfis" | "usuarios", valor: string) =>
    setAtual({ [campo]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor] } as any);

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { error: delError } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .delete()
        .eq("coordenacao_id", coordenacaoId)
        .eq("situacao", SITUACAO_REAGENDAR);
      if (delError) throw delError;

      const rows = TIPOS_REAGENDAMENTO.map((t) => ({ key: t.key, r: regras[t.key] ?? regraVazia() }))
        .filter(({ r }) => r.restrito && r.perfis.length + r.usuarios.length > 0)
        .map(({ key, r }) => ({
          coordenacao_id: coordenacaoId,
          tipo_tarefa: key,
          situacao: SITUACAO_REAGENDAR,
          perfis: r.perfis,
          usuarios: r.usuarios,
          ativa: true,
          created_by: uid,
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from("permissoes_situacao_tipo_tarefa").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["permissoes-reagendamento-coord", coordenacaoId] });
      await queryClient.invalidateQueries({ queryKey: ["permissoes-reagendamento"] });
      toast({ title: "Permissões de reagendamento salvas" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Quem pode reagendar
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de tarefa à esquerda e defina os perfis e/ou pessoas que podem
            reagendar
            {coordenacaoNome ? ` na ${coordenacaoNome}` : ""}. Sem restrição, o botão
            "Reagendar" aparece para todos.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
            <div className="border rounded-md p-2 space-y-1">
              {TIPOS_REAGENDAMENTO.map((t) => {
                const r = regras[t.key] ?? regraVazia();
                const ativo = t.key === tipoSel;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTipoSel(t.key)}
                    className={`w-full text-left text-sm rounded px-2 py-1.5 flex items-center justify-between ${
                      ativo ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <span>{t.label}</span>
                    {r.restrito && (
                      <span className="text-[10px] uppercase text-muted-foreground">restrito</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={atual.restrito}
                  onCheckedChange={(v) => setAtual({ restrito: !!v })}
                />
                Restringir reagendamento deste tipo
              </label>

              {atual.restrito && (
                <ScrollArea className="h-[340px] border rounded-md">
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Perfis</p>
                      {PERFIS.map((p) => (
                        <label key={p.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={atual.perfis.includes(p.value)}
                            onCheckedChange={() => toggle(atual.perfis, "perfis", p.value)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Pessoas específicas
                      </p>
                      {pessoas.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum integrante nesta coordenação.
                        </p>
                      )}
                      {pessoas.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={atual.usuarios.includes(p.id)}
                            onCheckedChange={() => toggle(atual.usuarios, "usuarios", p.id)}
                          />
                          {p.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
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
