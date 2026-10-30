import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookMarked, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useModelosTitulo, type ModeloTitulo, type TipoModelo } from "@/hooks/useModelosTitulo";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

interface Props {
  tipo: TipoModelo;
  coordenacaoId?: string | null;
  onSelect: (modelo: ModeloTitulo) => void;
  className?: string;
}

/** Botão de sugestões de títulos (Modelos de tarefas por coordenação). */
export function ModeloTituloPicker({ tipo, coordenacaoId, onSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  // Busca TODOS os modelos do tipo (o usuário só enxerga o que tem acesso).
  // Nunca filtramos pela coordenação na query para o botão não sumir ao trocar de coordenação.
  const { data: todosModelos = [] } = useModelosTitulo({ tipo });
  const { isAdmin, coordenacoes: minhasCoordenacoes } = useCoordenacoesDoUsuario();

  // Só exibe modelos das coordenações às quais o usuário logado pertence (admin vê todas).
  const modelos = useMemo(() => {
    if (isAdmin) return todosModelos;
    const permitidas = new Set(minhasCoordenacoes.map((c) => c.id));
    return todosModelos.filter((m) => permitidas.has(m.coordenacao_id));
  }, [todosModelos, isAdmin, minhasCoordenacoes]);

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-nomes-modelos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coordenacoes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const nomePorId = useMemo(
    () => Object.fromEntries(coordenacoes.map((c: any) => [c.id, c.nome as string])),
    [coordenacoes],
  );

  // Coordenações que têm modelos visíveis ao usuário
  const coordsComModelos = useMemo(() => {
    const ids = new Set(modelos.map((m) => m.coordenacao_id));
    return coordenacoes.filter((c: any) => ids.has(c.id));
  }, [modelos, coordenacoes]);
  const mostrarSeletor = isAdmin || minhasCoordenacoes.length > 1;
  const [coordEscolhida, setCoordEscolhida] = useState<string>("");
  const coordPadrao =
    (coordenacaoId && coordsComModelos.some((c: any) => c.id === coordenacaoId) && coordenacaoId) ||
    (minhasCoordenacoes.find((c) => coordsComModelos.some((x: any) => x.id === c.id))?.id) ||
    coordsComModelos[0]?.id || "";
  const coordAtiva = mostrarSeletor ? (coordEscolhida || coordPadrao) : (minhasCoordenacoes[0]?.id || "");
  const visiveis = coordAtiva ? modelos.filter((m) => m.coordenacao_id === coordAtiva) : modelos;

  if (modelos.length === 0) return null;

  const renderItem = (m: ModeloTitulo) => (
    <CommandItem
      key={m.id}
      value={`${m.nome} ${m.titulo}`}
      onSelect={() => {
        onSelect(m);
        setOpen(false);
      }}
      className="flex flex-col items-start gap-0.5"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Check className="h-3.5 w-3.5 opacity-0" />
        {m.nome}
      </span>
      <span className="pl-5 text-xs text-muted-foreground line-clamp-2">{m.titulo}</span>
      {nomePorId[m.coordenacao_id] && (
        <span className="pl-5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {nomePorId[m.coordenacao_id]}
        </span>
      )}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={"h-7 gap-1.5 text-xs " + (className ?? "")}
        >
          <BookMarked className="h-3.5 w-3.5" />
          Modelos
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        {mostrarSeletor && coordsComModelos.length > 0 && (
          <div className="p-2 border-b">
            <label className="text-[11px] text-muted-foreground">Coordenação</label>
            <select
              className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={coordAtiva}
              onChange={(e) => setCoordEscolhida(e.target.value)}
            >
              {coordsComModelos.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        <Command>
          <CommandInput placeholder="Buscar modelo..." />
          <CommandList>
            <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
            {visiveis.length > 0 && <CommandGroup>{visiveis.map(renderItem)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
