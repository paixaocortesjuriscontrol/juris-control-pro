import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GRUPOS_GOL, GrupoGolKey, sugerirGrupoGol, agruparDuplicadasDistribuicao } from "@/lib/gruposGol";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { vincularItemPublicacao } from "@/lib/vincularItemPublicacao";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";
import { PublicacaoConteudoDjen } from "@/components/djen/PublicacaoConteudoDjen";
import { formatDateOnly } from "@/utils/formatConteudo";

interface Linha {
  pub: any;
  copias: any[];
  marcado: boolean;
  grupo: GrupoGolKey;
  titulo: string;
  data: string;
  jaTemItem: boolean;
  detalhes: boolean;
}

function hojeBrt() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export function DistribuirGruposGolSheet({ publicacoes, individual = false, open: controlledOpen, onOpenChange, hideTrigger = false }: { publicacoes: any[]; individual?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { data: coordenacoes = [], isLoading: carregandoCoordenacoes, error: erroCoordenacoes } = useQuery({
    queryKey: ["coordenacoes-distribuicao-gol"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("coordenacoes").select("id, nome").in("id", GRUPOS_GOL.map((g) => g.coordenacaoId));
      if (error) throw error;
      return data || [];
    },
  });
  const destinos = GRUPOS_GOL.flatMap((g) => {
    const coord = coordenacoes.find((c) => c.id === g.coordenacaoId);
    return coord ? [{ ...g, nome: coord.nome }] : [];
  });
  const totalMarcadas = linhas.filter((l) => l.marcado && !l.jaTemItem).length;
  const publicacoesKey = JSON.stringify(publicacoes);

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
      const grupos = agruparDuplicadasDistribuicao(pubs);
      setLinhas(
        grupos.map((copias) => { const p = copias[0]; const tem = copias.some((c) => com.has(c.id)); return {
          pub: p,
          copias,
          jaTemItem: tem,
          detalhes: grupos.length === 1,
          marcado: !tem,
          grupo: sugerirGrupoGol(p),
          titulo: `Analisar publicação${p.processo_numero ? ` - ${aplicarMascaraCnj(p.processo_numero)}` : ""}`,
          data: hojeBrt(),
        }; }),
      );
      setCarregando(false);
    })();
  }, [open, publicacoesKey]);

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
        const g = destinos.find((x) => x.key === l.grupo);
        if (!g) continue;
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
        for (const c of l.copias) {
          await vincularItemPublicacao({ id: t.id, tipo: "tarefa" }, { tipo: c.tipo_origem, id: c.id });
          await supabase
            .from(c.tipo_origem === "termo" ? "publicacoes_djen" : "publicacoes_djen_processos")
            .update({ lida: true } as any)
            .eq("id", c.id);
        }
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
      {!hideTrigger && <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); publicacoes.length ? setOpen(true) : toast.error("Marque as publicações para distribuir."); }}>
        <Share2 className="w-4 h-4 mr-2" />
        {individual ? "Distribuir publicação" : "Distribuir para coordenações"}
      </Button>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-5xl flex flex-col gap-0" onClick={(e) => e.stopPropagation()}>
          <SheetHeader>
            <SheetTitle>{individual ? "Distribuir publicação GOL" : "Distribuição de publicações GOL em lote"}</SheetTitle>
            <SheetDescription>{linhas.length} publicação(ões){linhas.some((l) => l.copias.length > 1) ? ` (${linhas.reduce((a, l) => a + l.copias.length - 1, 0)} cópia(s) duplicada(s) agrupada(s))` : ""} · {totalMarcadas} para distribuir · {linhas.filter((l) => l.jaTemItem).length} com item existente</SheetDescription>
          </SheetHeader>
          <div className="border-b py-3 flex flex-wrap gap-2">
            {destinos.map((g) => <span key={g.key} className="text-xs text-muted-foreground">{g.nome}: <strong className="text-foreground">{linhas.filter((l) => l.marcado && !l.jaTemItem && l.grupo === g.key).length}</strong></span>)}
            {erroCoordenacoes && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as coordenações. Feche e tente novamente.</p>}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3">

            {carregando || carregandoCoordenacoes ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma publicação de Termos ou Processos marcada.</p>
            ) : (
              linhas.map((l, i) => (
                <div key={l.pub.id} className="border rounded-md p-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox aria-label={`Selecionar publicação ${l.pub.processo_numero || i + 1}`} checked={l.marcado} disabled={l.jaTemItem} onCheckedChange={(v) => upd(i, { marcado: !!v })} />
                    <span className="font-medium">{l.pub.processo_numero ? aplicarMascaraCnj(l.pub.processo_numero) : "Sem processo"}</span>
                    {l.copias.length > 1 && <span className="text-xs font-medium text-primary">{l.copias.length} cópias · 1 tarefa</span>}
                    {l.jaTemItem && <span className="text-xs text-muted-foreground">já tem item criado</span>}
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><dt className="text-muted-foreground">Tribunal / órgão</dt><dd className="break-words">{[l.pub.tribunal, l.pub.orgao].filter(Boolean).join(" · ") || "Não informado"}</dd></div>
                    <div><dt className="text-muted-foreground">Publicação / disponibilização</dt><dd>{formatDateOnly(l.pub.data_publicacao)} · {formatDateOnly(l.pub.data_disponibilizacao)}</dd></div>
                    <div><dt className="text-muted-foreground">Polo ativo</dt><dd className="break-words">{l.pub.polo_ativo || "Não informado"}</dd></div>
                    <div><dt className="text-muted-foreground">Polo passivo</dt><dd className="break-words">{l.pub.polo_passivo || "Não informado"}</dd></div>
                    <div><dt className="text-muted-foreground">Vínculo com processo</dt><dd>{l.pub.processo_id ? "Processo cadastrado vinculado" : "Sem ficha vinculada"}</dd></div>
                    <div><dt className="text-muted-foreground">Situação</dt><dd>{l.jaTemItem ? "Não será distribuída: já possui item" : l.pub.lida ? "Publicação lida" : "Publicação não lida"}</dd></div>
                  </dl>
                  <Button variant="ghost" size="sm" onClick={() => upd(i, { detalhes: !l.detalhes })} aria-expanded={l.detalhes}>
                    {l.detalhes ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                    {l.detalhes ? "Recolher publicação" : "Ler publicação completa"}
                  </Button>
                  {l.detalhes && <PublicacaoConteudoDjen
                    processoNumero={l.pub.processo_numero} tribunal={l.pub.tribunal} fonte={l.pub.fonte}
                    dataDisponibilizacao={l.pub.data_disponibilizacao} dataPublicacao={l.pub.data_publicacao}
                    conteudo={l.pub.conteudo} poloAtivo={l.pub.polo_ativo} poloPassivo={l.pub.polo_passivo}
                    monitoramentoOab={null} monitoramentoUf={null} monitoramentoTermo={null} monitoramentoDescricao={null}
                    orgaoEstruturado={l.pub.orgao} tipoComunicacaoEstruturado={l.pub.tipo_comunicacao}
                    partesJson={l.pub.partes_json} advogadosJson={l.pub.advogados_json} expandirGeralExterno
                  />}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Coordenação de destino</label>
                    <Select value={l.grupo} onValueChange={(v) => upd(i, { grupo: v as GrupoGolKey })} disabled={l.jaTemItem}>
                      <SelectTrigger aria-label="Coordenação de destino" className="min-h-9 h-auto w-full text-left [&>span]:line-clamp-none [&>span]:whitespace-normal"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {destinos.map((g) => <SelectItem key={g.key} value={g.key} className="whitespace-normal">{g.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Título da tarefa</label>
                      <Input className="h-9" value={l.titulo} onChange={(e) => upd(i, { titulo: e.target.value })} disabled={l.jaTemItem} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Vencimento da tarefa</label>
                      <Input className="h-9" type="date" value={l.data} onChange={(e) => upd(i, { data: e.target.value })} disabled={l.jaTemItem} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={confirmar} disabled={salvando || carregando || carregandoCoordenacoes || !!erroCoordenacoes || !totalMarcadas || linhas.some((l) => l.marcado && !l.jaTemItem && !destinos.some((g) => g.key === l.grupo))}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar distribuição ({totalMarcadas})
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
