import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, Plus, Loader2, Pencil, XCircle, Check, X, Eye, EyeOff } from "lucide-react";
import {
  useProcessoTagsCatalogo,
  useCriarTag,
  useToggleTagInDado,
  useAtualizarCorTag,
  useRenomearTag,
  useAtualizarVisibilidadeTag,
  useRemoverTodasTagsDoDado,
  TAG_COLOR_PALETTE,
  ProcessoTag,
} from "@/hooks/useProcessoTags";
import { useUserRole } from "@/hooks/useUserRole";
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
  const renomear = useRenomearTag();
  const visibilidade = useAtualizarVisibilidadeTag();
  const { isAdmin } = useUserRole();
  const removerTodas = useRemoverTodasTagsDoDado();
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState<string>(TAG_COLOR_PALETTE[10]);
  const [open, setOpen] = useState(false);
  const [editandoCor, setEditandoCor] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");

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

  const iniciarEdicaoNome = (t: ProcessoTag) => {
    setEditandoNome(t.id);
    setNomeEditado(t.nome);
    setEditandoCor(null);
  };

  const salvarNome = async (id: string) => {
    const novo = nomeEditado.trim();
    if (!novo) return;
    await renomear.mutateAsync({ id, nome: novo });
    setEditandoNome(null);
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
      <PopoverContent className="w-96 p-2" onClick={(e) => e.stopPropagation()} align="start">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold">TAGs do processo</div>
          {tagsAplicadas.length > 0 && (
            <button
              type="button"
              className="text-[10px] text-destructive hover:underline inline-flex items-center gap-1"
              onClick={() => removerTodas.mutate(dadoId)}
              disabled={removerTodas.isPending}
              title="Remover todas as TAGs deste processo"
            >
              <XCircle className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
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
                  {editandoNome === t.id ? (
                    <>
                      <Input
                        value={nomeEditado}
                        onChange={(e) => setNomeEditado(e.target.value)}
                        className="h-6 text-xs flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); salvarNome(t.id); }
                          if (e.key === "Escape") { e.preventDefault(); setEditandoNome(null); }
                        }}
                      />
                      <button
                        type="button"
                        className="text-emerald-600 hover:text-emerald-700"
                        onClick={() => salvarNome(t.id)}
                        disabled={renomear.isPending}
                        title="Salvar"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setEditandoNome(null)}
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 break-words">{t.nome}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          className={
                            "opacity-70 hover:opacity-100 " +
                            (t.publica === false ? "text-amber-600" : "text-emerald-600")
                          }
                          onClick={() =>
                            visibilidade.mutate({ id: t.id, publica: t.publica === false })
                          }
                          disabled={visibilidade.isPending}
                          title={
                            t.publica === false
                              ? "TAG restrita ao administrador — clique para tornar pública"
                              : "TAG pública (todos veem) — clique para restringir ao administrador"
                          }
                        >
                          {t.publica === false ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                        onClick={() => iniciarEdicaoNome(t)}
                        title="Renomear TAG"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
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