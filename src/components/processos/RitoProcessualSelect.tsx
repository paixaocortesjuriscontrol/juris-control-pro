import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { chaveRito } from "@/lib/ritoProcessual";

export function useRitosProcessuais() {
  return useQuery({
    queryKey: ["ritos-processuais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ritos_processuais").select("nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data || []).map((r: any) => r.nome as string);
    },
    staleTime: 5 * 60_000,
  });
}

export async function garantirRito(nome: string, existentes: string[]): Promise<string> {
  const achado = existentes.find((r) => chaveRito(r) === chaveRito(nome));
  if (achado) return achado;
  const { error } = await (supabase as any).from("ritos_processuais").insert({ nome });
  if (error && error.code !== "23505") throw error;
  return nome;
}

export function RitoProcessualSelect({ value, onChange, className }: {
  value: string | null | undefined; onChange: (v: string) => void; className?: string;
}) {
  const qc = useQueryClient();
  const { data: ritos = [] } = useRitosProcessuais();
  const [novo, setNovo] = useState<string | null>(null);

  const salvarNovo = async () => {
    const nome = (novo || "").replace(/\s+/g, " ").trim();
    if (!nome) return;
    try {
      const final = await garantirRito(nome, ritos);
      await qc.invalidateQueries({ queryKey: ["ritos-processuais"] });
      onChange(final);
      setNovo(null);
    } catch (e: any) {
      toast.error("Não foi possível adicionar o rito: " + (e?.message || e));
    }
  };

  if (novo !== null) {
    return (
      <div className="flex gap-1">
        <Input autoFocus value={novo} placeholder="Nome do novo rito" className={className}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") salvarNovo(); if (e.key === "Escape") setNovo(null); }} />
        <Button size="sm" onClick={salvarNovo}>Adicionar</Button>
        <Button size="sm" variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button>
      </div>
    );
  }

  return (
    <Select value={value || "__vazio"} onValueChange={(v) => {
      if (v === "__novo") return setNovo("");
      onChange(v === "__vazio" ? "" : v);
    }}>
      <SelectTrigger className={className}><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__vazio">—</SelectItem>
        {value && !ritos.includes(value) && <SelectItem value={value}>{value}</SelectItem>}
        {ritos.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        <SelectItem value="__novo">+ Adicionar novo rito</SelectItem>
      </SelectContent>
    </Select>
  );
}
