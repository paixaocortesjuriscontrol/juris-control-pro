import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMateriasBenner } from "@/hooks/useMateriasBenner";

const SEPARATOR = "; ";

function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseMateriasString(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/;|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinMaterias(values: string[]): string | null {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(SEPARATOR) : null;
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MateriasMultiSelect({
  value,
  onChange,
  placeholder = "Selecione uma ou mais matérias...",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const { dados, loading } = useMateriasBenner();

  const selected = useMemo(() => parseMateriasString(value), [value]);
  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected],
  );

  const toggle = (nome: string) => {
    const exists = selectedSet.has(nome.toLowerCase());
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== nome.toLowerCase())
      : [...selected, nome];
    onChange(joinMaterias(next));
  };

  const remove = (nome: string) => {
    const next = selected.filter(
      (s) => s.toLowerCase() !== nome.toLowerCase(),
    );
    onChange(joinMaterias(next));
  };

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return dados;
    return dados.filter(
      (m) =>
        normalize(m.nome).includes(q) ||
        normalize(m.descricao || "").includes(q),
    );
  }, [dados, busca]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {selected.length > 0
                ? `${selected.length} matéria${selected.length > 1 ? "s" : ""} selecionada${selected.length > 1 ? "s" : ""}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="flex flex-col">
            <div className="relative border-b border-border">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou descrição..."
                className="pl-9 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Carregando...
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma matéria encontrada.
              </div>
            ) : (
              <ScrollArea className="h-72">
                <div className="p-1">
                  {filtrados.map((m) => {
                    const isSelected = selectedSet.has(m.nome.toLowerCase());
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggle(m.nome)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-left"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{m.nome}</span>
                        {!m.ativo && (
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            inativa
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
            <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
              {filtrados.length} de {dados.length}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((nome) => (
            <Badge
              key={nome}
              variant="secondary"
              className="text-xs gap-1 pr-1"
            >
              <span className="max-w-[260px] truncate">{nome}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(nome)}
                  className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`Remover ${nome}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}