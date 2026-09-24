import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Save, UserCog } from "lucide-react";

const PERFIS = [
  { value: "assistente_coordenador", label: "Assistente Coordenador" },
  { value: "advogado", label: "Advogado" },
  { value: "advogado_temporario", label: "Advogado Temporário" },
  { value: "assistente", label: "Assistente" },
  { value: "estagiario", label: "Estagiário" },
  { value: "secretaria", label: "Secretária" },
];

interface Props { open: boolean; onOpenChange: (o: boolean) => void; coordenacaoId: string; coordenacaoNome?: string }

export function AlteracaoItensTerceirosDialog({ open, onOpenChange, coordenacaoId, coordenacaoNome }: Props) {
  const qc = useQueryClient();
  const [perfis, setPerfis] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["config-alteracao-terceiros", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("config_alteracao_itens_terceiros")
        .select("perfis, usuarios").eq("coordenacao_id", coordenacaoId).maybeSingle();
      if (error) throw error;
      return data as { perfis: string[]; usuarios: string[] } | null;
    },
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ["coordenacao-integrantes-terceiros", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data: mem } = await supabase.from("membros_coordenacao").select("usuario_id, cargo").eq("coordenacao_id", coordenacaoId);
      const ids = (mem || []).map((m: any) => m.usuario_id).filter(Boolean);
      if (!ids.length) return [];
      const { data: prof } = await supabase.from("profiles_basic").select("id, nome").in("id", ids);
      return (mem || []).map((m: any) => ({
        id: m.usuario_id, cargo: m.cargo as string | null,
        nome: (prof || []).find((p: any) => p.id === m.usuario_id)?.nome || "Usuário",
      })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  useEffect(() => {
    if (!open) return;
    setPerfis(cfg?.perfis || []);
    setUsuarios(cfg?.usuarios || []);
  }, [open, JSON.stringify(cfg)]);

  const toggle = (lista: string[], set: (v: string[]) => void, v: string) =>
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await (supabase.from as any)("config_alteracao_itens_terceiros")
      .upsert({ coordenacao_id: coordenacaoId, perfis, usuarios }, { onConflict: "coordenacao_id" });
    setSalvando(false);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    await qc.invalidateQueries({ queryKey: ["config-alteracao-terceiros"] });
    await qc.invalidateQueries({ queryKey: ["pode-alterar-item"] });
    toast.success("Configuração salva");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />Alterar itens de outras pessoas</DialogTitle>
          <DialogDescription>
            {coordenacaoNome}: quem pode mudar a situação (baixar, cumprir etc.) de itens em que não é responsável nem correspondável.
            Responsáveis, coordenadores e administradores sempre podem.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Perfis liberados</div>
              <div className="grid grid-cols-2 gap-2">
                {PERFIS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={perfis.includes(p.value)} onCheckedChange={() => toggle(perfis, setPerfis, p.value)} />{p.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Pessoas liberadas</div>
              <ScrollArea className="h-56 border rounded-md p-2">
                {pessoas.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <Checkbox checked={usuarios.includes(u.id)} onCheckedChange={() => toggle(usuarios, setUsuarios, u.id)} />
                    {u.nome}{u.cargo && <span className="text-xs text-muted-foreground">({u.cargo})</span>}
                  </label>
                ))}
              </ScrollArea>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
