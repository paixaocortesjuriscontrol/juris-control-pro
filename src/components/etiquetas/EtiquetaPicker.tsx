import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, Loader2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useEtiquetas,
  useEtiquetasDoItem,
  useToggleEtiquetaItem,
  useRemoverTodasEtiquetasDoItem,
  moduloDaEntidade,
  type Etiqueta,
  type EtiquetaEntidade,
} from "@/hooks/useEtiquetas";
import { EtiquetaBadges } from "./EtiquetaBadges";

interface Props {
  entidade: EtiquetaEntidade;
  entidadeId?: string | null;
  /** Coordenação do item; sem ela lista as etiquetas de todas as coordenações do usuário. */
  coordenacaoId?: string | null;
  readOnly?: boolean;
  compact?: boolean;
  /** Ids já carregados em lote (evita uma consulta por linha). */
  etiquetaIds?: string[];
  /** Nome da coordenação, exibido no cabeçalho do painel. */
  coordenacaoNome?: string | null;
}

/**
 * Popover de etiquetas (modelo Astrea): ícone de etiqueta, busca em ordem
 * alfabética e checkboxes para aplicar/remover. Somente etiquetas da
 * coordenação do item e habilitadas para o módulo são exibidas.
 */
export function EtiquetaPicker({
  entidade,
  entidadeId,
  coordenacaoId,
  readOnly,
  compact,
  etiquetaIds,
  coordenacaoNome,
}: Props) {
  const modulo = moduloDaEntidade(entidade);
  const { data: catalogo = [], isLoading } = useEtiquetas(coordenacaoId ?? undefined, modulo);
  const { data: idsDoItem = [] } = useEtiquetasDoItem(
    entidade,
    etiquetaIds ? null : entidadeId,
  );
  const aplicadosIds = etiquetaIds ?? idsDoItem;
  const toggle = useToggleEtiquetaItem();
  const removerTodas = useRemoverTodasEtiquetasDoItem();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);

  const aplicadas: Etiqueta[] = useMemo(() => {
    const s = new Set(aplicadosIds);
    return catalogo.filter((e) => s.has(e.id));
  }, [catalogo, aplicadosIds]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? catalogo.filter((e) => e.nome.toLowerCase().includes(q)) : catalogo;
  }, [catalogo, busca]);

  if (readOnly || !entidadeId) return <EtiquetaBadges etiquetas={aplicadas} />;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <span
        className="inline-flex items-center gap-1.5 align-middle"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {aplicadas.length > 0 && <EtiquetaBadges etiquetas={aplicadas} />}
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            title="Aplicar etiqueta"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <Tag className="h-3.5 w-3.5" />
            {aplicadas.length > 0
              ? `Etiquetas (${aplicadas.length})`
              : compact
                ? "Etiqueta"
                : "Adicionar etiqueta"}
          </Button>
        </PopoverTrigger>
      </span>
      <PopoverContent
        className="w-80 p-2"
        align="start"
        onPointerDownOutside={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="text-xs font-semibold">Aplicar etiqueta</div>
            {coordenacaoNome && (
              <div className="text-[10px] text-muted-foreground truncate max-w-[210px]">
                {coordenacaoNome}
              </div>
            )}
          </div>
          {aplicadas.length > 0 && (
            <button
              type="button"
              className="text-[10px] text-destructive hover:underline"
              onClick={() => removerTodas.mutate({ entidade, entidadeId })}
              disabled={removerTodas.isPending}
            >
              Remover todas
            </button>
          )}
        </div>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar etiqueta..."
          className="h-7 text-xs mb-2"
        />
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2 space-y-1">
            <p>
              Nenhuma etiqueta cadastrada para este módulo
              {coordenacaoNome ? ` na coordenação ${coordenacaoNome}` : ""}.
            </p>
            <p>Cadastre a etiqueta e habilite o módulo correspondente.</p>
            <Link
              to="/etiquetas"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> Gerenciar etiquetas
            </Link>
          </div>
        ) : (
          <div className="max-h-64 overflow-auto space-y-1">
            {filtradas.map((e) => {
              const checked = aplicadosIds.includes(e.id);
              return (
                <label
                  key={e.id}
                  className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/60 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      toggle.mutate({
                        etiquetaId: e.id,
                        entidade,
                        entidadeId,
                        checked: !!v,
                      })
                    }
                  />
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: e.cor }}
                  />
                  <span className="truncate">{e.nome}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}