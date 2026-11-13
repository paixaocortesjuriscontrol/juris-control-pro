import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { CARGOS_COORDENACAO, normalizarCargo, type RegraMenuCoordenacao as _R } from "@/lib/permissoesMenuCoordenacao";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; coordenacaoId: string; coordenacaoNome?: string }

type Membro = { usuario_id: string; cargo: string | null; nome: string };

export function PermissoesAgendamentoCoordenacaoDialog({ open, onOpenChange, coordenacaoId, coordenacaoNome }: Props) {
  const qc = useQueryClient();
  const [cargoBloq, setCargoBloq] = useState<Record<string, boolean>>({}); // `${cargo}|${path}` => bloqueado
  const [membroRegra, setMembroRegra] = useState<Record<string, boolean>>({}); // `${user}|${path}` => permitido
  const [membroSel, setMembroSel] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const menus = useMemo(() => [
    { path: "tarefa", label: "Tarefas" },
    { path: "prazo", label: "Prazos" },
    { path: "audiencia", label: "Audiências" },
    { path: "evento", label: "Eventos" },
  ], []);

  const { data, isLoading } = useQuery({
    queryKey: ["permissoes-agendamento-coordenacao", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const [{ data: regras, error }, { data: mem, error: e2 }] = await Promise.all([
        (supabase.from as any)("permissoes_agendamento_coordenacao").select("coordenacao_id, cargo, user_id, tipo_item, permitido").eq("coordenacao_id", coordenacaoId),
        supabase.from("membros_coordenacao").select("usuario_id, cargo").eq("coordenacao_id", coordenacaoId),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      const ids = (mem ?? []).map((m: any) => m.usuario_id);
      const { data: perfis } = ids.length
        ? await (supabase.from as any)("profiles_basic").select("id, nome").in("id", ids)
        : { data: [] };
      const nomes = new Map((perfis ?? []).map((p: any) => [p.id, p.nome]));
      const membros: Membro[] = (mem ?? []).map((m: any) => ({ usuario_id: m.usuario_id, cargo: m.cargo, nome: String(nomes.get(m.usuario_id) || "Sem nome") }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return { regras: (regras ?? []) as any[], membros };
    },
  });

  useEffect(() => {
    if (!data) return;
    const c: Record<string, boolean> = {};
    const m: Record<string, boolean> = {};
    data.regras.forEach((r: any) => {
      if (r.cargo && !r.permitido) c[`${normalizarCargo(r.cargo)}|${r.tipo_item}`] = true;
      if (r.user_id) m[`${r.user_id}|${r.tipo_item}`] = r.permitido;
    });
    setCargoBloq(c);
    setMembroRegra(m);
  }, [data]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const linhas = [
        ...Object.entries(cargoBloq).filter(([, v]) => v).map(([k]) => {
          const [cargo, tipo_item] = k.split("|");
          return { coordenacao_id: coordenacaoId, cargo, user_id: null, tipo_item, permitido: false };
        }),
        ...Object.entries(membroRegra).map(([k, permitido]) => {
          const [user_id, tipo_item] = k.split("|");
          return { coordenacao_id: coordenacaoId, cargo: null, user_id, tipo_item, permitido };
        }),
      ];
      const del = await (supabase.from as any)("permissoes_agendamento_coordenacao").delete().eq("coordenacao_id", coordenacaoId).select("id");
      if (del.error) throw del.error;
      if ((data?.regras.length ?? 0) > 0 && (del.data?.length ?? 0) === 0) throw new Error("Sem permissão para alterar esta coordenação.");
      if (linhas.length) {
        const ins = await (supabase.from as any)("permissoes_agendamento_coordenacao").insert(linhas).select("id");
        if (ins.error) throw ins.error;
        if ((ins.data?.length ?? 0) !== linhas.length) throw new Error("Nem todas as regras foram gravadas.");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["permissoes-agendamento-coordenacao", coordenacaoId] }),
        qc.invalidateQueries({ queryKey: ["permissoes-agendamento-usuario"] }),
      ]);
      toast.success("Permissões de agendamento salvas");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const membro = data?.membros.find((m) => m.usuario_id === membroSel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Quem pode configurar agendamentos{coordenacaoNome ? ` — ${coordenacaoNome}` : ""}</DialogTitle>
          <DialogDescription>Tudo começa liberado. Desligado = a pessoa não cria nem edita esse tipo, só muda a situação e comenta. A regra do membro vale acima do cargo.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="cargo">
            <TabsList><TabsTrigger value="cargo">Por cargo</TabsTrigger><TabsTrigger value="membro">Por membro</TabsTrigger></TabsList>
            <TabsContent value="cargo">
              <ScrollArea className="max-h-[55vh] rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">Tipo</th>
                      {CARGOS_COORDENACAO.map((c) => <th key={c.value} className="p-2 text-center text-xs font-medium">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {menus.map((m) => (
                      <tr key={m.path} className="border-t border-border">
                        <td className="p-2">{m.label}</td>
                        {CARGOS_COORDENACAO.map((c) => {
                          const k = `${c.value}|${m.path}`;
                          return (
                            <td key={c.value} className="p-2 text-center">
                              <Switch checked={!cargoBloq[k]} onCheckedChange={(v) => setCargoBloq((s) => ({ ...s, [k]: !v }))} aria-label={`${m.label} para ${c.label}`} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="membro" className="space-y-3">
              <Select value={membroSel} onValueChange={setMembroSel}>
                <SelectTrigger className="w-80"><SelectValue placeholder="Escolha um membro" /></SelectTrigger>
                <SelectContent>
                  {(data?.membros ?? []).map((m) => <SelectItem key={m.usuario_id} value={m.usuario_id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {membro && (
                <ScrollArea className="max-h-[50vh] rounded-md border border-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {menus.map((m) => {
                        const k = `${membro.usuario_id}|${m.path}`;
                        const atual = membroRegra[k];
                        const doCargo = !cargoBloq[`${normalizarCargo(membro.cargo)}|${m.path}`];
                        return (
                          <tr key={m.path} className="border-t border-border">
                            <td className="p-2">{m.label}</td>
                            <td className="p-2 text-right">
                              <Select value={atual === undefined ? "cargo" : atual ? "sim" : "nao"} onValueChange={(v) => setMembroRegra((s) => {
                                const n = { ...s };
                                if (v === "cargo") delete n[k]; else n[k] = v === "sim";
                                return n;
                              })}>
                                <SelectTrigger className="ml-auto h-8 w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cargo">Igual ao cargo ({doCargo ? "liberado" : "bloqueado"})</SelectItem>
                                  <SelectItem value="sim">Liberado</SelectItem>
                                  <SelectItem value="nao">Bloqueado</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || isLoading}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
