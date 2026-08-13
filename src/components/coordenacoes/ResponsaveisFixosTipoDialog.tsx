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
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, UserCheck } from "lucide-react";

/** Somente as opções do botão "Adicionar" */
const TIPOS_ITEM: { key: string; label: string }[] = [
  { key: "PRAZO", label: "Prazo" },
  { key: "TAREFA", label: "Tarefa" },
  { key: "AUDIÊNCIA", label: "Audiência" },
  { key: "PARCELAMENTO", label: "Parcelamento Recorrente" },
  { key: "EVENTO", label: "Evento" },
];

const labelTipo = (k: string) => TIPOS_ITEM.find((t) => t.key === k)?.label ?? k;

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
  const [tipoSelecionado, setTipoSelecionado] = useState<string>(TIPOS_ITEM[0].key);
  const [mapa, setMapa] = useState<Record<string, string[]>>({});
  const [mapaEnvolvidos, setMapaEnvolvidos] = useState<Record<string, string[]>>({});

  // Busca completa dos integrantes da coordenação (membros + coordenador),
  // pois a prop `membros` pode vir incompleta dependendo da tela.
  const { data: membrosCoord = [] } = useQuery({
    queryKey: ["coordenacao-integrantes-fixos", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const ids = new Set<string>();
      const cargoPorId: Record<string, string> = {};

      const { data: mem } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id, cargo")
        .eq("coordenacao_id", coordenacaoId);
      (mem || []).forEach((m: any) => {
        if (m.usuario_id) {
          ids.add(m.usuario_id);
          if (m.cargo) cargoPorId[m.usuario_id] = m.cargo;
        }
      });

      const { data: coord } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .eq("id", coordenacaoId)
        .maybeSingle();
      if (coord?.coordenador_id) {
        ids.add(coord.coordenador_id);
        cargoPorId[coord.coordenador_id] = cargoPorId[coord.coordenador_id] || "coordenador";
      }

      if (ids.size === 0) return [];

      // Coordenações com apenas o coordenador cadastrado ficariam praticamente vazias:
      // nesse caso, lista todos os usuários ativos para permitir a configuração.
      if (ids.size <= 1) {
        const { data: todos } = await supabase
          .from("profiles")
          .select("id, nome, email, ativo")
          .eq("ativo", true)
          .order("nome");
        (todos || []).forEach((p: any) => ids.add(p.id));
        return Array.from(ids).map((id) => {
          const p = (todos || []).find((x: any) => x.id === id);
          return {
            id,
            nome: p?.nome || p?.email || "Usuário",
            cargo: cargoPorId[id] || "",
          };
        });
      }

      const { data: profiles } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .in("id", Array.from(ids));

      return Array.from(ids).map((id) => ({
        id,
        nome: (profiles || []).find((p: any) => p.id === id)?.nome || "Usuário",
        cargo: cargoPorId[id] || "",
      }));
    },
  });

  const pessoas = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cargo: string }>();
    (membros || []).forEach((m) => {
      const id = m.usuario?.id;
      if (!id) return;
      map.set(id, {
        id,
        nome: m.usuario?.nome || m.usuario?.email || "Usuário",
        cargo: m.cargo || "",
      });
    });
    (membrosCoord as any[]).forEach((p) => {
      const atual = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        nome: atual?.nome && atual.nome !== "Usuário" ? atual.nome : p.nome,
        cargo: atual?.cargo || p.cargo,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [membros, membrosCoord]);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["responsaveis-fixos-tipo", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis_fixos_tipo_tarefa")
        .select("tipo_tarefa, responsaveis, envolvidos")
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!configs) return;
    const next: Record<string, string[]> = {};
    const nextEnv: Record<string, string[]> = {};
    configs.forEach((c: any) => {
      next[c.tipo_tarefa] = (c.responsaveis || []) as string[];
      nextEnv[c.tipo_tarefa] = (c.envolvidos || []) as string[];
    });
    setMapa(next);
    setMapaEnvolvidos(nextEnv);
  }, [configs]);

  const selecionados = mapa[tipoSelecionado] || [];
  const selecionadosEnv = mapaEnvolvidos[tipoSelecionado] || [];

  /** Papel único por pessoa: responsável, envolvido ou nenhum. */
  const definirPapel = (userId: string, papel: "responsavel" | "envolvido" | "nenhum") => {
    setMapa((prev) => {
      const atuais = (prev[tipoSelecionado] || []).filter((id) => id !== userId);
      return { ...prev, [tipoSelecionado]: papel === "responsavel" ? [...atuais, userId] : atuais };
    });
    setMapaEnvolvidos((prev) => {
      const atuais = (prev[tipoSelecionado] || []).filter((id) => id !== userId);
      return { ...prev, [tipoSelecionado]: papel === "envolvido" ? [...atuais, userId] : atuais };
    });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const tipos = Array.from(
        new Set([...Object.keys(mapa), ...Object.keys(mapaEnvolvidos)]),
      );
      const comConfig = tipos.filter(
        (t) => (mapa[t] || []).length > 0 || (mapaEnvolvidos[t] || []).length > 0,
      );
      const semConfig = tipos.filter(
        (t) => (mapa[t] || []).length === 0 && (mapaEnvolvidos[t] || []).length === 0,
      );

      if (comConfig.length > 0) {
        const { error } = await supabase
          .from("responsaveis_fixos_tipo_tarefa")
          .upsert(
            comConfig.map((tipo) => ({
              coordenacao_id: coordenacaoId,
              tipo_tarefa: tipo,
              responsaveis: mapa[tipo] || [],
              envolvidos: mapaEnvolvidos[tipo] || [],
              created_by: uid,
            })),
            { onConflict: "coordenacao_id,tipo_tarefa" }
          );
        if (error) throw error;
      }

      if (semConfig.length > 0) {
        const { error } = await supabase
          .from("responsaveis_fixos_tipo_tarefa")
          .delete()
          .eq("coordenacao_id", coordenacaoId)
          .in("tipo_tarefa", semConfig);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["responsaveis-fixos-tipo", coordenacaoId] });
      await queryClient.invalidateQueries({ queryKey: ["fixos-tipo-coordenacao"] });
      toast({ title: "Responsáveis fixos salvos" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Pessoas fixas por tipo de tarefa
          </DialogTitle>
          <DialogDescription>
            Defina, para cada tipo, quem entra automaticamente como <strong>responsável</strong> ou como{" "}
            <strong>envolvido</strong>
            {coordenacaoNome ? ` na ${coordenacaoNome}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
            <ScrollArea className="h-[420px] border rounded-md">
              <div className="p-2 space-y-1">
                {TIPOS_ITEM.map(({ key: tipo, label }) => {
                  const qtd = (mapa[tipo] || []).length + (mapaEnvolvidos[tipo] || []).length;
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
                      <span className="truncate">{label}</span>
                      {qtd > 0 && (
                        <Badge variant={ativo ? "secondary" : "outline"}>{qtd}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <ScrollArea className="h-[420px] border rounded-md min-w-0">
              <div className="p-3 pr-4 space-y-2">
                <p className="text-sm font-medium mb-2">
                  {labelTipo(tipoSelecionado)}
                </p>
                {pessoas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum membro cadastrado nesta coordenação.
                  </p>
                ) : (
                  pessoas.map((p) => {
                    const papel = selecionados.includes(p.id)
                      ? "responsavel"
                      : selecionadosEnv.includes(p.id)
                        ? "envolvido"
                        : "nenhum";
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="flex-1 text-sm truncate">
                          {p.nome}
                          {p.cargo && <span className="text-muted-foreground"> — {p.cargo}</span>}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {([
                            ["nenhum", "Nenhum"],
                            ["responsavel", "Responsável"],
                            ["envolvido", "Envolvido"],
                          ] as const).map(([valor, rotulo]) => (
                            <Button
                              key={valor}
                              type="button"
                              size="sm"
                              variant={papel === valor ? "default" : "outline"}
                              className="h-7 px-2 text-xs"
                              onClick={() => definirPapel(p.id, valor)}
                            >
                              {rotulo}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })
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