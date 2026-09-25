import { useMemo, useState } from "react";
import { addDays, format, isWeekend, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
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
  const queryClient = useQueryClient();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();
  const { options: situacaoOptions } = useSituacoesPainel();

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
    setBuscou(false);
    setConfirmando(false);
  };

  const coordPermitidas = useMemo(() => coordenacoes.map((c) => c.id), [coordenacoes]);
  const { data: itensBrutos = [], isFetching, refetch } = usePessoasEmLoteItens(filtros, coordPermitidas, isAdmin, open && buscou);
  const itens = useMemo(() => itensBrutos.filter((i) => i.tipo === tipoAtivo), [itensBrutos, tipoAtivo]);

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
        const tabela = item.fonte === "tarefa" ? "tarefas" : "eventos_agenda";
        const patch: any = { ...novas };
        if (item.fonte === "tarefa" && novosResp.length &&
          (modoResp === "substituir" || (modoResp === "acrescentar" && item.responsaveis.length === 0))) {
          patch.responsavel_id = novosResp[0];
        }
        if (Object.keys(patch).length) {
          patch.updated_at = agora;
          const { error } = await (supabase as any).from(tabela).update(patch).eq("id", item.id);
          if (error) throw error;
        }
        if (modoResp !== "manter" && novosResp.length) {
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
      <SheetContent side="right" className="w-full sm:max-w-[1150px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Remanejamento de tarefas</SheetTitle>
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
                  <CommandList>
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
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 w-8"><Checkbox checked={todosMarcados} onCheckedChange={(c) => setSel(c ? new Set(itens.map((i) => i.key)) : new Set())} /></th>
                  <th className="px-2 py-2">Título</th>
                  <th className="px-2 py-2">Processo</th>
                  <th className="px-2 py-2">Responsáveis</th>
                  {campos.map((c) => <th key={c.campo} className="px-2 py-2 whitespace-nowrap">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const marcado = sel.has(i.key);
                  const calc = marcado ? calculos.get(i.key) : undefined;
                  return (
                    <tr key={i.key} className={`border-b hover:bg-muted/40 cursor-pointer ${marcado ? "bg-primary/5" : ""}`} onClick={() => toggle(i.key)}>
                      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}><Checkbox checked={marcado} onCheckedChange={() => toggle(i.key)} /></td>
                      <td className="px-2 py-1.5 max-w-[260px]">
                        <div className="truncate" title={i.titulo}>{i.titulo}</div>
                        {calc?.erro && <div className="text-[11px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{calc.erro}</div>}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{i.processo_numero ?? "—"}</td>
                      <td className="px-2 py-1.5 text-xs max-w-[180px] truncate">{i.responsaveis.map((id) => nomes[id] ?? "…").join(", ") || "—"}</td>
                      {campos.map(({ campo }) => {
                        const nova = calc?.novas[campo];
                        return (
                          <td key={campo} className="px-2 py-1.5 text-xs whitespace-nowrap">
                            <span className={nova ? "line-through text-muted-foreground" : ""}>{fmtData(i.datas?.[campo], ehEvento)}</span>
                            {nova && <span className="ml-1 font-semibold text-primary">{fmtData(nova, ehEvento)}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
