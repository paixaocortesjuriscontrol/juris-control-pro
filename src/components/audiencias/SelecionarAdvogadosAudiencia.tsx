import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, X, Filter } from "lucide-react";

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
}

export function SelecionarAdvogadosAudiencia({ selectedAdvogados, onSelectionChange }: Props) {
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("todas");

  // Buscar coordenações com membros
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-com-membros"],
    queryFn: async () => {
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
      return todosAdvogados;
    }

    const coordenacao = coordenacoes.find(c => c.id === coordenacaoFiltro);
    if (!coordenacao) return todosAdvogados;

    const membrosIds = coordenacao.membros.map(m => m.usuario_id);
    return todosAdvogados.filter(a => membrosIds.includes(a.id));
  }, [todosAdvogados, coordenacoes, coordenacaoFiltro]);

  const toggleAdvogado = (advogadoId: string) => {
    if (selectedAdvogados.includes(advogadoId)) {
      onSelectionChange(selectedAdvogados.filter(id => id !== advogadoId));
    } else {
      onSelectionChange([...selectedAdvogados, advogadoId]);
    }
  };

  const removerAdvogado = (advogadoId: string) => {
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removerAdvogado(adv.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Filtro por coordenação */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={coordenacaoFiltro} onValueChange={setCoordenacaoFiltro}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Filtrar por coordenação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as coordenações</SelectItem>
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
              <div
                key={advogado.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleAdvogado(advogado.id)}
              >
                <Checkbox
                  checked={selectedAdvogados.includes(advogado.id)}
                  onCheckedChange={() => toggleAdvogado(advogado.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{advogado.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {advogado.oab && `OAB: ${advogado.oab} • `}
                    {advogado.email}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {selectedAdvogados.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedAdvogados.length} advogado(s) selecionado(s)
        </p>
      )}
    </div>
  );
}
