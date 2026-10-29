import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const db = supabase as any;

export interface ItemChecklistRow {
  id: string; titulo: string; ordem: number; marcado: boolean; marcado_em: string | null;
}

export function useChecklistItem(tipo: string, itemId?: string | null) {
  return useQuery({
    queryKey: ["checklist-itens", tipo, itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await db.from("checklist_itens").select("id,titulo,ordem,marcado,marcado_em")
        .eq("tipo_item", tipo).eq("item_id", itemId).order("ordem").order("created_at");
      if (error) throw error;
      return (data || []) as ItemChecklistRow[];
    },
  });
}

/** Copia os itens de um modelo para o item (como "usar modelo" do Projuris). */
export async function aplicarModeloChecklist(modeloId: string, tipo: string, itemId: string, userId: string, ordemInicial = 0) {
  const { data, error } = await db.from("checklist_modelo_itens").select("titulo,ordem").eq("modelo_id", modeloId).order("ordem");
  if (error) throw error;
  const rows = (data || []).map((m: any, i: number) => ({
    tipo_item: tipo, item_id: itemId, titulo: m.titulo, ordem: ordemInicial + i + 1, modelo_id: modeloId, criado_por: userId,
  }));
  if (rows.length) { const r = await db.from("checklist_itens").insert(rows); if (r.error) throw r.error; }
  return rows.length;
}

export function ItemChecklist({ tipo, itemId }: { tipo: string; itemId?: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: itens = [], isLoading } = useChecklistItem(tipo, itemId);
  const [novo, setNovo] = useState("");
  const { data: modelos = [] } = useQuery({
    queryKey: ["checklist-modelos"],
    queryFn: async () => (await db.from("checklist_modelos").select("id,nome").eq("ativo", true).order("nome")).data || [],
  });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["checklist-itens", tipo, itemId] });

  const marcar = useMutation({
    mutationFn: async (i: ItemChecklistRow) => {
      const { error } = await db.from("checklist_itens").update({
        marcado: !i.marcado, marcado_por: !i.marcado ? user?.id : null, marcado_em: !i.marcado ? new Date().toISOString() : null,
      }).eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: refrescar, onError: (e: any) => toast.error(e.message),
  });
  const maxOrdem = itens.reduce((m, i) => Math.max(m, i.ordem), 0);

  if (!itemId) return <p className="text-xs text-muted-foreground">Salve o item para usar o checklist.</p>;
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-2">
      {itens.length > 0 && (
        <p className="text-xs text-muted-foreground">{itens.filter((i) => i.marcado).length}/{itens.length} marcados</p>
      )}
      {itens.map((i) => (
        <div key={i.id} className="flex items-start gap-2 group">
          <Checkbox checked={i.marcado} onCheckedChange={() => marcar.mutate(i)} className="mt-0.5" />
          <span className={cn("text-sm flex-1 whitespace-pre-wrap", i.marcado && "text-muted-foreground")}>{i.titulo}</span>
          <button className="opacity-0 group-hover:opacity-100 text-muted-foreground" aria-label="Remover item"
            onClick={async () => { const { error } = await db.from("checklist_itens").delete().eq("id", i.id); if (error) toast.error(error.message); else await refrescar(); }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo item do checklist" className="h-8"
          onKeyDown={async (e) => {
            if (e.key !== "Enter" || !novo.trim() || !user) return;
            const { error } = await db.from("checklist_itens").insert({ tipo_item: tipo, item_id: itemId, titulo: novo.trim(), ordem: maxOrdem + 1, criado_por: user.id });
            if (error) toast.error(error.message); else { setNovo(""); await refrescar(); }
          }} />
        <Button size="sm" variant="outline" disabled={!novo.trim()} onClick={async () => {
          if (!user) return;
          const { error } = await db.from("checklist_itens").insert({ tipo_item: tipo, item_id: itemId, titulo: novo.trim(), ordem: maxOrdem + 1, criado_por: user.id });
          if (error) toast.error(error.message); else { setNovo(""); await refrescar(); }
        }}><Plus className="h-4 w-4" /></Button>
      </div>
      {modelos.length > 0 && (
        <Select value="" onValueChange={async (id) => {
          if (!user) return;
          try { const n = await aplicarModeloChecklist(id, tipo, itemId, user.id, maxOrdem); await refrescar(); toast.success(`${n} itens adicionados`); }
          catch (e: any) { toast.error(e.message); }
        }}>
          <SelectTrigger className="h-8 w-60"><SelectValue placeholder="Aplicar modelo de checklist" /></SelectTrigger>
          <SelectContent>{modelos.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  );
}
