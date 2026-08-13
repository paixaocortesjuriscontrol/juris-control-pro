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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { situacoesBase, TipoSituacaoItem } from "@/constants/situacoesItem";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { SITUACAO_TODAS } from "@/hooks/usePermissoesSituacao";

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

/** Somente as opções do botão "Adicionar" */
const TIPOS_ITEM: { key: string; label: string; tipo: TipoSituacaoItem }[] = [
  { key: "PRAZO", label: "Prazo", tipo: "prazo" },
  { key: "TAREFA", label: "Tarefa", tipo: "tarefa" },
  { key: "AUDIÊNCIA", label: "Audiência", tipo: "audiencia" },
  { key: "PARCELAMENTO", label: "Parcelamento Recorrente", tipo: "parcelamento" },
  { key: "EVENTO", label: "Evento", tipo: "evento" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome?: string;
}

function tipoItemDe(key: string): TipoSituacaoItem {
  return TIPOS_ITEM.find((t) => t.key === key)?.tipo ?? "tarefa";
}

function labelDe(key: string): string {
  return TIPOS_ITEM.find((t) => t.key === key)?.label ?? key;
}

type Regra = {
  perfis: string[];
  usuarios: string[];
  ativa: boolean;
  restrito: boolean;
  comentarioObrigatorio?: boolean;
};

const restritoManual = (r?: Regra) => !!r?.restrito;

export function PermissoesSituacaoDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const queryClient = useQueryClient();
  const [tipoSelecionado, setTipoSelecionado] = useState<string>(TIPOS_ITEM[0].key);
  // chave: `${tipo}|${situacao}`
  const [regras, setRegras] = useState<Record<string, Regra>>({});

  const { data: pessoas = [] } = useQuery({
    queryKey: ["coordenacao-integrantes-permissoes", coordenacaoId],
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

  const { data: configs, isLoading } = useQuery({
    queryKey: ["permissoes-situacao-coord", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("tipo_tarefa, situacao, perfis, usuarios, ativa, comentario_obrigatorio")
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!configs) return;
    const next: Record<string, Regra> = {};
    (configs as any[]).forEach((c) => {
      next[`${c.tipo_tarefa}|${c.situacao}`] = {
        perfis: (c.perfis || []) as string[],
        usuarios: (c.usuarios || []) as string[],
        ativa: c.ativa !== false,
        restrito: ((c.perfis || []).length + (c.usuarios || []).length) > 0,
        comentarioObrigatorio: c.comentario_obrigatorio === true,
      };
    });
    setRegras(next);
  }, [configs]);

  const situacoes = useMemo(
    () => situacoesBase(tipoItemDe(tipoSelecionado)),
    [tipoSelecionado],
  );

  const getRegra = (situacao: string): Regra | undefined =>
    regras[`${tipoSelecionado}|${situacao}`];

  const comentarioObrigatorio = !!regras[`${tipoSelecionado}|${SITUACAO_TODAS}`]
    ?.comentarioObrigatorio;

  const toggleComentarioObrigatorio = (valor: boolean) => {
    const key = `${tipoSelecionado}|${SITUACAO_TODAS}`;
    setRegras((prev) => {
      const next = { ...prev };
      if (valor) {
        next[key] = {
          perfis: [],
          usuarios: [],
          ativa: true,
          restrito: false,
          comentarioObrigatorio: true,
        };
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const toggleRestricao = (situacao: string, restrito: boolean) => {
    const key = `${tipoSelecionado}|${situacao}`;
    setRegras((prev) => {
      const next = { ...prev };
      const atual = prev[key];
      if (restrito) {
        next[key] = { perfis: [], usuarios: [], ativa: true, ...(atual || {}), restrito: true };
      } else if (atual && atual.ativa === false) {
        next[key] = { perfis: [], usuarios: [], ativa: false, restrito: false };
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const toggleAtiva = (situacao: string, ativa: boolean) => {
    const key = `${tipoSelecionado}|${situacao}`;
    setRegras((prev) => {
      const next = { ...prev };
      const atual = prev[key];
      if (ativa && (!atual || !restritoManual(atual))) {
        delete next[key];
        return next;
      }
      next[key] = {
        perfis: atual?.perfis || [],
        usuarios: atual?.usuarios || [],
        restrito: !!atual?.restrito,
        ativa,
      };
      return next;
    });
  };

  const toggleItem = (situacao: string, campo: "perfis" | "usuarios", valor: string) => {
    const key = `${tipoSelecionado}|${situacao}`;
    setRegras((prev) => {
      const atual: Regra = prev[key] || { perfis: [], usuarios: [], ativa: true, restrito: true };
      const lista = atual[campo];
      const nova = lista.includes(valor)
        ? lista.filter((v) => v !== valor)
        : [...lista, valor];
      return { ...prev, [key]: { ...atual, [campo]: nova } };
    });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const rows = Object.entries(regras).map(([key, r]) => {
        const [tipo, situacao] = key.split("|");
        return {
          coordenacao_id: coordenacaoId,
          tipo_tarefa: tipo,
          situacao,
          perfis: r.perfis,
          usuarios: r.usuarios,
          ativa: r.ativa,
          comentario_obrigatorio: !!r.comentarioObrigatorio,
          created_by: uid,
        };
      });

      // Remove tudo que não está mais configurado e regrava o restante
      const { error: delError } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .delete()
        .eq("coordenacao_id", coordenacaoId);
      if (delError) throw delError;

      if (rows.length > 0) {
        const { error } = await supabase
          .from("permissoes_situacao_tipo_tarefa")
          .insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["permissoes-situacao-coord", coordenacaoId] });
      await queryClient.invalidateQueries({ queryKey: ["permissoes-situacao"] });
      toast({ title: "Permissões de situação salvas" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const qtdPorTipo = (tipo: string) =>
    Object.keys(regras).filter(
      (k) => k.startsWith(`${tipo}|`) && !k.endsWith(`|${SITUACAO_TODAS}`),
    ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Quem pode mudar cada situação
          </DialogTitle>
          <DialogDescription>
            Escolha, por tipo de tarefa, quais perfis e/ou pessoas podem aplicar cada situação
            {coordenacaoNome ? ` na ${coordenacaoNome}` : ""}. Situações sem restrição ficam
            liberadas para todos.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
            <ScrollArea className="h-[460px] border rounded-md">
              <div className="p-2 space-y-1">
                {TIPOS_ITEM.map(({ key: tipo, label }) => {
                  const ativo = tipo === tipoSelecionado;
                  const qtd = qtdPorTipo(tipo);
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
                      {qtd > 0 && <Badge variant={ativo ? "secondary" : "outline"}>{qtd}</Badge>}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <ScrollArea className="h-[460px] border rounded-md min-w-0">
              <div className="p-3 pr-4 space-y-3">
                <p className="text-sm font-medium">
                  {labelDe(tipoSelecionado)}
                </p>
                <div className="border rounded-md p-3 bg-muted/40 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Comentário obrigatório</p>
                    <p className="text-xs text-muted-foreground">
                      Exige um comentário sempre que a situação de {labelDe(tipoSelecionado)} for
                      alterada.
                    </p>
                  </div>
                  <Switch
                    checked={comentarioObrigatorio}
                    onCheckedChange={(v) => toggleComentarioObrigatorio(!!v)}
                  />
                </div>
                {situacoes.map((s) => {
                  const regra = getRegra(s.value);
                  const ativa = regra ? regra.ativa : true;
                  const restrito = !!regra && restritoManual(regra);
                  return (
                    <div key={s.value} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">{s.label}</span>
                        <div className="flex items-center gap-4 shrink-0">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Switch
                              checked={ativa}
                              onCheckedChange={(v) => toggleAtiva(s.value, !!v)}
                            />
                            {ativa ? "Ativa" : "Inativa"}
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={restrito}
                              disabled={!ativa}
                              onCheckedChange={(v) => toggleRestricao(s.value, !!v)}
                            />
                            Restringir
                          </label>
                        </div>
                      </div>

                      {ativa && restrito && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Perfis</p>
                            {PERFIS.map((p) => (
                              <label key={p.value} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={regra!.perfis.includes(p.value)}
                                  onCheckedChange={() => toggleItem(s.value, "perfis", p.value)}
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Pessoas específicas
                            </p>
                            {pessoas.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Nenhum integrante nesta coordenação.
                              </p>
                            ) : (
                              pessoas.map((p) => (
                                <label key={p.id} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={regra!.usuarios.includes(p.id)}
                                    onCheckedChange={() => toggleItem(s.value, "usuarios", p.id)}
                                  />
                                  <span className="truncate">{p.nome}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
