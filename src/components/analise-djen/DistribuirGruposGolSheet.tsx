import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GRUPOS_GOL, GrupoGolKey, sugerirGrupoGol } from "@/lib/gruposGol";
import { vincularItemPublicacao } from "@/lib/vincularItemPublicacao";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";

interface Linha {
  pub: any;
  marcado: boolean;
  grupo: GrupoGolKey;
  titulo: string;
  data: string;
  jaTemItem: boolean;
}

function hojeBrt() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export function DistribuirGruposGolSheet({ publicacoes }: { publicacoes: any[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const pubs = publicacoes.filter((p) => p.tipo_origem === "termo" || p.tipo_origem === "processo");
    setCarregando(true);
    (async () => {
      const termoIds = pubs.filter((p) => p.tipo_origem === "termo").map((p) => p.id);
      const procIds = pubs.filter((p) => p.tipo_origem === "processo").map((p) => p.id);
      const com = new Set<string>();
      if (termoIds.length) {
        const { data } = await supabase.from("tarefas_publicacoes").select("publicacao_id").in("publicacao_id", termoIds);
        (data || []).forEach((r: any) => com.add(r.publicacao_id));
      }
      if (procIds.length) {
        const { data } = await supabase.from("tarefas_publicacoes_processos").select("publicacao_processo_id").in("publicacao_processo_id", procIds);
        (data || []).forEach((r: any) => com.add(r.publicacao_processo_id));
      }
      setLinhas(
        pubs.map((p) => ({
          pub: p,
          jaTemItem: com.has(p.id),
          marcado: !com.has(p.id),
          grupo: sugerirGrupoGol(p),
          titulo: `Analisar publicação${p.processo_numero ? ` - ${p.processo_numero}` : ""}`,
          data: hojeBrt(),
        })),
      );
      setCarregando(false);
    })();
  }, [open, publicacoes]);

  const upd = (i: number, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const confirmar = async () => {
    const sel = linhas.filter((l) => l.marcado && !l.jaTemItem);
    if (!sel.length) return toast.error("Nenhuma publicação marcada.");
    setSalvando(true);
    try {
      const ids = GRUPOS_GOL.map((g) => g.coordenacaoId);
      const [{ data: coords }, { data: fixos }] = await Promise.all([
        supabase.from("coordenacoes").select("id, coordenador_id").in("id", ids),
        supabase.from("responsaveis_fixos_tipo_tarefa" as any).select("*").in("coordenacao_id", ids),
      ]);
      const respDo = (coordId: string): string | null => {
        const f = ((fixos as any[]) || []).find((x) => x.coordenacao_id === coordId && (x.usuario_id || x.responsavel_id));
        return f?.usuario_id || f?.responsavel_id || (coords || []).find((c: any) => c.id === coordId)?.coordenador_id || null;
      };
      let ok = 0;
      for (const l of sel) {
        const g = GRUPOS_GOL.find((x) => x.key === l.grupo)!;
        const resp = respDo(g.coordenacaoId);
        const { data: t, error } = await supabase
          .from("tarefas")
          .insert({
            titulo: l.titulo,
            descricao: `Distribuída pela Coordenação GOL para o grupo ${g.nome}.`,
            coordenacao_id: g.coordenacaoId,
            processo_id: l.pub.processo_id || null,
            responsavel_id: resp,
            data_vencimento: l.data,
            prioridade: "media",
            status: "pendente",
            criado_por: user?.id || null,
          } as any)
          .select("id")
          .single();
        if (error) { console.error(error); continue; }
        if (resp) await supabase.from("tarefa_responsaveis").insert({ tarefa_id: t.id, usuario_id: resp });
        await vincularItemPublicacao({ id: t.id, tipo: "tarefa" }, { tipo: l.pub.tipo_origem, id: l.pub.id });
        await supabase
          .from(l.pub.tipo_origem === "termo" ? "publicacoes_djen" : "publicacoes_djen_processos")
          .update({ lida: true } as any)
          .eq("id", l.pub.id);
        ok++;
      }
      await invalidarItensAgenda(qc);
      await qc.invalidateQueries();
      toast.success(`${ok} tarefa(s) distribuída(s) para os grupos.`);
      if (ok < sel.length) toast.error(`${sel.length - ok} não puderam ser criadas.`);
      setOpen(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => publicacoes.length ? setOpen(true) : toast.error("Marque as publicações para distribuir.")}>
        <Share2 className="w-4 h-4 mr-2" />
        Distribuir para os grupos
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col">
          <SheetHeader>
            <SheetTitle>Distribuir para os grupos GOL</SheetTitle>
            <SheetDescription>Confira o grupo sugerido de cada publicação. Nada é criado antes de confirmar.</SheetDescription>
            <p className="text-xs text-muted-foreground bg-muted rounded-md p-2">
              Ao confirmar, é criada uma <strong>Tarefa</strong> na coordenação do grupo escolhido (aparece no Painel de Controle, Kanban e Equipe desse grupo e na ficha do processo), atribuída ao responsável fixo do grupo ou ao coordenador. A publicação fica marcada como lida na Coordenação GOL.
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-3">
            {carregando ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma publicação de Termos ou Processos marcada.</p>
            ) : (
              linhas.map((l, i) => (
                <div key={l.pub.id} className="border rounded-md p-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox checked={l.marcado} disabled={l.jaTemItem} onCheckedChange={(v) => upd(i, { marcado: !!v })} />
                    <span className="font-medium">{l.pub.processo_numero || "Sem processo"}</span>
                    {l.jaTemItem && <span className="text-xs text-muted-foreground">já tem item criado</span>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Grupo de destino</label>
                    <Select value={l.grupo} onValueChange={(v) => upd(i, { grupo: v as GrupoGolKey })} disabled={l.jaTemItem}>
                      <SelectTrigger className="h-9 w-full text-left [&>span]:line-clamp-none [&>span]:whitespace-normal"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GRUPOS_GOL.map((g) => <SelectItem key={g.key} value={g.key} className="whitespace-normal">{g.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Título da tarefa</label>
                      <Input className="h-9" value={l.titulo} onChange={(e) => upd(i, { titulo: e.target.value })} disabled={l.jaTemItem} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Data</label>
                      <Input className="h-9" type="date" value={l.data} onChange={(e) => upd(i, { data: e.target.value })} disabled={l.jaTemItem} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={confirmar} disabled={salvando || carregando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar distribuição
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
