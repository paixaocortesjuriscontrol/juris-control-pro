import { useMemo, useState } from "react";
import { differenceInCalendarDays, addDays, format, isWeekend, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { sincronizarParticipantesTarefa } from "@/lib/sincronizarParticipantesTarefa";
import { listarAtividadesLote, passaFiltroAtividade } from "@/lib/tipoAtividadeLote";
import { ChevronRight, ArrowRightLeft, AlertTriangle, CalendarClock, Loader2, Search, UserCog, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_REMANEJAVEIS: { value: LoteTipo; label: string }[] = [
  { value: "tarefa", label: "Tarefas" },
  { value: "prazo", label: "Prazos" },
  { value: "evento", label: "Eventos" },
  { value: "audiencia", label: "Audiências" },
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
  audiencia: [
    { campo: "data_audiencia", label: "Data da audiência" },
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

const hojeBRT = () => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
const dataFatalDe = (i: LoteItem): string | null => i.datas?.data_fatal ?? (i.fonte === "evento" ? i.datas?.data_inicio ?? null : null);

const fmtData = (v: string | null | undefined, comHora = false) => {
  if (!v) return "—";
  try {
    if (v.length > 10) return formatInTimeZone(new Date(v), TZ, comHora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy");
    return format(parseISO(v), "dd/MM/yyyy");
  } catch { return v; }
};

/** Aplica a regra a um valor (data "yyyy-MM-dd" ou timestamp). Retorna null quando não muda. */
export function aplicarRegra(atual: string | null | undefined, r: Regra, timestamp: boolean): string | null {
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
  const queryClient = useQueryClient();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();

  const [tipoAtivo, setTipoAtivo] = useState<LoteTipo>("tarefa");
  const [filtros, setFiltros] = useState<PessoasEmLoteFiltros>({
    inicio: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    fim: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    tipos: ["tarefa"],
    coordenacaoIds: [],
    responsavelIds: [],
    situacoes: [],
    busca: "",
  });
  const { options: situacaoOptions } = useSituacoesPainel(
    filtros.coordenacaoIds.length === 1 ? filtros.coordenacaoIds[0] : undefined,
  );
  const [buscou, setBuscou] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [regras, setRegras] = useState<Record<string, Regra>>({});
  const [fimJunto, setFimJunto] = useState(true);
  const [modoResp, setModoResp] = useState<ModoResp>("manter");
  const [novosResp, setNovosResp] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const campos = CAMPOS[tipoAtivo] ?? [];
  const ehEvento = tipoAtivo === "evento";
  const regra = (c: string) => regras[c] ?? REGRA_PADRAO;
  const setRegra = (c: string, patch: Partial<Regra>) => setRegras((r) => ({ ...r, [c]: { ...(r[c] ?? REGRA_PADRAO), ...patch } }));

  const trocarTipo = (t: LoteTipo) => {
    setTipoAtivo(t);
    setFiltros((f) => ({ ...f, tipos: [t] }));
    setSel(new Set());
    setRegras({});
    setAtividade("");
    setBuscou(false);
    setConfirmando(false);
  };

  const coordPermitidas = useMemo(() => coordenacoes.map((c) => c.id), [coordenacoes]);
  const { data: itensBrutos = [], isFetching, refetch } = usePessoasEmLoteItens(filtros, coordPermitidas, isAdmin, open && buscou);
  const [ordem, setOrdem] = useState<"fatal" | "prevista" | "processo">("fatal");
  const [fatalAte, setFatalAte] = useState("");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [atividade, setAtividade] = useState("");
  const atividadesDisponiveis = useMemo(() => listarAtividadesLote(itensBrutos.filter((i) => i.tipo === tipoAtivo)), [itensBrutos, tipoAtivo]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const itens = useMemo(() => {
    const txt = buscaTexto.trim().toLowerCase();
    const lista = itensBrutos.filter((i) => {
      if (i.tipo !== tipoAtivo) return false;
      if (!passaFiltroAtividade(i.titulo, atividade)) return false;
      if (fatalAte) {
        const f = dataFatalDe(i);
        if (!f || diaBRT(f) > fatalAte) return false;
      }
      if (txt) {
        const d = i.detalhes || {};
        const alvo = [i.titulo, i.processo_numero, d.descricao, d.observacoes, d.ultimo_andamento, d.partes_ativas, d.partes_passivas, d.local]
          .filter(Boolean).join(" ").toLowerCase();
        if (!alvo.includes(txt)) return false;
      }
      return true;
    });
    const chave = (i: LoteItem) =>
      ordem === "processo" ? i.processo_numero ?? "~"
        : ordem === "fatal" ? (dataFatalDe(i) ? diaBRT(dataFatalDe(i)!) : "9999")
          : (i.data ? diaBRT(i.data) : "9999");
    return [...lista].sort((a, b) => chave(a).localeCompare(chave(b)));
  }, [itensBrutos, tipoAtivo, fatalAte, buscaTexto, ordem, atividade]);
  const nomeCoord = useMemo(() => Object.fromEntries(coordenacoes.map((c) => [c.id, c.nome])), [coordenacoes]);

  const idsPessoas = useMemo(() => Array.from(new Set(itens.flatMap((i) => [...i.responsaveis, ...i.envolvidos]))), [itens]);
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

  /** Calcula as novas datas de um item (somente campos alterados). */
  const calcular = (item: LoteItem): { novas: Record<string, string>; erro: string | null } => {
    const d = item.datas ?? {};
    const novas: Record<string, string> = {};
    if (ehEvento) {
      const ni = aplicarRegra(d.data_inicio, regra("data_inicio"), true);
      if (ni) novas.data_inicio = ni;
      if (fimJunto) {
        if (ni && d.data_fim && d.data_inicio) {
          const delta = new Date(ni).getTime() - new Date(d.data_inicio).getTime();
          novas.data_fim = new Date(new Date(d.data_fim).getTime() + delta).toISOString();
        }
      } else {
        const nf = aplicarRegra(d.data_fim, regra("data_fim"), true);
        if (nf) novas.data_fim = nf;
      }
      const ini = novas.data_inicio ?? d.data_inicio;
      const fim = novas.data_fim ?? d.data_fim;
      const erro = ini && fim && new Date(fim) < new Date(ini) ? "Fim antes do início" : null;
      return { novas, erro };
    }
    if (tipoAtivo === "audiencia") {
      const alvo = item.fonte === "audiencia" ? "data_audiencia" : "data_vencimento";
      const atual = item.fonte === "audiencia" ? d.data_audiencia : d.data_vencimento;
      const n = aplicarRegra(atual, regra("data_audiencia"), item.fonte === "audiencia");
      if (n) novas[alvo] = n;
      return { novas, erro: null };
    }
    campos.forEach(({ campo }) => {
      const n = aplicarRegra(d[campo], regra(campo), false);
      if (n) novas[campo] = n;
    });
    const venc = novas.data_vencimento ?? d.data_vencimento;
    const fatal = novas.data_fatal ?? d.data_fatal;
    const erro = venc && fatal && fatal.slice(0, 10) < venc.slice(0, 10)
      ? `Data fatal antes da ${tipoAtivo === "prazo" ? "data limite" : "data prevista"}` : null;
    return { novas, erro };
  };

  const selecionados = itens.filter((i) => sel.has(i.key));
  const calculos = useMemo(() => new Map(selecionados.map((i) => [i.key, calcular(i)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify({ k: selecionados.map((i) => i.key), regras, fimJunto, tipoAtivo })]);
  const comErro = selecionados.filter((i) => calculos.get(i.key)?.erro);
  /** Itens cuja nova data prevista/limite passa do prazo fatal. */
  const passamDoFatal = selecionados.filter((i) => {
    const c = calculos.get(i.key);
    const venc = c?.novas.data_vencimento ?? i.datas?.data_vencimento;
    const fatal = c?.novas.data_fatal ?? i.datas?.data_fatal;
    return !!(c && (c.novas.data_vencimento || c.novas.data_fatal) && venc && fatal && diaBRT(venc) > diaBRT(fatal));
  });
  const todosMarcados = itens.length > 0 && selecionados.length === itens.length;

  const regrasAtivas = campos.filter(({ campo }) => {
    if (ehEvento && campo === "data_fim" && fimJunto) return false;
    const r = regra(campo);
    return r.modo === "deslocar" || (r.modo === "fixa" && !!r.data);
  });
  const temAlteracao = regrasAtivas.length > 0 || (modoResp !== "manter" && novosResp.length > 0);

  const resumo = () => {
    const nomeTipo = TIPOS_REMANEJAVEIS.find((t) => t.value === tipoAtivo)?.label.toLowerCase();
    const partes = campos
      .filter(({ campo }) => !(ehEvento && campo === "data_fim" && fimJunto))
      .map(({ campo, label }) => descreverRegra(label, regra(campo)));
    if (ehEvento && fimJunto) partes.push("Fim acompanha o início");
    if (modoResp === "substituir" && novosResp.length) partes.push("responsáveis trocados");
    if (modoResp === "acrescentar" && novosResp.length) partes.push("responsáveis acrescentados");
    return `${selecionados.length} ${nomeTipo}: ${partes.join("; ")}`;
  };

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const aplicar = async () => {
    if (!selecionados.length || !temAlteracao || comErro.length) return;
    setAplicando(true); setProgresso(0);
    const erros: string[] = [];
    let ok = 0;
    for (let i = 0; i < selecionados.length; i++) {
      const item = selecionados[i];
      try {
        const { novas } = calcular(item);
        const agora = new Date().toISOString();
        const tabela = item.fonte === "tarefa" ? "tarefas" : item.fonte === "audiencia" ? "audiencias_detectadas" : "eventos_agenda";
        const patch: any = { ...novas };
        if (item.fonte === "tarefa" && novosResp.length &&
          (modoResp === "substituir" || (modoResp === "acrescentar" && item.responsaveis.length === 0))) {
          patch.responsavel_id = novosResp[0];
        }
        if (Object.keys(patch).length) {
          patch.updated_at = agora;
          const { data: gravadas, error } = await (supabase as any).from(tabela).update(patch).eq("id", item.id).select("id");
          if (error) throw error;
          if (!gravadas?.length) throw new Error("sem permissão para alterar este item");
        }
        if (modoResp !== "manter" && novosResp.length && item.fonte === "audiencia") {
          const desejados = modoResp === "substituir" ? novosResp : Array.from(new Set([...item.responsaveis, ...novosResp]));
          await sincronizarParticipantesTarefa(item.id, "audiencias_advogados", desejados);
        } else if (modoResp !== "manter" && novosResp.length) {
          const [tab, col] = item.fonte === "tarefa" ? ["tarefa_responsaveis", "tarefa_id"] : ["evento_responsaveis", "evento_id"];
          if (modoResp === "substituir") {
            const { error } = await (supabase as any).from(tab).delete().eq(col, item.id);
            if (error) throw error;
          }
          const { error } = await (supabase as any).from(tab).upsert(
            novosResp.map((u) => ({ [col]: item.id, usuario_id: u })),
            { onConflict: `${col},usuario_id`, ignoreDuplicates: true });
          if (error) throw error;
        }
        ok++;
      } catch (e: any) {
        erros.push(`${item.titulo}: ${e?.message ?? "erro"}`);
      }
      setProgresso(Math.round(((i + 1) / selecionados.length) * 100));
    }
    await queryClient.invalidateQueries();
    await refetch();
    setSel(new Set());
    setConfirmando(false);
    setAplicando(false);
    toast({
      title: erros.length ? "Remanejamento concluído com pendências" : "Remanejamento concluído",
      description: `${ok} item(ns) alterado(s)${erros.length ? `; ${erros.length} com erro: ${erros.slice(0, 2).join(" | ")}` : ""}.`,
      variant: erros.length ? "destructive" : "default",
    });
  };

  const blocoRegra = ({ campo, label }: { campo: string; label: string }) => {
    const r = regra(campo);
    return (
      <div key={campo} className="rounded-md border p-2.5 space-y-2 bg-background">
        <div className="text-xs font-semibold">{label}</div>
        <RadioGroup value={r.modo} onValueChange={(v) => setRegra(campo, { modo: v as ModoData })} className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1 text-xs"><RadioGroupItem value="manter" /> Manter</label>
          <label className="flex items-center gap-1 text-xs"><RadioGroupItem value="fixa" /> Nova data</label>
          <label className="flex items-center gap-1 text-xs"><RadioGroupItem value="deslocar" /> Adiar/antecipar</label>
        </RadioGroup>
        {r.modo === "fixa" && <Input type="date" className="h-8" value={r.data} onChange={(e) => setRegra(campo, { data: e.target.value })} />}
        {r.modo === "deslocar" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="number" className="h-8 w-20" value={r.dias} onChange={(e) => setRegra(campo, { dias: Number(e.target.value) || 0 })} />
            <span className="text-[11px] text-muted-foreground">dias (negativo antecipa)</span>
            <label className="flex items-center gap-1 text-[11px]"><Checkbox checked={r.diaUtil} onCheckedChange={(c) => setRegra(campo, { diaUtil: !!c })} /> Dia útil</label>
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!aplicando) onOpenChange(o); }}>
      <SheetContent side="right" className="w-full sm:max-w-[1280px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Remanejamento em lote</SheetTitle>
          <SheetDescription>Escolha o tipo, filtre, selecione os itens e defina o que acontece com cada data.</SheetDescription>
        </SheetHeader>

        <div className="px-6 pt-3 flex gap-1.5">
          {TIPOS_REMANEJAVEIS.map((t) => (
            <Button key={t.value} size="sm" variant={tipoAtivo === t.value ? "default" : "outline"} className="h-8" onClick={() => trocarTipo(t.value)} disabled={aplicando}>{t.label}</Button>
          ))}
        </div>

        <div className="px-6 py-3 border-b bg-muted/30 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div><Label className="text-xs">De ({campos.find((c) => c.campo === "data_vencimento" || c.campo === "data_inicio")?.label})</Label><Input type="date" className="h-8" value={filtros.inicio} onChange={(e) => setFiltros((f) => ({ ...f, inicio: e.target.value }))} /></div>
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
          <div className="col-span-2 md:col-span-5">
            <Label className="text-xs">Situação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full justify-between font-normal">
                  <span className="truncate text-left">
                    {filtros.situacoes.length === 0
                      ? "Todas as situações"
                      : `${filtros.situacoes.length} selecionada(s)`}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandList className="max-h-[260px] overscroll-contain">
                    <CommandEmpty>Nenhuma situação</CommandEmpty>
                    <CommandGroup>
                      {situacaoOptions.map((s) => {
                        const checked = filtros.situacoes.includes(s.value);
                        return (
                          <CommandItem
                            key={s.value}
                            onSelect={() =>
                              setFiltros((f) => ({
                                ...f,
                                situacoes: f.situacoes.includes(s.value)
                                  ? f.situacoes.filter((x) => x !== s.value)
                                  : [...f.situacoes, s.value],
                              }))
                            }
                            className="gap-2"
                          >
                            <div className="flex h-4 w-4 items-center justify-center rounded border">
                              {checked && <Check className="h-3 w-3" />}
                            </div>
                            {s.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Button size="sm" className="h-8 gap-1" onClick={() => { setBuscou(true); setSel(new Set()); void refetch(); }}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {!buscou ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Defina os filtros e clique em Buscar.</div>
          ) : isFetching && !itens.length ? (
            <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !itens.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum item encontrado com esses filtros.</div>
          ) : (
            <div>
              <div className="sticky top-0 z-10 bg-card border-b px-4 py-2 flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-2"><Checkbox checked={todosMarcados} onCheckedChange={(c) => setSel(c ? new Set(itens.map((i) => i.key)) : new Set())} /> Selecionar todos ({itens.length})</label>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-muted-foreground">Ordenar por</span>
                  <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
                    <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fatal">{ehEvento ? "Início" : "Prazo fatal"}</SelectItem>
                      <SelectItem value="prevista">{ehEvento ? "Início" : "Data prevista/limite"}</SelectItem>
                      <SelectItem value="processo">Processo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!ehEvento && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Fatal até</span>
                    <Input type="date" className="h-7 w-[140px] text-xs" value={fatalAte} onChange={(e) => setFatalAte(e.target.value)} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tipo de atividade</span>
                  <Select value={atividade || "__todas"} onValueChange={(v) => { setAtividade(v === "__todas" ? "" : v); setSel(new Set()); }}>
                    <SelectTrigger className="h-7 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todas">Todas</SelectItem>
                      {atividadesDisponiveis.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input className="h-7 w-[220px] text-xs" placeholder="Buscar em observações, partes…" value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} />
              </div>
              <ul className="divide-y">
                {itens.map((i) => {
                  const marcado = sel.has(i.key);
                  const calc = marcado ? calculos.get(i.key) : undefined;
                  const aberto = abertos.has(i.key);
                  const d = i.detalhes || {};
                  const fatal = dataFatalDe(i);
                  const dias = fatal ? differenceInCalendarDays(parseISO(diaBRT(fatal)), parseISO(hojeBRT())) : null;
                  const obs = d.observacoes || d.descricao;
                  return (
                    <li key={i.key} className={`px-4 py-2.5 hover:bg-muted/40 cursor-pointer ${marcado ? "bg-primary/5" : ""}`} onClick={() => toggle(i.key)}>
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}><Checkbox checked={marcado} onCheckedChange={() => toggle(i.key)} /></div>
                        <button type="button" aria-label={aberto ? "Ocultar detalhes" : "Ver detalhes"} className="pt-0.5 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); setAbertos((s) => { const n = new Set(s); n.has(i.key) ? n.delete(i.key) : n.add(i.key); return n; }); }}>
                          <ChevronRight className={`h-4 w-4 transition-transform ${aberto ? "rotate-90" : ""}`} />
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] uppercase">{labelTipoLote(i.tipo)}</Badge>
                            <span className="font-medium truncate max-w-[420px]" title={i.titulo}>{i.titulo}</span>
                            {i.status && <Badge variant="secondary" className="text-[10px]">{i.status.replace(/_/g, " ")}</Badge>}
                            {i.coordenacao_id && nomeCoord[i.coordenacao_id] && <span className="text-[11px] text-muted-foreground">{nomeCoord[i.coordenacao_id]}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                            <span className="font-mono">{i.processo_numero ?? "Sem processo"}</span>
                            {(d.partes_ativas || d.partes_passivas) && <span className="truncate max-w-[480px]">{d.partes_ativas || "—"} x {d.partes_passivas || "—"}</span>}
                            {d.local && <span>Local: {d.local}</span>}
                          </div>
                          <div className="text-xs flex flex-wrap gap-x-4">
                            <span><span className="text-muted-foreground">Responsáveis: </span>{i.responsaveis.map((id) => nomes[id] ?? "…").join(", ") || "—"}</span>
                            {i.envolvidos.length > 0 && <span><span className="text-muted-foreground">Envolvidos: </span>{i.envolvidos.map((id) => nomes[id] ?? "…").join(", ")}</span>}
                          </div>
                          {obs && !aberto && <div className="text-xs text-muted-foreground truncate max-w-[720px]" title={obs}>Obs.: {obs}</div>}
                          {calc?.erro && <div className="text-[11px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{calc.erro}</div>}
                          {aberto && (
                            <div className="mt-2 rounded-md border bg-background p-3 text-xs space-y-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                              {d.descricao && <div><div className="font-semibold mb-0.5">Descrição</div><div className="whitespace-pre-wrap">{d.descricao}</div></div>}
                              {d.observacoes && <div><div className="font-semibold mb-0.5">Observações</div><div className="whitespace-pre-wrap">{d.observacoes}</div></div>}
                              {d.ultimo_andamento && <div><div className="font-semibold mb-0.5">Último andamento</div><div className="whitespace-pre-wrap">{d.ultimo_andamento}</div></div>}
                              <div className="flex flex-wrap gap-x-4 text-muted-foreground">
                                {d.prazo_dias != null && <span>Prazo: {d.prazo_dias} {d.prazo_unidade === "corridos" ? "dias corridos" : "dias úteis"}</span>}
                                {i.datas?.data_base && <span>Data base: {fmtData(i.datas.data_base)}</span>}
                                {d.modalidade && <span>Modalidade: {d.modalidade}</span>}
                              </div>
                              {!d.descricao && !d.observacoes && !d.ultimo_andamento && <div className="text-muted-foreground">Sem descrição ou observações.</div>}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right space-y-1 min-w-[190px]">
                          {!ehEvento && (
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">Prazo fatal</div>
                              <div className="font-semibold">
                                {fmtData(fatal)}{d.hora_fatal ? ` ${String(d.hora_fatal).slice(0, 5)}` : ""}
                                {calc?.novas.data_fatal && <span className="ml-1 text-primary">→ {fmtData(calc.novas.data_fatal)}</span>}
                              </div>
                              {dias != null && (
                                <Badge variant={dias < 0 ? "destructive" : dias <= 2 ? "default" : "outline"} className="text-[10px]">
                                  {dias < 0 ? `vencido há ${-dias} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`}
                                </Badge>
                              )}
                            </div>
                          )}
                          {campos.filter(({ campo }) => campo !== "data_fatal").map(({ campo, label }) => {
                            const nova = calc?.novas[campo];
                            return (
                              <div key={campo} className="text-[11px]">
                                <span className="text-muted-foreground">{label}: </span>
                                <span className={nova ? "line-through text-muted-foreground" : ""}>{fmtData(i.datas?.[campo], ehEvento)}</span>
                                {nova && <span className="ml-1 font-semibold text-primary">{fmtData(nova, ehEvento)}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t bg-muted/20 px-6 py-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            {campos.filter(({ campo }) => !(ehEvento && campo === "data_fim" && fimJunto)).map((c) => blocoRegra(c))}
            {ehEvento && (
              <label className="flex items-center gap-2 text-xs rounded-md border p-2.5 bg-background">
                <Checkbox checked={fimJunto} onCheckedChange={(c) => setFimJunto(!!c)} /> Mover o fim junto com o início (mantém a duração)
              </label>
            )}
            <div className="rounded-md border p-2.5 space-y-2 bg-background">
              <div className="text-xs font-semibold flex items-center gap-1"><UserCog className="h-3.5 w-3.5" /> Responsáveis</div>
              <RadioGroup value={modoResp} onValueChange={(v) => setModoResp(v as ModoResp)} className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1 text-xs"><RadioGroupItem value="manter" /> Manter</label>
                <label className="flex items-center gap-1 text-xs"><RadioGroupItem value="substituir" /> Trocar por</label>
                <label className="flex items-center gap-1 text-xs"><RadioGroupItem value="acrescentar" /> Acrescentar</label>
              </RadioGroup>
              {modoResp !== "manter" && <PeoplePicker selectedIds={novosResp} onChange={setNovosResp} placeholder="Escolher responsável" icon="users" />}
            </div>
          </div>

          {confirmando && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1">{resumo()}</span>
            </div>
          )}
          {passamDoFatal.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs space-y-1">
              <div className="font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {passamDoFatal.length} item(ns) ficariam com a data depois do prazo fatal</div>
              <ul className="list-disc pl-5 max-h-24 overflow-auto">
                {passamDoFatal.slice(0, 20).map((i) => <li key={i.key}>{i.titulo} — {i.processo_numero ?? "sem processo"} (fatal {fmtData(i.datas?.data_fatal)})</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {aplicando ? <Progress value={progresso} className="h-2" /> : (
                <>
                  <strong className="text-foreground">{selecionados.length}</strong> de {itens.length} selecionado(s)
                  {comErro.length > 0 && <span className="ml-3 text-destructive">{comErro.length} com data inválida — corrija as regras</span>}
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => (confirmando ? setConfirmando(false) : onOpenChange(false))} disabled={aplicando}>{confirmando ? "Voltar" : "Fechar"}</Button>
            {!confirmando ? (
              <Button onClick={() => setConfirmando(true)} disabled={!selecionados.length || !temAlteracao || comErro.length > 0}>Revisar alteração</Button>
            ) : (
              <Button onClick={aplicar} disabled={aplicando || comErro.length > 0} className="gap-1.5">
                {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar em {selecionados.length} item(ns)
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default RemanejamentoTarefasSheet;
