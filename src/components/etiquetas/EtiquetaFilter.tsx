import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, X } from "lucide-react";
import { useEtiquetas, type EtiquetaModulo } from "@/hooks/useEtiquetas";

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

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? catalogo.filter((e) => e.nome.toLowerCase().includes(q)) : catalogo;
  }, [catalogo, busca]);

  const selecionadas = useMemo(
    () => catalogo.filter((e) => value.includes(e.id)),
    [catalogo, value],
  );

  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
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
            {filtradas.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/60 cursor-pointer"
              >
                <Checkbox
                  checked={value.includes(e.id)}
                  onCheckedChange={(v) => toggle(e.id, !!v)}
                />
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: e.cor }}
                />
                <span className="truncate">{e.nome}</span>
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

      {selecionadas.map((e) => (
        <Badge
          key={e.id}
          className="text-[10px] h-6 gap-1 text-primary-foreground"
          style={{ backgroundColor: e.cor }}
        >
          {e.nome}
          <button
            type="button"
            onClick={() => toggle(e.id, false)}
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