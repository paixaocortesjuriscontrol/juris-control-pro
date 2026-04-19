import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfilesBasic } from "@/hooks/useDistribuicaoResponsaveis";

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  /** Se passado, restringe a combo aos membros desta coordenação */
  coordenacaoId?: string | null;
  /** Se true, mostra a opção "Não distribuído" no topo (filtro processos sem responsável) */
  includeUnassignedOption?: boolean;
}

export const UNASSIGNED_RESPONSAVEL_ID = "__sem_responsavel__";

export function ResponsaveisSelector({ selectedIds, onChange, placeholder = "Selecionar responsáveis...", className, coordenacaoId, includeUnassignedOption = false }: Props) {
  const [open, setOpen] = useState(false);
  const { profiles, loading } = useProfilesBasic(coordenacaoId);

  const toggle = (id: string) => {
    if (id === UNASSIGNED_RESPONSAVEL_ID) {
      // Mutuamente exclusivo: ao marcar "Não distribuído", limpa demais; ao desmarcar, esvazia
      if (selectedIds.includes(UNASSIGNED_RESPONSAVEL_ID)) onChange([]);
      else onChange([UNASSIGNED_RESPONSAVEL_ID]);
      return;
    }
    // Se "Não distribuído" estava marcado, removê-lo ao escolher um responsável real
    const base = selectedIds.filter(x => x !== UNASSIGNED_RESPONSAVEL_ID);
    if (base.includes(id)) onChange(base.filter(x => x !== id));
    else onChange([...base, id]);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(x => x !== id));
  };

  const selectedProfiles = profiles.filter(p => selectedIds.includes(p.id));
  const unassignedSelected = selectedIds.includes(UNASSIGNED_RESPONSAVEL_ID);

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between min-h-10 h-auto py-2">
            <div className="flex flex-wrap gap-1 items-center">
              {selectedProfiles.length === 0 && !unassignedSelected ? (
                <span className="text-muted-foreground flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> {placeholder}
                </span>
              ) : (
                <>
                  {unassignedSelected && (
                    <Badge variant="outline" className="gap-1 border-dashed">
                      Não distribuído
                      <button onClick={(e) => remove(UNASSIGNED_RESPONSAVEL_ID, e)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedProfiles.map(p => (
                    <Badge key={p.id} variant="secondary" className="gap-1">
                      {p.nome}
                      <button onClick={(e) => remove(p.id, e)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </>
              )}
            </div>
            <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 pointer-events-auto" align="start">
          <Command>
            <CommandInput placeholder="Buscar responsável..." />
            <CommandList>
              <CommandEmpty>{loading ? "Carregando..." : "Nenhum encontrado."}</CommandEmpty>
              <CommandGroup>
                {includeUnassignedOption && (
                  <CommandItem value="Não distribuído" onSelect={() => toggle(UNASSIGNED_RESPONSAVEL_ID)}>
                    <Check className={cn("mr-2 h-4 w-4", unassignedSelected ? "opacity-100" : "opacity-0")} />
                    <span className="italic text-muted-foreground">Não distribuído (sem responsável)</span>
                  </CommandItem>
                )}
                {profiles.map(p => (
                  <CommandItem key={p.id} value={p.nome} onSelect={() => toggle(p.id)}>
                    <Check className={cn("mr-2 h-4 w-4", selectedIds.includes(p.id) ? "opacity-100" : "opacity-0")} />
                    {p.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
