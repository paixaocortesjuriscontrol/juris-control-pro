import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react";

/** Lista os assuntos das coordenações informadas; o campo continua livre para digitar. */
export function AssuntoPicker({ coordenacaoIds, onSelect }: { coordenacaoIds: string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ids = [...coordenacaoIds].filter(Boolean).sort();
  const { data = [] } = useQuery({
    queryKey: ["assuntos-coordenacao", "picker", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assuntos_coordenacao" as any)
        .select("id, nome")
        .in("coordenacao_id", ids)
        .order("nome");
      if (error) throw error;
      const vistos = new Set<string>();
      return ((data || []) as unknown as { id: string; nome: string }[]).filter((a) => {
        const k = a.nome.trim().toUpperCase();
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
    },
  });
  if (!data.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 mb-1 text-xs">
          <ListChecks className="w-3.5 h-3.5 mr-1" /> Escolher da lista
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar assunto..." />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Nenhum assunto.</CommandEmpty>
            {data.map((a) => (
              <CommandItem key={a.id} value={a.nome} onSelect={() => { onSelect(a.nome); setOpen(false); }}>
                <span className="text-sm">{a.nome}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
