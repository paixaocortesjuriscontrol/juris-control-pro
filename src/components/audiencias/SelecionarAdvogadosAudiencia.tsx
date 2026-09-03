import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, X, Filter, Lock } from "lucide-react";

interface Advogado {
  id: string;
  nome: string;
  email: string;
  oab: string | null;
}

interface Coordenacao {
  id: string;
  nome: string;
  membros: Array<{
    usuario_id: string;
  }>;
}

interface Props {
  selectedAdvogados: string[];
  onSelectionChange: (advogados: string[]) => void;
  /** Responsáveis fixos da coordenação: não podem ser removidos */
  lockedIds?: string[];
}

export function SelecionarAdvogadosAudiencia({ selectedAdvogados, onSelectionChange, lockedIds = [] }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("todas");
  const [coordenacaoFiltroTouched, setCoordenacaoFiltroTouched] = useState(false);

  // Buscar coordenações com membros — admin vê todas; demais somente as suas
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-com-membros", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!isAdmin) {
        const [membros, coord] = await Promise.all([
          supabase.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", user!.id),
          supabase.from("coordenacoes").select("id").eq("coordenador_id", user!.id),
        ]);
        const ids = Array.from(new Set([
          ...((membros.data || []).map((m: any) => m.coordenacao_id)),
          ...((coord.data || []).map((c: any) => c.id)),
        ]));
        if (ids.length === 0) return [] as Coordenacao[];
        const { data, error } = await supabase
          .from("coordenacoes")
          .select(`id, nome, membros:membros_coordenacao(usuario_id)`)
          .in("id", ids)
          .order("nome");
        if (error) throw error;
        return (data || []) as Coordenacao[];
      }
      const { data, error } = await supabase
        .from("coordenacoes")
        .select(`
          id,
          nome,
          membros:membros_coordenacao(usuario_id)
        `)
        .order("nome");

      if (error) throw error;
      return data as Coordenacao[];
    },
  });

  useEffect(() => {
    if (isAdmin || coordenacaoFiltroTouched || !coordenacoes.length) return;
    const primeiraCoordenacao = coordenacoes[0]?.id;
    if (primeiraCoordenacao && coordenacaoFiltro !== primeiraCoordenacao) {
      setCoordenacaoFiltro(primeiraCoordenacao);
    }
  }, [isAdmin, coordenacaoFiltroTouched, coordenacoes, coordenacaoFiltro]);

  // Buscar todos os advogados ativos
  const { data: todosAdvogados = [] } = useQuery({
    queryKey: ["advogados-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, oab")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as Advogado[];
    },
  });

  // Filtrar advogados por coordenação
  const advogadosFiltrados = useMemo(() => {
    if (coordenacaoFiltro === "todas") {
      if (!isAdmin) {
        const ids = new Set(coordenacoes.flatMap((c) => (c.membros || []).map((m) => m.usuario_id)));
        return todosAdvogados.filter((a) => ids.has(a.id));
      }
      return todosAdvogados;
    }

    const coordenacao = coordenacoes.find(c => c.id === coordenacaoFiltro);
    if (!coordenacao) return isAdmin ? todosAdvogados : [];

    const membrosIds = coordenacao.membros.map(m => m.usuario_id);
    return todosAdvogados.filter(a => membrosIds.includes(a.id));
  }, [todosAdvogados, coordenacoes, coordenacaoFiltro, isAdmin]);

  const isLocked = (id: string) => lockedIds.includes(id);

  const toggleAdvogado = (advogadoId: string) => {
    if (isLocked(advogadoId)) return;
    if (selectedAdvogados.includes(advogadoId)) {
      onSelectionChange(selectedAdvogados.filter(id => id !== advogadoId));
    } else {
      onSelectionChange([...selectedAdvogados, advogadoId]);
    }
  };

  const removerAdvogado = (advogadoId: string) => {
    if (isLocked(advogadoId)) return;
    onSelectionChange(selectedAdvogados.filter(id => id !== advogadoId));
  };

  const handleCheckedChange = (advogadoId: string, checked: boolean | "indeterminate") => {
    if (isLocked(advogadoId)) return;
    if (checked === true) {
      if (!selectedAdvogados.includes(advogadoId)) {
        onSelectionChange([...selectedAdvogados, advogadoId]);
      }
      return;
    }

    onSelectionChange(selectedAdvogados.filter(id => id !== advogadoId));
  };

  const advogadosSelecionadosInfo = todosAdvogados.filter(a => selectedAdvogados.includes(a.id));

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        Advogados Responsáveis
      </Label>

      {/* Advogados selecionados */}
      {advogadosSelecionadosInfo.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {advogadosSelecionadosInfo.map(adv => (
            <Badge key={adv.id} variant="secondary" className="flex items-center gap-1">
              {adv.nome}
              {adv.oab && <span className="text-xs opacity-70">({adv.oab})</span>}
              {isLocked(adv.id) ? (
                <Lock className="h-3 w-3 opacity-70" />
              ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removerAdvogado(adv.id)}
              >
                <X className="h-3 w-3" />
              </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Filtro por coordenação */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={coordenacaoFiltro}
          onValueChange={(value) => {
            setCoordenacaoFiltroTouched(true);
            setCoordenacaoFiltro(value);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Filtrar por coordenação" />
          </SelectTrigger>
          <SelectContent>
            {isAdmin && (
              <SelectItem value="todas">Todas as coordenações</SelectItem>
            )}
            {coordenacoes.map(coord => (
              <SelectItem key={coord.id} value={coord.id}>
                {coord.nome} ({coord.membros.length} membros)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de advogados */}
      <ScrollArea className="h-[200px] border rounded-md p-2">
        <div className="space-y-2">
          {advogadosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum advogado encontrado nesta coordenação
            </p>
          ) : (
            advogadosFiltrados.map(advogado => (
              <label
                key={advogado.id}
                htmlFor={`audiencia-advogado-${advogado.id}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`audiencia-advogado-${advogado.id}`}
                  checked={selectedAdvogados.includes(advogado.id)}
                  disabled={isLocked(advogado.id)}
                  onCheckedChange={(checked) => handleCheckedChange(advogado.id, checked)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    {advogado.nome}
                    {isLocked(advogado.id) && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {advogado.oab && `OAB: ${advogado.oab} • `}
                    {advogado.email}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
      </ScrollArea>

      {selectedAdvogados.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedAdvogados.length} advogado(s) selecionado(s)
        </p>
      )}
      {lockedIds.length > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" /> Responsáveis fixos configurados para Audiência não podem ser removidos.
        </p>
      )}
    </div>
  );
}
