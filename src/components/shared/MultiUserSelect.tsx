import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, X, Filter, Search } from "lucide-react";

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
  label?: string;
  helperText?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** IDs sempre marcados: aparecem checados e não podem ser desmarcados */
  fixedIds?: string[];
  /** Texto da etiqueta mostrada ao lado dos sempre marcados */
  fixedLabel?: string;
  /** Altura da lista. Default 180px */
  height?: number;
}

/**
 * Seletor genérico de múltiplos usuários (membros) com filtro por coordenação e busca.
 * Usado para "Responsáveis" e "Envolvidos" em Tarefa/Evento/Prazo/Audiência.
 */
export function MultiUserSelect({
  label = "Selecionar usuários",
  helperText,
  selectedIds,
  onChange,
  fixedIds = [],
  fixedLabel = "Padrão",
  height = 180,
}: Props) {
  const [coordFiltro, setCoordFiltro] = useState<string>("todas");
  const [search, setSearch] = useState("");

  const fixedSet = useMemo(() => new Set(fixedIds), [JSON.stringify(fixedIds)]);

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["multi-user-select-coords"],
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
    queryKey: ["multi-user-select-usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data || []) as UserOpt[];
    },
  });

  const filtrados = useMemo(() => {
    let base = usuarios;
    if (coordFiltro !== "todas") {
      const c = coordenacoes.find((x) => x.id === coordFiltro);
      const ids = new Set((c?.membros || []).map((m) => m.usuario_id));
      base = base.filter((u) => ids.has(u.id));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      base = base.filter((u) => (u.nome || "").toLowerCase().includes(q));
    }
    return base;
  }, [usuarios, coordenacoes, coordFiltro, search]);

  const toggle = (id: string, on: boolean) => {
    if (fixedSet.has(id)) return;
    if (on) {
      if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter((x) => x !== id));
    }
  };

  const remover = (id: string) => onChange(selectedIds.filter((x) => x !== id));

  const selecionados = usuarios.filter((u) => selectedIds.includes(u.id) || fixedSet.has(u.id));

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs">
        <Users className="h-3.5 w-3.5" />
        {label}
      </Label>
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selecionados.map((u) => (
            <Badge key={u.id} variant="secondary" className="flex items-center gap-1">
              {u.nome}
              {fixedSet.has(u.id) ? (
                <span className="text-[10px] text-muted-foreground">{fixedLabel}</span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => remover(u.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1 sm:w-56">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={coordFiltro} onValueChange={setCoordFiltro}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Coordenação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as coordenações</SelectItem>
              {coordenacoes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="border rounded-md p-2" style={{ height }}>
        <div className="space-y-1">
          {filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhum usuário encontrado
            </p>
          ) : (
            filtrados.map((u) => {
              const fixo = fixedSet.has(u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={fixo || selectedIds.includes(u.id)}
                    disabled={fixo}
                    onCheckedChange={(c) => toggle(u.id, c === true)}
                  />
                  <span className="flex-1 truncate">{u.nome}</span>
                  {fixo && (
                    <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                      {fixedLabel}
                    </Badge>
                  )}
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}