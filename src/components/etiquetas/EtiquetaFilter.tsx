import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, X } from "lucide-react";
import { useEtiquetas, agruparEtiquetasPorNome, type EtiquetaModulo } from "@/hooks/useEtiquetas";

interface Props {
  modulo: EtiquetaModulo;
  coordenacaoId?: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

/** Filtro por etiqueta (modelo Astrea): lista alfabética, busca e chips com "x". */
export function EtiquetaFilter({ modulo, coordenacaoId, value, onChange, className }: Props) {
  const { data: catalogo = [] } = useEtiquetas(coordenacaoId ?? undefined, modulo);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);

  const grupos = useMemo(
    () => agruparEtiquetasPorNome(catalogo, coordenacaoId ?? null),
    [catalogo, coordenacaoId],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? grupos.filter((g) => g.nome.toLowerCase().includes(q)) : grupos;
  }, [grupos, busca]);

  const selecionadas = useMemo(
    () => grupos.filter((g) => g.ids.some((id) => value.includes(id))),
    [grupos, value],
  );

  /** Marca/desmarca todas as variações da etiqueta (mesmo nome em coordenações diferentes). */
  const toggle = (ids: string[], checked: boolean) => {
    if (checked) onChange(Array.from(new Set([...value, ...ids])));
    else onChange(value.filter((v) => !ids.includes(v)));
  };

  if (catalogo.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className || ""}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Tag className="w-3.5 h-3.5" />
            Etiquetas
            {value.length > 0 && (
              <span className="ml-1 text-[10px] rounded-full bg-primary text-primary-foreground px-1.5">
                {value.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar etiqueta..."
            className="h-7 text-xs mb-2"
          />
          <div className="max-h-64 overflow-auto space-y-1">
            {filtradas.map((g) => (
              <label
                key={g.principal.id}
                className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/60 cursor-pointer"
              >
                <Checkbox
                  checked={g.ids.some((id) => value.includes(id))}
                  onCheckedChange={(v) => toggle(g.ids, !!v)}
                />
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: g.cor }}
                />
                <span className="truncate">{g.nome}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <button
              type="button"
              className="mt-2 text-[10px] text-muted-foreground hover:underline"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </button>
          )}
        </PopoverContent>
      </Popover>

      {selecionadas.map((g) => (
        <Badge
          key={g.principal.id}
          className="text-[10px] h-6 gap-1 text-primary-foreground"
          style={{ backgroundColor: g.cor }}
        >
          {g.nome}
          <button
            type="button"
            onClick={() => toggle(g.ids, false)}
            title="Remover filtro"
            className="hover:opacity-80"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}