import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { feriadosNacionais, definirFeriadosCache } from "@/lib/feriados";

const sb = supabase as any;
const br = (iso: string) => iso.split("-").reverse().join("/");

export function FeriadosCoordenacaoDialog({ open, onOpenChange, coordenacaoId, coordenacaoNome }: {
  open: boolean; onOpenChange: (v: boolean) => void; coordenacaoId: string; coordenacaoNome: string;
}) {
  const [usar, setUsar] = useState(false);
  const [lista, setLista] = useState<{ id: string; data: string; nome: string }[]>([]);
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const ano = new Date().getFullYear();

  async function carregar() {
    const [{ data: c }, { data: l }] = await Promise.all([
      sb.from("coordenacoes").select("usar_feriados_nacionais").eq("id", coordenacaoId).maybeSingle(),
      sb.from("feriados_coordenacao").select("id,data,nome").eq("coordenacao_id", coordenacaoId).order("data"),
    ]);
    setUsar(!!c?.usar_feriados_nacionais);
    setLista(l || []);
    definirFeriadosCache(coordenacaoId, !!c?.usar_feriados_nacionais, (l || []).map((r: any) => r.data));
  }
  useEffect(() => { if (open) void carregar(); }, [open, coordenacaoId]);

  async function alternar(v: boolean) {
    const { data: r, error } = await sb.from("coordenacoes").update({ usar_feriados_nacionais: v }).eq("id", coordenacaoId).select("id");
    if (error || !r?.length) { toast.error(error?.message || "Sem permissão para alterar esta coordenação."); return; }
    toast.success(v ? "Feriados nacionais passam a contar como dias não úteis." : "Feriados nacionais desligados.");
    await carregar();
  }
  async function adicionar() {
    if (!data || !nome.trim()) { toast.error("Informe data e nome."); return; }
    const { error } = await sb.from("feriados_coordenacao").insert({ coordenacao_id: coordenacaoId, data, nome: nome.trim() });
    if (error) { toast.error(error.message); return; }
    setData(""); setNome(""); await carregar();
  }
  async function remover(id: string) {
    const { error } = await sb.from("feriados_coordenacao").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await carregar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feriados</DialogTitle>
          <DialogDescription>{coordenacaoNome} — dias não úteis na contagem de prazos em dias úteis.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-md border p-3">
          <span className="text-sm">Considerar feriados nacionais como dias não úteis</span>
          <Switch checked={usar} onCheckedChange={alternar} />
        </div>
        <div className="text-xs text-muted-foreground">
          Feriados nacionais de {ano}: {feriadosNacionais(ano).map((f) => `${br(f.data).slice(0, 5)} ${f.nome}`).join(" · ")}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Feriados próprios da equipe</p>
          <div className="flex gap-2">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-40" />
            <Input placeholder="Nome (ex.: feriado municipal)" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Button size="icon" onClick={adicionar}><Plus className="h-4 w-4" /></Button>
          </div>
          {lista.length === 0 && <p className="text-xs text-muted-foreground">Nenhum feriado próprio.</p>}
          {lista.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
              <span>{br(f.data)} — {f.nome}</span>
              <Button size="icon" variant="ghost" onClick={() => remover(f.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
