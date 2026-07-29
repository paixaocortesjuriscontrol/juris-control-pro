import { useState } from "react";
import { BookMarked, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useModelosTitulo, type ModeloTitulo, type TipoModelo } from "@/hooks/useModelosTitulo";

interface Props {
  tipo: TipoModelo;
  coordenacaoId?: string | null;
  onSelect: (modelo: ModeloTitulo) => void;
  className?: string;
}

/** Botão de sugestões de títulos (Modelos de Título por coordenação). */
export function ModeloTituloPicker({ tipo, coordenacaoId, onSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: modelos = [] } = useModelosTitulo({
    tipo,
    coordenacao_id: coordenacaoId || undefined,
  });

  if (modelos.length === 0) return null;

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
          Modelos ({modelos.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar modelo..." />
          <CommandList>
            <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
            <CommandGroup>
              {modelos.map((m) => (
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
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
