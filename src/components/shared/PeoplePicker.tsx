import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacaoPadrao } from "@/hooks/useCoordenacaoPadrao";
import { useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, UserPlus, X, Users } from "lucide-react";

interface UserOpt {
  id: string;
  nome: string;
}

interface Coord {
  id: string;
  nome: string;
  coordenador_id?: string | null;
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
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: coordPadraoId } = useCoordenacaoPadrao();
  const [coordFiltro, setCoordFiltro] = useState<string>("todas");
  const [coordFiltroTouched, setCoordFiltroTouched] = useState(false);

  // Coordenações: admin vê todas; demais veem apenas as suas (membro ou coordenador)
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["people-picker-coords", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from("coordenacoes")
          .select(`id, nome, coordenador_id, membros:membros_coordenacao(usuario_id)`)
          .order("nome");
        if (error) throw error;
        return (data || []) as Coord[];
      }
      const [membros, coordenador] = await Promise.all([
        supabase.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", user!.id),
        supabase.from("coordenacoes").select("id").eq("coordenador_id", user!.id),
      ]);
      const ids = Array.from(new Set([
        ...((membros.data || []).map((m: any) => m.coordenacao_id)),
        ...((coordenador.data || []).map((c: any) => c.id)),
      ]));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("coordenacoes")
        .select(`id, nome, coordenador_id, membros:membros_coordenacao(usuario_id)`)
        .in("id", ids)
        .order("nome");
      if (error) throw error;
      return (data || []) as Coord[];
    },
  });

  // Pré-seleciona coordenação padrão do usuário assim que estiver disponível
  useEffect(() => {
    if (coordFiltroTouched) return;
    if (isAdmin) return;
    if (!coordenacoes.length) return;
    const alvo = coordPadraoId && coordenacoes.some((c) => c.id === coordPadraoId)
      ? coordPadraoId
      : coordenacoes[0].id;
    if (alvo && coordFiltro !== alvo) setCoordFiltro(alvo);
  }, [isAdmin, coordPadraoId, coordenacoes, coordFiltroTouched]);

  const { data: usuarios = [] } = useQuery({
    queryKey: ["people-picker-usuarios"],
    queryFn: async () => {
      // profiles tem RLS restritiva (usuário só enxerga o próprio registro).
      // profiles_basic é a fonte segura para listar a equipe inteira.
      const { data, error } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .order("nome");
      if (!error && data && data.length > 0) {
        return (data as any[])
          .filter((u) => u.id && u.nome)
          .map((u) => ({ id: u.id as string, nome: u.nome as string }));
      }
      const fallback = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (fallback.error) throw fallback.error;
      return (fallback.data || []) as UserOpt[];
    },
  });

  const membrosDe = (c?: Coord) => {
    const ids = new Set((c?.membros || []).map((m) => m.usuario_id));
    if (c?.coordenador_id) ids.add(c.coordenador_id);
    return ids;
  };

  const filtrados = useMemo(() => {
    if (coordFiltro === "todas") {
      // Não-admin sem coordenação selecionada: restringe aos membros de suas coordenações
      if (!isAdmin && coordenacoes.length > 0) {
        const ids = new Set(coordenacoes.flatMap((c) => Array.from(membrosDe(c))));
        return usuarios.filter((u) => ids.has(u.id));
      }
      return usuarios;
    }
    const c = coordenacoes.find((x) => x.id === coordFiltro);
    const ids = membrosDe(c);
    return usuarios.filter((u) => ids.has(u.id));
  }, [usuarios, coordenacoes, coordFiltro, isAdmin]);

  const selecionados = selectedIds
    .map((id) => usuarios.find((u) => u.id === id) || { id, nome: "Usuário" })
    .filter(Boolean) as UserOpt[];
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
              <div className="px-2 py-1.5 border-b">
                <Select
                  value={coordFiltro}
                  onValueChange={(v) => { setCoordFiltroTouched(true); setCoordFiltro(v); }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Filtrar por coordenação" />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {isAdmin && (
                      <SelectItem value="todas">Todas as coordenações</SelectItem>
                    )}
                    {coordenacoes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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