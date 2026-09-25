import { useMemo, useState } from "react";
import { addDays, format, isWeekend, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { useSituacoesPainel } from "@/hooks/useSituacoesPainel";
import { usePessoasEmLoteItens, labelTipoLote, type LoteItem, type LoteTipo, type PessoasEmLoteFiltros } from "@/hooks/usePessoasEmLote";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ArrowRightLeft, AlertTriangle, CalendarClock, Loader2, Search, UserCog, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_REMANEJAVEIS: { value: LoteTipo; label: string }[] = [
  { value: "tarefa", label: "Tarefas" },
  { value: "prazo", label: "Prazos" },
  { value: "evento", label: "Eventos" },
];

type ModoData = "manter" | "fixa" | "deslocar";
type ModoResp = "manter" | "substituir" | "acrescentar";
interface Regra { modo: ModoData; data: string; dias: number; diaUtil: boolean }
const REGRA_PADRAO: Regra = { modo: "manter", data: "", dias: 1, diaUtil: true };
const TZ = "America/Sao_Paulo";

const CAMPOS: Record<string, { campo: string; label: string }[]> = {
  tarefa: [
    { campo: "data_base", label: "Data base" },
    { campo: "data_vencimento", label: "Data prevista" },
    { campo: "data_fatal", label: "Data fatal" },
  ],
  prazo: [
    { campo: "data_base", label: "Data base" },
    { campo: "data_vencimento", label: "Data limite" },
    { campo: "data_fatal", label: "Data fatal" },
  ],
  evento: [
    { campo: "data_inicio", label: "Início" },
    { campo: "data_fim", label: "Fim" },
  ],
};

const proximoDiaUtil = (d: Date) => {
  let r = d;
  while (isWeekend(r)) r = addDays(r, 1);
  return r;
};

const diaBRT = (v: string) => (v.length > 10 ? formatInTimeZone(new Date(v), TZ, "yyyy-MM-dd") : v.slice(0, 10));
const horaBRT = (v: string) => (v.length > 10 ? formatInTimeZone(new Date(v), TZ, "HH:mm:ss") : "12:00:00");

const fmtData = (v: string | null | undefined, comHora = false) => {
  if (!v) return "—";
  try {
    if (v.length > 10) return formatInTimeZone(new Date(v), TZ, comHora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy");
    return format(parseISO(v), "dd/MM/yyyy");
  } catch { return v; }
};

/** Aplica a regra a um valor (data "yyyy-MM-dd" ou timestamp). Retorna null quando não muda. */
function aplicarRegra(atual: string | null | undefined, r: Regra, timestamp: boolean): string | null {
  if (r.modo === "manter") return null;
  let dia: string;
  if (r.modo === "fixa") {
    if (!r.data) return null;
    dia = r.data;
  } else {
    if (!atual) return null;
    let d = addDays(parseISO(diaBRT(atual)), r.dias);
    if (r.diaUtil) d = proximoDiaUtil(d);
    dia = format(d, "yyyy-MM-dd");
  }
  if (!timestamp) return dia;
  const hora = atual ? horaBRT(atual) : "12:00:00";
  return fromZonedTime(`${dia}T${hora}`, TZ).toISOString();
}

function descreverRegra(label: string, r: Regra) {
  if (r.modo === "manter") return `${label} mantida`;
  if (r.modo === "fixa") return `${label} → ${r.data ? fmtData(r.data) : "?"}`;
  return `${label} ${r.dias >= 0 ? "+" : ""}${r.dias} dia(s)${r.diaUtil ? " (dia útil)" : ""}`;
}

export function RemanejamentoTarefasSheet({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();
  const { options: situacaoOptions } = useSituacoesPainel();

  const [filtros, setFiltros] = useState<PessoasEmLoteFiltros>({
    inicio: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    fim: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    tipos: ["tarefa", "prazo", "evento"],
    coordenacaoIds: [],
    responsavelIds: [],
    situacoes: [],
    busca: "",
  });
  const [buscou, setBuscou] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const [modoData, setModoData] = useState<ModoData>("manter");
  const [novaData, setNovaData] = useState("");
  const [dias, setDias] = useState(1);
  const [soDiaUtil, setSoDiaUtil] = useState(true);
  const [moverFatal, setMoverFatal] = useState(false);
  const [modoResp, setModoResp] = useState<ModoResp>("manter");
  const [novosResp, setNovosResp] = useState<string[]>([]);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const coordPermitidas = useMemo(() => coordenacoes.map((c) => c.id), [coordenacoes]);
  const { data: itensBrutos = [], isFetching, refetch } = usePessoasEmLoteItens(filtros, coordPermitidas, isAdmin, open && buscou);
  const itens = useMemo(() => itensBrutos.filter((i) => i.fonte !== "audiencia"), [itensBrutos]);

  const idsPessoas = useMemo(() => Array.from(new Set(itens.flatMap((i) => i.responsaveis))), [itens]);
  const { data: nomes = {} } = useQuery({
    queryKey: ["remanejamento-nomes", JSON.stringify(idsPessoas)],
    enabled: idsPessoas.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles_basic").select("id, nome").in("id", idsPessoas.slice(0, 500));
      const m: Record<string, string> = {};
      (data || []).forEach((p: any) => { m[p.id] = p.nome; });
      return m;
    },
  });

  const selecionados = itens.filter((i) => sel.has(i.key));
  const todosMarcados = itens.length > 0 && selecionados.length === itens.length;

  const calcularData = (atual: string | null): string | null => {
    if (modoData === "manter") return null;
    if (modoData === "fixa") return novaData || null;
    if (!atual) return null;
    let d = addDays(parseISO(atual.slice(0, 10)), dias);
    if (soDiaUtil) d = proximoDiaUtil(d);
    return format(d, "yyyy-MM-dd");
  };

  const temAlteracao = (modoData === "fixa" && !!novaData) || modoData === "deslocar" ||
    (modoResp !== "manter" && novosResp.length > 0);

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const aplicar = async () => {
    if (!selecionados.length || !temAlteracao) return;
    setAplicando(true); setProgresso(0);
    const erros: string[] = [];
    let ok = 0;
    for (let i = 0; i < selecionados.length; i++) {
      const item = selecionados[i];
      try {
        const nova = calcularData(item.data);
        const agora = new Date().toISOString();
        if (item.fonte === "tarefa") {
          const patch: any = {};
          if (nova) {
            patch.data_vencimento = nova;
            if (item.tipo === "prazo" && moverFatal) patch.data_fatal = nova;
          }
          if (modoResp === "substituir" && novosResp.length) patch.responsavel_id = novosResp[0];
          if (modoResp === "acrescentar" && novosResp.length && item.responsaveis.length === 0) patch.responsavel_id = novosResp[0];
          if (Object.keys(patch).length) {
            patch.updated_at = agora;
            const { error } = await supabase.from("tarefas").update(patch).eq("id", item.id);
            if (error) throw error;
          }
          if (modoResp === "substituir" && novosResp.length) {
            const { error: e1 } = await (supabase as any).from("tarefa_responsaveis").delete().eq("tarefa_id", item.id);
            if (e1) throw e1;
          }
          if (modoResp !== "manter" && novosResp.length) {
            const { error } = await (supabase as any).from("tarefa_responsaveis").upsert(
              novosResp.map((u) => ({ tarefa_id: item.id, usuario_id: u })),
              { onConflict: "tarefa_id,usuario_id", ignoreDuplicates: true });
            if (error) throw error;
          }
        } else {
          if (nova) {
            const hora = item.data && item.data.length > 10 ? item.data.slice(10) : "T12:00:00";
            const { error } = await (supabase as any).from("eventos_agenda")
              .update({ data_inicio: `${nova}${hora}`, updated_at: agora }).eq("id", item.id);
            if (error) throw error;
          }
          if (modoResp === "substituir" && novosResp.length) {
            const { error: e1 } = await (supabase as any).from("evento_responsaveis").delete().eq("evento_id", item.id);
            if (e1) throw e1;
          }
          if (modoResp !== "manter" && novosResp.length) {
            const { error } = await (supabase as any).from("evento_responsaveis").upsert(
              novosResp.map((u) => ({ evento_id: item.id, usuario_id: u })),
              { onConflict: "evento_id,usuario_id", ignoreDuplicates: true });
            if (error) throw error;
          }
        }
        ok++;
      } catch (e: any) {
        erros.push(`${item.titulo}: ${e?.message ?? "erro"}`);
      }
      setProgresso(Math.round(((i + 1) / selecionados.length) * 100));
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agenda-infinite"] }),
      queryClient.invalidateQueries(),
    ]);
    await refetch();
    setSel(new Set());
    setAplicando(false);
    toast({
      title: erros.length ? "Remanejamento concluído com pendências" : "Remanejamento concluído",
      description: `${ok} item(ns) alterado(s)${erros.length ? `; ${erros.length} com erro: ${erros.slice(0, 2).join(" | ")}` : ""}.`,
      variant: erros.length ? "destructive" : "default",
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!aplicando) onOpenChange(o); }}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Remanejamento de tarefas</SheetTitle>
          <SheetDescription>Filtre, selecione os itens e altere as datas e os responsáveis de uma vez.</SheetDescription>
        </SheetHeader>

        {/* Filtros */}
        <div className="px-6 py-3 border-b bg-muted/30 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div><Label className="text-xs">De</Label><Input type="date" className="h-8" value={filtros.inicio} onChange={(e) => setFiltros((f) => ({ ...f, inicio: e.target.value }))} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" className="h-8" value={filtros.fim} onChange={(e) => setFiltros((f) => ({ ...f, fim: e.target.value }))} /></div>
          <div>
            <Label className="text-xs">Coordenação</Label>
            <Select value={filtros.coordenacaoIds[0] ?? "todas"} onValueChange={(v) => setFiltros((f) => ({ ...f, coordenacaoIds: v === "todas" ? [] : [v] }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as minhas</SelectItem>
                {coordenacoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Responsável atual</Label>
            <ResponsaveisSelector selectedIds={filtros.responsavelIds} onChange={(ids) => setFiltros((f) => ({ ...f, responsavelIds: ids }))} placeholder="Qualquer pessoa" coordenacaoId={filtros.coordenacaoIds[0] ?? null} />
          </div>
          <div>
            <Label className="text-xs">Busca</Label>
            <Input className="h-8" placeholder="Título ou processo" value={filtros.busca} onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))} />
          </div>
          <div className="col-span-2 md:col-span-5 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground mr-1">Tipos:</span>
            {TIPOS_REMANEJAVEIS.map((t) => (
              <Badge key={t.value} className="cursor-pointer" variant={filtros.tipos.includes(t.value) ? "default" : "outline"}
                onClick={() => setFiltros((f) => ({ ...f, tipos: f.tipos.includes(t.value) ? f.tipos.filter((x) => x !== t.value) : [...f.tipos, t.value] }))}>{t.label}</Badge>
            ))}
            <span className="text-xs text-muted-foreground ml-3 mr-1">Situação:</span>
            {situacaoOptions.map((s) => (
              <Badge key={s.value} className="cursor-pointer" variant={filtros.situacoes.includes(s.value) ? "default" : "outline"}
                onClick={() => setFiltros((f) => ({ ...f, situacoes: f.situacoes.includes(s.value) ? f.situacoes.filter((x) => x !== s.value) : [...f.situacoes, s.value] }))}>{s.label}</Badge>
            ))}
          </div>
          <Button size="sm" className="h-8 gap-1" onClick={() => { setBuscou(true); setSel(new Set()); void refetch(); }} disabled={filtros.tipos.length === 0}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </Button>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 overflow-auto">
          {!buscou ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Defina os filtros e clique em Buscar.</div>
          ) : isFetching && !itens.length ? (
            <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !itens.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum item encontrado com esses filtros.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 w-8"><Checkbox checked={todosMarcados} onCheckedChange={(c) => setSel(c ? new Set(itens.map((i) => i.key)) : new Set())} /></th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Título</th>
                  <th className="px-2 py-2">Processo</th>
                  <th className="px-2 py-2">Responsáveis</th>
                  <th className="px-2 py-2">Data atual</th>
                  <th className="px-2 py-2">Nova data</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i: LoteItem) => {
                  const marcado = sel.has(i.key);
                  const nova = marcado ? calcularData(i.data) : null;
                  return (
                    <tr key={i.key} className={`border-b hover:bg-muted/40 cursor-pointer ${marcado ? "bg-primary/5" : ""}`} onClick={() => toggle(i.key)}>
                      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}><Checkbox checked={marcado} onCheckedChange={() => toggle(i.key)} /></td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{labelTipoLote(i.tipo)}</Badge></td>
                      <td className="px-2 py-1.5 max-w-[280px] truncate" title={i.titulo}>{i.titulo}</td>
                      <td className="px-2 py-1.5 font-mono text-xs">{i.processo_numero ?? "—"}</td>
                      <td className="px-2 py-1.5 text-xs max-w-[200px] truncate">{i.responsaveis.map((id) => nomes[id] ?? "…").join(", ") || "—"}</td>
                      <td className="px-2 py-1.5 text-xs">{fmtData(i.data)}</td>
                      <td className="px-2 py-1.5 text-xs font-medium text-primary">{nova ? fmtData(nova) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Ações */}
        <div className="border-t bg-card px-6 py-4 grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-semibold"><CalendarClock className="h-4 w-4" /> Datas</Label>
            <RadioGroup value={modoData} onValueChange={(v) => setModoData(v as ModoData)} className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="manter" /> Manter</label>
              <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="fixa" /> Nova data</label>
              <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="deslocar" /> Adiar/antecipar</label>
            </RadioGroup>
            {modoData === "fixa" && <Input type="date" className="h-8 w-48" value={novaData} onChange={(e) => setNovaData(e.target.value)} />}
            {modoData === "deslocar" && (
              <div className="flex items-center gap-3 flex-wrap">
                <Input type="number" className="h-8 w-24" value={dias} onChange={(e) => setDias(Number(e.target.value) || 0)} />
                <span className="text-xs text-muted-foreground">dias (negativo antecipa)</span>
                <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={soDiaUtil} onCheckedChange={(c) => setSoDiaUtil(!!c)} /> Cair em dia útil</label>
              </div>
            )}
            {modoData !== "manter" && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox checked={moverFatal} onCheckedChange={(c) => setMoverFatal(!!c)} /> Mover também a data fatal dos prazos
              </label>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-semibold"><UserCog className="h-4 w-4" /> Responsáveis</Label>
            <RadioGroup value={modoResp} onValueChange={(v) => setModoResp(v as ModoResp)} className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="manter" /> Manter</label>
              <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="substituir" /> Trocar por</label>
              <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="acrescentar" /> Acrescentar</label>
            </RadioGroup>
            {modoResp !== "manter" && <PeoplePicker selectedIds={novosResp} onChange={setNovosResp} placeholder="Escolher responsável" icon="users" />}
          </div>
          <div className="md:col-span-2 flex items-center justify-between gap-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {aplicando ? <Progress value={progresso} className="h-2" /> : <><strong className="text-foreground">{selecionados.length}</strong> de {itens.length} selecionado(s)</>}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>Fechar</Button>
            <Button onClick={aplicar} disabled={aplicando || !selecionados.length || !temAlteracao || (modoData === "fixa" && !novaData)} className="gap-1.5">
              {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aplicar a {selecionados.length} item(ns)
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default RemanejamentoTarefasSheet;
