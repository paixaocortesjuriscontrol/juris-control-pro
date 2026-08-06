import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, Loader2, Check, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProcessoTagsCatalogo,
  useCriarTag,
  useAtualizarCorTag,
  useAtualizarVisibilidadeTag,
  TAG_COLOR_PALETTE,
} from "@/hooks/useProcessoTags";
import { useUserRole } from "@/hooks/useUserRole";
import { ColorPalettePicker } from "./ColorPalettePicker";
import { fetchAllDistribuicaoTstIds, DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";

interface Props {
  selectedIds: string[];
  filters: DistribuicaoTstFilters;
  totalFiltered: number;
}

const CHUNK = 200;

async function applyTagToIds(ids: string[], tagId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const rows = slice.map((dado_benner_id) => ({
      dado_benner_id,
      tag_id: tagId,
      created_by: uid,
    }));
    const { error } = await supabase
      .from("dados_benner_processo_tags" as any)
      .upsert(rows as any, { onConflict: "dado_benner_id,tag_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function removeTagFromIds(ids: string[], tagId: string) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("dados_benner_processo_tags" as any)
      .delete()
      .eq("tag_id", tagId)
      .in("dado_benner_id", slice);
    if (error) throw error;
  }
}

export function BulkTagAction({ selectedIds, filters, totalFiltered }: Props) {
  const { data: catalogo = [], isLoading } = useProcessoTagsCatalogo();
  const criar = useCriarTag();
  const atualizarCor = useAtualizarCorTag();
  const visibilidade = useAtualizarVisibilidadeTag();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState<string>(TAG_COLOR_PALETTE[10]);
  const [editandoCor, setEditandoCor] = useState<string | null>(null);
  const [busyTag, setBusyTag] = useState<string | null>(null);

  const usingSelection = selectedIds.length > 0;
  const count = usingSelection ? selectedIds.length : totalFiltered;

  async function resolveIds(): Promise<string[]> {
    if (usingSelection) return selectedIds;
    return await fetchAllDistribuicaoTstIds(filters);
  }

  async function handleApply(tagId: string) {
    try {
      setBusyTag(tagId + ":apply");
      const ids = await resolveIds();
      if (ids.length === 0) {
        toast.info("Nenhum processo para aplicar a TAG");
        return;
      }
      await applyTagToIds(ids, tagId);
      await qc.invalidateQueries({ queryKey: ["dados-benner-tags"] });
      toast.success(`TAG aplicada a ${ids.length} processo(s)`);
    } catch (err: any) {
      toast.error("Erro ao aplicar TAG: " + (err?.message || ""));
    } finally {
      setBusyTag(null);
    }
  }

  async function handleRemove(tagId: string) {
    try {
      setBusyTag(tagId + ":remove");
      const ids = await resolveIds();
      if (ids.length === 0) {
        toast.info("Nenhum processo para remover a TAG");
        return;
      }
      await removeTagFromIds(ids, tagId);
      await qc.invalidateQueries({ queryKey: ["dados-benner-tags"] });
      toast.success(`TAG removida de ${ids.length} processo(s)`);
    } catch (err: any) {
      toast.error("Erro ao remover TAG: " + (err?.message || ""));
    } finally {
      setBusyTag(null);
    }
  }

  async function handleCriar() {
    const nome = novoNome.trim();
    if (!nome) return;
    const tag = await criar.mutateAsync({ nome, cor: novaCor });
    setNovoNome("");
    if (tag?.id) {
      await handleApply(tag.id);
    }
  }

  const label = usingSelection
    ? `TAGs (${count} selecionado${count === 1 ? "" : "s"})`
    : `TAGs (todos filtrados${count ? `: ${count}` : ""})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-violet-500 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30"
        >
          <Tag className="w-3 h-3 mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="text-xs font-semibold mb-1">
          Aplicar/remover TAGs em{" "}
          {usingSelection
            ? `${count} processo(s) selecionado(s)`
            : `todos os processos filtrados${count ? ` (${count})` : ""}`}
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1 mb-2 border rounded p-1">
          {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          {!isLoading && catalogo.length === 0 && (
            <div className="text-[11px] text-muted-foreground px-1 py-2">
              Nenhuma TAG criada ainda. Crie a primeira abaixo.
            </div>
          )}
          {catalogo.map((t) => {
            const applying = busyTag === t.id + ":apply";
            const removing = busyTag === t.id + ":remove";
            const anyBusy = busyTag !== null;
            return (
              <div key={t.id} className="text-xs px-1 py-1 rounded hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-border hover:scale-110 transition"
                    style={{ backgroundColor: t.cor }}
                    onClick={() => setEditandoCor(editandoCor === t.id ? null : t.id)}
                    title="Alterar cor"
                  />
                  <span className="flex-1 truncate" title={t.nome}>
                    {t.nome}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      className={
                        "opacity-70 hover:opacity-100 " +
                        (t.publica === false ? "text-amber-600" : "text-emerald-600")
                      }
                      onClick={() => visibilidade.mutate({ id: t.id, publica: t.publica === false })}
                      disabled={visibilidade.isPending}
                      title={
                        t.publica === false
                          ? "TAG restrita ao administrador — clique para tornar pública"
                          : "TAG pública (todos veem) — clique para restringir ao administrador"
                      }
                    >
                      {t.publica === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                  <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                  disabled={anyBusy}
                  onClick={() => handleApply(t.id)}
                  title="Aplicar esta TAG"
                >
                  {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] border-rose-400 text-rose-700 hover:bg-rose-50"
                  disabled={anyBusy}
                  onClick={() => handleRemove(t.id)}
                  title="Remover esta TAG"
                >
                  {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </Button>
                </div>
                {editandoCor === t.id && (
                  <div className="pl-5 py-1">
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
              placeholder="Nova TAG (aplica em seguida)..."
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
              title="Criar e aplicar"
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