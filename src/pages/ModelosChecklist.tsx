import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const db = supabase as any;

export default function ModelosChecklist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);
  const [novoModelo, setNovoModelo] = useState("");
  const [novoItem, setNovoItem] = useState("");

  const { data: modelos = [] } = useQuery({
    queryKey: ["checklist-modelos-todos"],
    queryFn: async () => (await db.from("checklist_modelos").select("id,nome,descricao,ativo").order("nome")).data || [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["checklist-modelo-itens", sel],
    enabled: !!sel,
    queryFn: async () => (await db.from("checklist_modelo_itens").select("id,titulo,ordem").eq("modelo_id", sel).order("ordem")).data || [],
  });
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: ["checklist-modelos-todos"] });
    await qc.invalidateQueries({ queryKey: ["checklist-modelos"] });
    await qc.invalidateQueries({ queryKey: ["checklist-modelo-itens", sel] });
  };
  const rodar = async (p: PromiseLike<{ error: any; data?: any }>, ok?: string) => {
    const { error, data } = await p;
    if (error) { toast.error(error.message); return false; }
    if (Array.isArray(data) && data.length === 0) { toast.error("Sem permissão para alterar modelos"); return false; }
    await refrescar(); if (ok) toast.success(ok); return true;
  };
  const modelo = modelos.find((m: any) => m.id === sel);

  const mover = async (idx: number, dir: -1 | 1) => {
    const a = itens[idx], b = itens[idx + dir];
    if (!a || !b) return;
    await db.from("checklist_modelo_itens").update({ ordem: b.ordem }).eq("id", a.id);
    await rodar(db.from("checklist_modelo_itens").update({ ordem: a.ordem }).eq("id", b.id).select());
  };

  return (
    <MainLayout title="Modelos de checklist">
      <div className="p-4 grid gap-4 md:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Modelos de checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {modelos.map((m: any) => (
              <button key={m.id} onClick={() => setSel(m.id)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm ${sel === m.id ? "border-primary bg-accent" : ""} ${m.ativo ? "" : "text-muted-foreground"}`}>
                {m.nome}{!m.ativo && " (inativo)"}
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Input value={novoModelo} onChange={(e) => setNovoModelo(e.target.value)} placeholder="Nome do novo modelo" className="h-8" />
              <Button size="sm" disabled={!novoModelo.trim()} onClick={async () => {
                const { data, error } = await db.from("checklist_modelos").insert({ nome: novoModelo.trim(), criado_por: user?.id }).select("id").single();
                if (error) return toast.error(error.message);
                setNovoModelo(""); setSel(data.id); await refrescar();
              }}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {modelo ? (
          <Card>
            <CardHeader className="space-y-3">
              <Input defaultValue={modelo.nome} key={`n${modelo.id}`} className="font-semibold"
                onBlur={(e) => e.target.value.trim() && e.target.value !== modelo.nome && rodar(db.from("checklist_modelos").update({ nome: e.target.value.trim() }).eq("id", modelo.id).select())} />
              <Input defaultValue={modelo.descricao || ""} key={`d${modelo.id}`} placeholder="Descrição (opcional)"
                onBlur={(e) => e.target.value !== (modelo.descricao || "") && rodar(db.from("checklist_modelos").update({ descricao: e.target.value || null }).eq("id", modelo.id).select())} />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={modelo.ativo} onCheckedChange={(v) => rodar(db.from("checklist_modelos").update({ ativo: v }).eq("id", modelo.id).select())} /> Ativo
                </label>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                  if (!confirm("Excluir este modelo? Os checklists já aplicados nas tarefas continuam.")) return;
                  if (await rodar(db.from("checklist_modelos").delete().eq("id", modelo.id).select(), "Modelo excluído")) setSel(null);
                }}><Trash2 className="h-4 w-4 mr-1" />Excluir modelo</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {itens.map((i: any, idx: number) => (
                <div key={i.id} className="flex items-center gap-2">
                  <Input defaultValue={i.titulo} className="h-8 flex-1"
                    onBlur={(e) => e.target.value.trim() && e.target.value !== i.titulo && rodar(db.from("checklist_modelo_itens").update({ titulo: e.target.value.trim() }).eq("id", i.id).select())} />
                  <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => mover(idx, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={idx === itens.length - 1} onClick={() => mover(idx, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => rodar(db.from("checklist_modelo_itens").delete().eq("id", i.id).select())} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="Novo item" className="h-8" />
                <Button size="sm" disabled={!novoItem.trim()} onClick={async () => {
                  const ordem = itens.reduce((m: number, i: any) => Math.max(m, i.ordem), 0) + 1;
                  if (await rodar(db.from("checklist_modelo_itens").insert({ modelo_id: modelo.id, titulo: novoItem.trim(), ordem }).select())) setNovoItem("");
                }}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground p-4">Escolha um modelo para editar os itens.</p>
        )}
      </div>
    </MainLayout>
  );
}
