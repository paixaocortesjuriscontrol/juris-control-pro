import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ListChecks, Plus } from "lucide-react";
import { CATALOGO_PEDIDOS_TRABALHISTAS } from "@/constants/catalogoPedidosTrabalhistas";

interface PedidosCatalogoPickerProps {
  /** Pedidos já cadastrados no processo (para marcar como incluídos). */
  existentes?: string[];
  /** Adiciona os pedidos selecionados. */
  onAdicionar: (pedidos: string[]) => Promise<void> | void;
  /** Preenche o formulário manual com um pedido específico. */
  onUsarNoFormulario?: (pedido: string) => void;
  isSaving?: boolean;
}

const norm = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function PedidosCatalogoPicker({
  existentes = [],
  onAdicionar,
  onUsarNoFormulario,
  isSaving,
}: PedidosCatalogoPickerProps) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const existentesSet = useMemo(() => new Set(existentes.map(norm)), [existentes]);

  const grupos = useMemo(() => {
    const termo = norm(busca);
    if (!termo) return CATALOGO_PEDIDOS_TRABALHISTAS;
    return CATALOGO_PEDIDOS_TRABALHISTAS.map((g) => ({
      ...g,
      pedidos: g.pedidos.filter((p) => norm(p).includes(termo) || norm(g.grupo).includes(termo)),
    })).filter((g) => g.pedidos.length > 0);
  }, [busca]);

  const toggle = (pedido: string) =>
    setSelecionados((prev) =>
      prev.includes(pedido) ? prev.filter((p) => p !== pedido) : [...prev, pedido]
    );

  const toggleGrupo = (pedidos: string[]) => {
    const faltantes = pedidos.filter((p) => !selecionados.includes(p));
    setSelecionados((prev) =>
      faltantes.length > 0
        ? [...prev, ...faltantes]
        : prev.filter((p) => !pedidos.includes(p))
    );
  };

  const adicionar = async () => {
    if (selecionados.length === 0) return;
    await onAdicionar(selecionados);
    setSelecionados([]);
  };

  return (
    <div className="rounded-lg border bg-muted/20">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4" />
          Seleção rápida de pedidos
        </div>
        {selecionados.length > 0 && (
          <Badge variant="secondary" className="h-5 text-xs">
            {selecionados.length} selecionado{selecionados.length > 1 ? "s" : ""}
          </Badge>
        )}
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pedido..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="max-h-[320px] space-y-3 overflow-y-auto px-3 py-3">
        {grupos.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Nenhum pedido encontrado.
          </div>
        )}
        {grupos.map((g) => (
          <div key={g.grupo} className="space-y-1.5">
            <button
              type="button"
              onClick={() => toggleGrupo(g.pedidos)}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {g.grupo}
            </button>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {g.pedidos.map((p) => {
                const jaExiste = existentesSet.has(norm(p));
                const checked = selecionados.includes(p);
                return (
                  <div
                    key={p}
                    className={`group flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-transparent bg-background"
                    }`}
                  >
                    <Checkbox
                      id={`cat-${p}`}
                      checked={checked}
                      onCheckedChange={() => toggle(p)}
                    />
                    <label htmlFor={`cat-${p}`} className="flex-1 cursor-pointer leading-tight">
                      {p}
                      {jaExiste && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(já incluído)</span>
                      )}
                    </label>
                    {onUsarNoFormulario && (
                      <button
                        type="button"
                        onClick={() => onUsarNoFormulario(p)}
                        title="Detalhar no formulário"
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t px-3 py-2">
        {selecionados.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelecionados([])}>
            Limpar seleção
          </Button>
        )}
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={adicionar}
          disabled={selecionados.length === 0 || isSaving}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {isSaving
            ? "Adicionando..."
            : `Adicionar ${selecionados.length || ""} pedido${selecionados.length > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
