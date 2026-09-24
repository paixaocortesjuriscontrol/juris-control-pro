import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  baseOptions: string[];
}

export function EquipeTstSelect({ value, onChange, baseOptions }: Props) {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: extras = [] } = useQuery({
    queryKey: ["equipes-tst"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("equipes_tst" as any).select("nome");
      return ((data as any[]) || []).map((r) => String(r.nome));
    },
  });

  const options = Array.from(new Set([...baseOptions, ...extras])).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );

  const adicionar = async () => {
    const n = nome.trim();
    if (!n) return;
    if (options.some((o) => o.toLowerCase() === n.toLowerCase())) {
      toast.error("Essa equipe já existe na lista");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("equipes_tst" as any).insert({ nome: n } as any);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível incluir a equipe: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["equipes-tst"] });
    onChange(n);
    setNome("");
    setOpen(false);
    toast.success("Equipe incluída");
  };

  const current = String(value || "").trim();

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Select value={current || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Selecione</SelectItem>
            {options.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isAdmin && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" title="Incluir nova equipe">
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2" align="end">
            <p className="text-sm font-medium">Nova equipe</p>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da equipe"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
            />
            <Button type="button" size="sm" className="w-full" onClick={adicionar} disabled={saving || !nome.trim()}>
              {saving ? "Salvando..." : "Incluir"}
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
