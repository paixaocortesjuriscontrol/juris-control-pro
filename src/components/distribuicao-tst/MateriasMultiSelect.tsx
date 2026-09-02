import { useEffect, useMemo, useState } from "react";
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

import { OUTRA_MATERIA_LABEL, isOutraMateria, normalizeMateriaNome } from "@/utils/outraMateria";
import {
  ensureMateriasOficiais,
  isMateriaOficialSync,
  materiasOficiaisCarregadas,
} from "@/utils/materiasOficiaisCache";


const SEPARATOR = "; ";

// Rótulo/helper centralizados em `src/utils/outraMateria.ts` — reexportados
// aqui para manter compatibilidade com os imports existentes.
export { OUTRA_MATERIA_LABEL, isOutraMateria };

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
  /**
   * Pedidos cadastrados para o dossiê do processo (nomes normalizados). Quando
   * informado, essas matérias aparecem primeiro na lista e em verde.
   */
  pedidosDossie?: Set<string>;
}

export function MateriasMultiSelect({
  value,
  onChange,
  placeholder = "Selecione uma ou mais matérias...",
  disabled,
  pedidosDossie,
}: Props) {

  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const { dados, loading } = useMateriasBenner();
  const [oficiaisProntas, setOficiaisProntas] = useState(materiasOficiaisCarregadas());

  useEffect(() => {
    let alive = true;
    ensureMateriasOficiais()
      .catch(() => {})
      .finally(() => {
        if (alive) setOficiaisProntas(materiasOficiaisCarregadas());
      });
    return () => {
      alive = false;
    };
    // Reavalia ao abrir o popover: o cache pode ter sido recarregado após uma
    // importação de pedidos.
  }, [open]);

  /** Matéria fora da lista oficial do Benner (nunca marca "Outra Matéria"). */
  const foraDaLista = (nome: string) =>
    oficiaisProntas && !isOutraMateria(nome) && !isMateriaOficialSync(nome);

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

  /** Matéria consta na lista de pedidos do dossiê deste processo. */
  const isDoDossie = (nome: string) =>
    !!pedidosDossie && pedidosDossie.size > 0 && pedidosDossie.has(normalizeMateriaNome(nome));

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    const base = !q
      ? dados
      : dados.filter(
          (m) =>
            normalize(m.nome).includes(q) ||
            normalize(m.descricao || "").includes(q),
        );
    if (!pedidosDossie || pedidosDossie.size === 0) return base;
    const doDossie = base.filter((m) => pedidosDossie.has(normalizeMateriaNome(m.nome)));
    const outros = base.filter((m) => !pedidosDossie.has(normalizeMateriaNome(m.nome)));
    return [...doDossie, ...outros];
  }, [dados, busca, pedidosDossie]);

  const qtdDoDossie = useMemo(
    () => filtrados.filter((m) => isDoDossie(m.nome)).length,
    [filtrados, pedidosDossie],
  );


  const mostrarOutra = !normalize(busca) || normalize(OUTRA_MATERIA_LABEL).includes(normalize(busca));
  const outraSelecionada = selectedSet.has(OUTRA_MATERIA_LABEL.toLowerCase());

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
                  {mostrarOutra && (
                    <button
                      type="button"
                      onClick={() => toggle(OUTRA_MATERIA_LABEL)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-left border-b border-border/50 mb-1"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          outraSelecionada ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate italic">{OUTRA_MATERIA_LABEL}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        preencher observação
                      </Badge>
                    </button>
                  )}
                  {filtrados.map((m, idx) => {
                    const isSelected = selectedSet.has(m.nome.toLowerCase());
                    const doDossie = isDoDossie(m.nome);
                    const ultimoDoDossie = doDossie && idx === qtdDoDossie - 1;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggle(m.nome)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-left",
                          doDossie && "bg-emerald-50",
                          ultimoDoDossie && "border-b border-border/50 mb-1",
                        )}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className={cn("truncate", doDossie && "text-emerald-700 font-medium")}>
                          {m.nome}
                          {foraDaLista(m.nome) && (
                            <span className="text-amber-600 text-xs"> (fora lista do Benner)</span>
                          )}
                        </span>
                        {doDossie && (
                          <Badge className="ml-auto text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">
                            pedido do dossiê
                          </Badge>
                        )}
                        {!m.ativo && !doDossie && (
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
              className={cn(
                "text-xs gap-1 pr-1",
                isDoDossie(nome) &&
                  "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-300",
              )}
              title={isDoDossie(nome) ? "Pedido cadastrado para este dossiê" : undefined}
            >

              <span className="max-w-[260px] truncate">
                {nome}
                {foraDaLista(nome) && (
                  <span className="text-amber-600"> (fora lista do Benner)</span>
                )}
              </span>
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