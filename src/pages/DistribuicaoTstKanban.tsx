import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, Loader2, PlayCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import { loadResponsaveisMap, ProfileBasic } from "@/hooks/useDistribuicaoResponsaveis";

interface Card {
  id: string;
  processo: string | null;
  dossie: string | null;
  prazo_entrega: string | null;
  status_distribuicao: string | null;
  distribuido_em: string | null;
  observacao_distribuicao: string | null;
  aba_origem: string | null;
  responsaveis: ProfileBasic[];
}

function getDias(prazo: string | null): number | null {
  if (!prazo) return null;
  return differenceInCalendarDays(new Date(prazo + "T12:00:00"), new Date());
}

type ColKey = "sem-prazo" | "5+" | "4" | "3" | "2" | "fatal" | "entregue";

const columns: { key: ColKey; label: string; color: string; bg: string; match: (c: Card) => boolean }[] = [
  { key: "sem-prazo", label: "Sem Prazo", color: "text-slate-500", bg: "bg-slate-500/10 border-slate-500/30",
    match: (c) => c.status_distribuicao !== "entregue" && getDias(c.prazo_entrega) === null },
  { key: "5+", label: "Mais de 5 dias", color: "text-green-600", bg: "bg-green-500/10 border-green-500/30",
    match: (c) => { if (c.status_distribuicao === "entregue") return false; const d = getDias(c.prazo_entrega); return d !== null && d >= 5; } },
  { key: "4", label: "4 dias", color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-500/30",
    match: (c) => c.status_distribuicao !== "entregue" && getDias(c.prazo_entrega) === 4 },
  { key: "3", label: "3 dias", color: "text-orange-600", bg: "bg-orange-500/10 border-orange-500/30",
    match: (c) => c.status_distribuicao !== "entregue" && getDias(c.prazo_entrega) === 3 },
  { key: "2", label: "2 dias", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30",
    match: (c) => c.status_distribuicao !== "entregue" && getDias(c.prazo_entrega) === 2 },
  { key: "fatal", label: "Prazo Fatal / Atrasado", color: "text-red-600", bg: "bg-red-600/10 border-red-600/30",
    match: (c) => { if (c.status_distribuicao === "entregue") return false; const d = getDias(c.prazo_entrega); return d !== null && d <= 1; } },
  { key: "entregue", label: "Entregue", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30",
    match: (c) => c.status_distribuicao === "entregue" },
];

export default function DistribuicaoTstKanban() {
  const { user } = useAuth();
  const { isAdminOrCoordinator } = useUserRole();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAdvogados, setFiltroAdvogados] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroAba, setFiltroAba] = useState<string>("todas");
  const [abas, setAbas] = useState<string[]>([]);
  const [meusOnly, setMeusOnly] = useState<boolean>(!isAdminOrCoordinator);

  useEffect(() => { setMeusOnly(!isAdminOrCoordinator); }, [isAdminOrCoordinator]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("dados_benner" as any)
        .select("id, processo, dossie, prazo_entrega, status_distribuicao, distribuido_em, observacao_distribuicao, aba_origem, dados_benner_responsaveis!inner(usuario_id)")
        .not("distribuido_em", "is", null)
        .order("prazo_entrega", { ascending: true, nullsFirst: false })
        .limit(2000);

      const advFilter: string[] = [];
      if (meusOnly && user?.id) advFilter.push(user.id);
      if (filtroAdvogados.length > 0) advFilter.push(...filtroAdvogados);
      if (advFilter.length > 0) {
        query = query.in("dados_benner_responsaveis.usuario_id", advFilter);
      }
      if (filtroStatus !== "todos") query = query.eq("status_distribuicao", filtroStatus);
      if (filtroAba !== "todas") query = query.eq("aba_origem", filtroAba);

      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data as any[]) || []);
      // dedup by id (the inner join may duplicate)
      const uniqMap = new Map<string, any>();
      rows.forEach((r) => uniqMap.set(r.id, r));
      const uniq = [...uniqMap.values()];
      const ids = uniq.map((r) => r.id);
      const respMap = await loadResponsaveisMap(ids);
      setCards(uniq.map((r) => ({
        id: r.id,
        processo: r.processo,
        dossie: r.dossie,
        prazo_entrega: r.prazo_entrega,
        status_distribuicao: r.status_distribuicao,
        distribuido_em: r.distribuido_em,
        observacao_distribuicao: r.observacao_distribuicao,
        aba_origem: r.aba_origem,
        responsaveis: respMap.get(r.id) || [],
      })));
    } catch (e: any) {
      toast.error("Erro ao carregar Kanban: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [JSON.stringify(filtroAdvogados), filtroStatus, filtroAba, meusOnly, user?.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("dados_benner" as any).select("aba_origem").not("aba_origem", "is", null).not("distribuido_em", "is", null);
      const set = new Set<string>();
      ((data as any[]) || []).forEach((r) => r.aba_origem && set.add(r.aba_origem));
      setAbas([...set].sort());
    })();
  }, []);

  const updateStatus = async (id: string, status: "pendente" | "em_andamento" | "entregue") => {
    const patch: any = { status_distribuicao: status };
    if (status === "entregue") {
      patch.entregue_em = new Date().toISOString();
      patch.entregue_por = user?.id || null;
    } else {
      patch.entregue_em = null;
      patch.entregue_por = null;
    }
    const { error } = await supabase.from("dados_benner" as any).update(patch).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Status atualizado");
    await fetchData();
  };

  const totals = useMemo(() => columns.map((c) => ({ key: c.key, count: cards.filter(c.match).length })), [cards]);

  return (
    <MainLayout title="Kanban Delegação TST">
      <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/distribuicao-tst">
              <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            </Link>
            <h1 className="text-xl font-bold text-foreground">Kanban Delegação TST</h1>
            <span className="text-sm text-muted-foreground">{cards.length} processo(s) delegado(s)</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        <div className="border rounded-lg p-3 bg-muted/30 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Advogado(s)</Label>
            <ResponsaveisSelector selectedIds={filtroAdvogados} onChange={setFiltroAdvogados} placeholder="Todos" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Aba origem</Label>
            <Select value={filtroAba} onValueChange={setFiltroAba}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {abas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={meusOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setMeusOnly(!meusOnly)}
            >
              {meusOnly ? "Vendo: meus processos" : "Ver meus processos"}
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 h-full">
            {columns.map((col) => {
              const items = cards.filter(col.match);
              return (
                <div key={col.key} className={`flex flex-col rounded-lg border ${col.bg} min-h-[300px] overflow-hidden`}>
                  <div className={`px-3 py-2 border-b ${col.bg}`}>
                    <h3 className={`text-sm font-semibold ${col.color} truncate`}>{col.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length} processo(s)</span>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {items.map((c) => {
                        const dias = getDias(c.prazo_entrega);
                        return (
                          <div key={c.id} className="bg-card border border-border rounded-lg p-2 space-y-1">
                            <p className="text-xs font-mono font-semibold truncate">{c.processo || "Sem nº"}</p>
                            {c.dossie && <p className="text-[11px] text-muted-foreground truncate">Dossiê: {c.dossie}</p>}
                            <div className="flex items-center gap-1 flex-wrap text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {c.prazo_entrega ? format(new Date(c.prazo_entrega + "T12:00:00"), "dd/MM/yyyy") : "Sem prazo"}
                              {c.status_distribuicao !== "entregue" && (
                                <Badge variant={dias !== null && dias <= 1 ? "destructive" : "secondary"} className="text-[10px] px-1 py-0">
                                  {dias === null ? "S/P" : dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`}
                                </Badge>
                              )}
                            </div>
                            {c.responsaveis.length > 0 && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {c.responsaveis.map((r) => r.nome).join(", ")}
                              </p>
                            )}
                            {c.observacao_distribuicao && (
                              <p className="text-[10px] text-muted-foreground italic line-clamp-2">{c.observacao_distribuicao}</p>
                            )}
                            <div className="flex items-center gap-1 pt-1 flex-wrap">
                              {c.status_distribuicao !== "entregue" && (
                                <>
                                  {c.status_distribuicao !== "em_andamento" && (
                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => updateStatus(c.id, "em_andamento")}>
                                      <PlayCircle className="w-3 h-3 mr-1" /> Em andamento
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-600" onClick={() => updateStatus(c.id, "entregue")}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Entregue
                                  </Button>
                                </>
                              )}
                              {c.status_distribuicao === "entregue" && isAdminOrCoordinator && (
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => updateStatus(c.id, "pendente")}>
                                  Reabrir
                                </Button>
                              )}
                              <Link to={`/distribuicao-tst`} className="ml-auto">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">Nenhum processo</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}