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
import { SITUACAO_REAGENDAR, TIPO_REAGENDAMENTO } from "@/hooks/usePodeReagendar";

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
  const [restrito, setRestrito] = useState(false);
  const [perfis, setPerfis] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<string[]>([]);

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

  const { data: config, isLoading } = useQuery({
    queryKey: ["permissoes-reagendamento-coord", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("perfis, usuarios, ativa")
        .eq("coordenacao_id", coordenacaoId)
        .eq("tipo_tarefa", TIPO_REAGENDAMENTO)
        .eq("situacao", SITUACAO_REAGENDAR)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    const p = ((config as any)?.perfis || []) as string[];
    const u = ((config as any)?.usuarios || []) as string[];
    setPerfis(p);
    setUsuarios(u);
    setRestrito(p.length + u.length > 0);
  }, [config, open]);

  const toggle = (
    lista: string[],
    setLista: (v: string[]) => void,
    valor: string,
  ) => {
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { error: delError } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .delete()
        .eq("coordenacao_id", coordenacaoId)
        .eq("tipo_tarefa", TIPO_REAGENDAMENTO)
        .eq("situacao", SITUACAO_REAGENDAR);
      if (delError) throw delError;

      if (restrito && perfis.length + usuarios.length > 0) {
        const { error } = await supabase.from("permissoes_situacao_tipo_tarefa").insert({
          coordenacao_id: coordenacaoId,
          tipo_tarefa: TIPO_REAGENDAMENTO,
          situacao: SITUACAO_REAGENDAR,
          perfis,
          usuarios,
          ativa: true,
          created_by: uid,
        });
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
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Quem pode reagendar
          </DialogTitle>
          <DialogDescription>
            Escolha os perfis e/ou pessoas que podem reagendar itens
            {coordenacaoNome ? ` na ${coordenacaoNome}` : ""}. Sem restrição, o botão
            "Reagendar" aparece para todos; com restrição, ele fica oculto para quem não
            estiver selecionado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={restrito} onCheckedChange={(v) => setRestrito(!!v)} />
              Restringir reagendamento
            </label>

            {restrito && (
              <ScrollArea className="h-[360px] border rounded-md">
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Perfis</p>
                    {PERFIS.map((p) => (
                      <label key={p.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={perfis.includes(p.value)}
                          onCheckedChange={() => toggle(perfis, setPerfis, p.value)}
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
                          checked={usuarios.includes(p.id)}
                          onCheckedChange={() => toggle(usuarios, setUsuarios, p.id)}
                        />
                        {p.nome}
                      </label>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            )}
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
