import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, UserPlus, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserOpt {
  id: string;
  nome: string;
}

interface Coord {
  id: string;
  nome: string;
  membros: { usuario_id: string }[];
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  icon?: "user" | "users";
}

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * People picker profissional: popover + combobox + chips com avatares.
 * Inclui filtro por coordenação dentro do popover.
 */
export function PeoplePicker({
  selectedIds,
  onChange,
  placeholder = "Adicionar pessoa",
  emptyLabel = "Nenhuma pessoa selecionada",
  icon = "user",
}: Props) {
  const [open, setOpen] = useState(false);
  const [coordFiltro, setCoordFiltro] = useState<string>("todas");

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["people-picker-coords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select(`id, nome, membros:membros_coordenacao(usuario_id)`)
        .order("nome");
      if (error) throw error;
      return (data || []) as Coord[];
    },
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["people-picker-usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as UserOpt[];
    },
  });

  const filtrados = useMemo(() => {
    if (coordFiltro === "todas") return usuarios;
    const c = coordenacoes.find((x) => x.id === coordFiltro);
    const ids = new Set((c?.membros || []).map((m) => m.usuario_id));
    return usuarios.filter((u) => ids.has(u.id));
  }, [usuarios, coordenacoes, coordFiltro]);

  const selecionados = usuarios.filter((u) => selectedIds.includes(u.id));
  const Icon = icon === "users" ? Users : UserPlus;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const remover = (id: string) => onChange(selectedIds.filter((x) => x !== id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] rounded-md border bg-background px-2 py-1.5">
        {selecionados.length === 0 && (
          <span className="text-xs text-muted-foreground px-1">{emptyLabel}</span>
        )}
        {selecionados.map((u) => (
          <Badge
            key={u.id}
            variant="secondary"
            className="flex items-center gap-1.5 pl-1 pr-1 py-0.5 h-7 rounded-full"
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {initials(u.nome)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs">{u.nome}</span>
            <button
              type="button"
              onClick={() => remover(u.id)}
              className="rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Remover ${u.nome}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {placeholder}
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[320px] p-0 z-50 bg-popover"
            align="start"
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder="Buscar pessoa..." className="h-9" />
              <div className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCoordFiltro("todas")}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full shrink-0 border",
                    coordFiltro === "todas"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                  )}
                >
                  Todas
                </button>
                {coordenacoes.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCoordFiltro(c.id)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full shrink-0 border whitespace-nowrap",
                      coordFiltro === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                    )}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
              <CommandList className="max-h-[260px]">
                <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                <CommandGroup>
                  {filtrados.map((u) => {
                    const checked = selectedIds.includes(u.id);
                    return (
                      <CommandItem
                        key={u.id}
                        value={u.nome}
                        onSelect={() => toggle(u.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {initials(u.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm">{u.nome}</span>
                        {checked && <Check className="h-4 w-4 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {selecionados.length > 0 && (
                  <>
                    <CommandSeparator />
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => onChange([])}
                        className="w-full text-xs text-muted-foreground hover:text-destructive py-1.5 px-2 rounded hover:bg-muted text-left"
                      >
                        Limpar seleção ({selecionados.length})
                      </button>
                    </div>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}