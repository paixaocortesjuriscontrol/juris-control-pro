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
  useAtualizarCorTag,
  TAG_COLOR_PALETTE,
  ProcessoTag,
} from "@/hooks/useProcessoTags";
import { ColorPalettePicker } from "./ColorPalettePicker";

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
  const atualizarCor = useAtualizarCorTag();
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState<string>(TAG_COLOR_PALETTE[10]);
  const [open, setOpen] = useState(false);
  const [editandoCor, setEditandoCor] = useState<string | null>(null);

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
    const tag = await criar.mutateAsync({ nome, cor: novaCor });
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
          {tagsAplicadas.length > 0 && badges}
          <span
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            title={tagsAplicadas.length > 0 ? "Adicionar/remover TAGs" : "Adicionar TAG"}
          >
            <Tag className="w-3 h-3" />
            {tagsAplicadas.length === 0 && (compact ? "Tag" : "Adicionar TAG")}
          </span>
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
              <div
                key={t.id}
                className="text-xs hover:bg-muted/50 rounded px-1 py-0.5"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => handleToggle(t.id, !!v)}
                  />
                  <button
                    type="button"
                    className="inline-block w-3 h-3 rounded-full border border-border hover:scale-110 transition"
                    style={{ backgroundColor: t.cor }}
                    onClick={() => setEditandoCor(editandoCor === t.id ? null : t.id)}
                    title="Alterar cor"
                  />
                  <span className="flex-1 truncate">{t.nome}</span>
                </div>
                {editandoCor === t.id && (
                  <div className="pl-6 py-1">
                    <ColorPalettePicker
                      value={t.cor}
                      onChange={(c) => {
                        atualizarCor.mutate({ id: t.id, cor: c });
                        setEditandoCor(null);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t pt-2 space-y-1.5">
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full border border-border flex-shrink-0"
              style={{ backgroundColor: novaCor }}
              title={novaCor}
            />
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
          <ColorPalettePicker value={novaCor} onChange={setNovaCor} />
        </div>
      </PopoverContent>
    </Popover>
  );
}