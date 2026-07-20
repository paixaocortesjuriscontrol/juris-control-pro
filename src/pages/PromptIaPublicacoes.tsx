import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, RotateCcw, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePromptsIaPublicacoes,
  useUpsertPromptIaPublicacao,
  useDeletePromptIaPublicacao,
  type PromptIaPublicacao,
} from "@/hooks/usePromptsIaPublicacoes";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import {
  PROMPT_PADRAO_POR_TIPO,
  TIPOS_ITEM_PROMPT_IA,
  TIPO_ITEM_LABEL,
  type TipoItemPromptIa,
} from "@/constants/promptsIaPublicacoes";

export default function PromptIaPublicacoesPage() {
  const { data: prompts = [], isLoading } = usePromptsIaPublicacoes();
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const upsertMut = useUpsertPromptIaPublicacao();
  const deleteMut = useDeletePromptIaPublicacao();

  const coordenacoesDisponiveis = useMemo(
    () => (coordenacoes as any[]).map((c) => ({ id: c.id, nome: c.nome })),
    [coordenacoes],
  );
  const [coordId, setCoordId] = useState<string>("");

  const coordSelecionada = coordId || coordenacoesDisponiveis[0]?.id || "";

  const promptsDaCoord = useMemo(() => {
    const map = new Map<TipoItemPromptIa, PromptIaPublicacao>();
    for (const p of prompts) if (p.coordenacao_id === coordSelecionada) map.set(p.tipo_item, p);
    return map;
  }, [prompts, coordSelecionada]);

  return (
    <MainLayout
      title="Prompt IA (Publicações)"
      subtitle='Personalize por coordenação o prompt usado no botão "Preencher com IA" ao criar prazos, tarefas, eventos e audiências a partir de publicações.'
    >
      <div className="container mx-auto p-4 space-y-4 max-w-5xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span className="font-semibold">Coordenação</span>
          </div>
          <Select value={coordSelecionada} onValueChange={setCoordId}>
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Selecione uma coordenação" />
            </SelectTrigger>
            <SelectContent>
              {coordenacoesDisponiveis.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando…
          </div>
        ) : !coordSelecionada ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Selecione uma coordenação para gerenciar os prompts.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {TIPOS_ITEM_PROMPT_IA.map((tipo) => (
              <PromptCard
                key={tipo}
                tipo={tipo}
                coordenacaoId={coordSelecionada}
                registro={promptsDaCoord.get(tipo) || null}
                onSalvar={async (input) => {
                  await upsertMut.mutateAsync(input);
                  toast.success(`Prompt de ${TIPO_ITEM_LABEL[tipo]} salvo.`);
                }}
                onExcluir={async (id) => {
                  await deleteMut.mutateAsync(id);
                  toast.success(`Prompt de ${TIPO_ITEM_LABEL[tipo]} removido — voltará a usar o padrão.`);
                }}
                saving={upsertMut.isPending}
                deleting={deleteMut.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function PromptCard({
  tipo,
  coordenacaoId,
  registro,
  onSalvar,
  onExcluir,
  saving,
  deleting,
}: {
  tipo: TipoItemPromptIa;
  coordenacaoId: string;
  registro: PromptIaPublicacao | null;
  onSalvar: (input: { coordenacao_id: string; tipo_item: TipoItemPromptIa; prompt: string; ativo: boolean }) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
}) {
  const padrao = PROMPT_PADRAO_POR_TIPO[tipo];
  const [texto, setTexto] = useState<string>(registro?.prompt ?? padrao);
  const [ativo, setAtivo] = useState<boolean>(registro?.ativo ?? true);

  // Se o registro mudar (troca de coordenação), sincroniza os states
  const key = `${coordenacaoId}:${tipo}:${registro?.updated_at ?? "novo"}`;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemoResetOnKey(key, () => {
    setTexto(registro?.prompt ?? padrao);
    setAtivo(registro?.ativo ?? true);
  });

  const isPersonalizado = !!registro;
  const dirty = texto !== (registro?.prompt ?? padrao) || ativo !== (registro?.ativo ?? true);

  const salvar = async () => {
    if (!texto.trim()) {
      toast.error("O prompt não pode ficar vazio.");
      return;
    }
    try {
      await onSalvar({ coordenacao_id: coordenacaoId, tipo_item: tipo, prompt: texto.trim(), ativo });
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    }
  };

  const restaurarPadrao = () => {
    setTexto(padrao);
    toast.info("Prompt padrão carregado no editor. Clique em Salvar para aplicar.");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{TIPO_ITEM_LABEL[tipo]}</span>
            <span
              className={
                "text-xs px-2 py-0.5 rounded " +
                (isPersonalizado
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                  : "bg-muted text-muted-foreground")
              }
            >
              {isPersonalizado ? "Personalizado" : "Padrão do sistema"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <Button size="sm" variant="ghost" onClick={restaurarPadrao} title="Restaurar prompt padrão">
              <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
            </Button>
            {isPersonalizado && (
              <Button
                size="icon"
                variant="ghost"
                className="text-rose-600"
                disabled={deleting}
                onClick={async () => {
                  if (!registro) return;
                  if (!confirm(`Remover personalização de ${TIPO_ITEM_LABEL[tipo]}? Voltará a usar o prompt padrão.`)) return;
                  try {
                    await onExcluir(registro.id);
                  } catch (e: any) {
                    toast.error("Erro: " + (e?.message || "desconhecido"));
                  }
                }}
                title="Remover personalização"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Texto do prompt</Label>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} className="font-mono text-xs" />
        </div>

        <div className="flex justify-end">
          <Button onClick={salvar} disabled={!dirty || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// pequeno helper para resetar states quando a "identidade" do registro mudar
import { useEffect, useRef } from "react";
function useMemoResetOnKey(key: string, fn: () => void) {
  const last = useRef<string>("");
  useEffect(() => {
    if (last.current !== key) {
      last.current = key;
      fn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}