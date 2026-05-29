import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, Plus, Loader2 } from "lucide-react";
import {
  useProcessoTagsCatalogo,
  useCriarTag,
  useToggleTagInDado,
  ProcessoTag,
} from "@/hooks/useProcessoTags";

interface Props {
  dadoId: string;
  tagIds: string[];
  /** Quando true, mostra apenas as tags como leitura (sem botão de editar). */
  readOnly?: boolean;
  compact?: boolean;
}

export function ProcessoTagPicker({ dadoId, tagIds, readOnly, compact }: Props) {
  const { data: catalogo = [], isLoading } = useProcessoTagsCatalogo();
  const criar = useCriarTag();
  const toggle = useToggleTagInDado();
  const [novoNome, setNovoNome] = useState("");
  const [open, setOpen] = useState(false);

  const tagsAplicadas: ProcessoTag[] = useMemo(() => {
    const s = new Set(tagIds);
    return catalogo.filter((t) => s.has(t.id));
  }, [catalogo, tagIds]);

  const handleToggle = (tagId: string, checked: boolean) => {
    toggle.mutate({ dadoId, tagId, checked });
  };

  const handleCriar = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    const tag = await criar.mutateAsync(nome);
    setNovoNome("");
    if (tag?.id) {
      toggle.mutate({ dadoId, tagId: tag.id, checked: true });
    }
  };

  const badges = (
    <div className="inline-flex flex-wrap gap-1 items-center">
      {tagsAplicadas.map((t) => (
        <Badge
          key={t.id}
          className="text-[10px] px-1 py-0 h-4 text-white hover:opacity-90"
          style={{ backgroundColor: t.cor }}
          title={t.nome}
        >
          {t.nome}
        </Badge>
      ))}
    </div>
  );

  if (readOnly) return badges;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:bg-muted/60 rounded px-1 py-0.5"
          onClick={(e) => e.stopPropagation()}
          title="Gerenciar TAGs"
        >
          {tagsAplicadas.length > 0 ? (
            badges
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Tag className="w-3 h-3" /> {compact ? "Tag" : "Adicionar TAG"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()} align="start">
        <div className="text-xs font-semibold mb-1">TAGs do processo</div>
        <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
          {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          {!isLoading && catalogo.length === 0 && (
            <div className="text-[11px] text-muted-foreground">Nenhuma TAG criada ainda.</div>
          )}
          {catalogo.map((t) => {
            const checked = tagIds.includes(t.id);
            return (
              <label
                key={t.id}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => handleToggle(t.id, !!v)}
                />
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: t.cor }}
                />
                <span className="flex-1 truncate">{t.nome}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-1 border-t pt-2">
          <Input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nova TAG..."
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCriar();
              }
            }}
          />
          <Button
            size="sm"
            className="h-7 px-2"
            disabled={!novoNome.trim() || criar.isPending}
            onClick={handleCriar}
          >
            {criar.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}