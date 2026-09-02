import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, Loader2, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadResponsaveisMap, ProfileBasic } from "@/hooks/useDistribuicaoResponsaveis";
import { COLUNAS_SELECT_PRONTO_SEM_PENDENCIA, getPendencias, isNaoPrecisaFazer, isMarcadoPronto } from "@/utils/distribuicaoTstPendencias";
import { useResponsaveisCounts } from "@/hooks/useResponsaveisCounts";
import { ensureMateriasOficiais } from "@/utils/materiasOficiaisCache";

interface Card {
  id: string;
  processo: string | null;
  dossie: string | null;
  prazo_entrega: string | null;
  status: string | null;
  status_distribuicao: string | null;
  distribuido_em: string | null;
  observacao_distribuicao: string | null;
  aba_origem: string | null;
  fontes_importacao?: string[] | null;
  responsaveis: ProfileBasic[];
  /** Linha completa (colunas de pendências) para calcular "Pronto sem pendência". */
  raw?: any;
  semPendencia?: boolean;
}

function getDias(prazo: string | null): number | null {
  if (!prazo) return null;
  return differenceInCalendarDays(new Date(prazo + "T12:00:00"), new Date());
}

type ColKey = "delegada" | "pronto" | "pronto_sem_pendencia" | "faltam";

// Concluído = pronto para enviar, já planilhado na carga ou enviado ao Benner.
const isPronto = (c: Card) =>
  c.status === "pronto_envio" || c.status === "planilhado" || c.status === "enviado";

const columns: { key: ColKey; label: string; color: string; bg: string; match: (c: Card) => boolean }[] = [
  { key: "delegada", label: "Delegada", color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/30",
    match: () => true },
  { key: "pronto", label: "Pronto", color: "text-teal-600", bg: "bg-teal-500/10 border-teal-500/30",
    match: (c) => isPronto(c) },
  { key: "pronto_sem_pendencia", label: "Pronto sem pendência", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30",
    match: (c) => isPronto(c) && !!c.semPendencia },
  { key: "faltam", label: "Faltam", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30",
    match: (c) => !isPronto(c) },
];

export default function DistribuicaoTstKanban() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAdvogados, setFiltroAdvogados] = useState<string[]>([]);
  const { counts: contagensDistribuicao } = useResponsaveisCounts({});

  // Dialog para alterar status / observação
  const [statusCard, setStatusCard] = useState<Card | null>(null);
  const [statusValue, setStatusValue] = useState<string>("delegada");
  const [obsValue, setObsValue] = useState<string>("");
  const [savingStatus, setSavingStatus] = useState(false);

  const openStatusDialog = (c: Card) => {
    setStatusCard(c);
    setStatusValue(c.status_distribuicao || "delegada");
    setObsValue(c.observacao_distribuicao || "");
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const baseCols = [
        "id", "processo", "dossie", "prazo_entrega", "status", "status_distribuicao",
        "distribuido_em", "observacao_distribuicao", "aba_origem", "fontes_importacao",
      ];
      // Usa exatamente o mesmo conjunto de colunas do card "Pronto sem pendência".
      const selectCols = Array.from(new Set([...baseCols, ...COLUNAS_SELECT_PRONTO_SEM_PENDENCIA])).join(", ");

      // Paginação completa (sem limite fixo) para as contagens baterem com os
      // totalizadores da tela Distribuição TST.
      const PAGE = 1000;
      const rows: any[] = [];
      let from = 0;
      while (true) {
        let query = supabase
          .from("dados_benner" as any)
          .select(`${selectCols}, dados_benner_responsaveis!inner(usuario_id)`)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);

        if (filtroAdvogados.length > 0) {
          query = query.in("dados_benner_responsaveis.usuario_id", filtroAdvogados);
        }
        const { data, error } = await query;
        if (error) throw error;
        const pagina = (data as any[]) || [];
        rows.push(...pagina);
        if (pagina.length < PAGE) break;
        from += PAGE;
      }

      await ensureMateriasOficiais().catch(() => {});
      // dedup by id (the inner join may duplicate)
      const uniqMap = new Map<string, any>();
      rows.forEach((r) => uniqMap.set(r.id, r));
      const uniq = [...uniqMap.values()];
      // Mantém a ordenação por prazo de entrega na exibição.
      uniq.sort((a, b) => {
        if (!a.prazo_entrega && !b.prazo_entrega) return 0;
        if (!a.prazo_entrega) return 1;
        if (!b.prazo_entrega) return -1;
        return a.prazo_entrega.localeCompare(b.prazo_entrega);
      });
      const ids = uniq.map((r) => r.id);
      const respMap = await loadResponsaveisMap(ids);
      setCards(uniq.map((r) => ({
        id: r.id,
        processo: r.processo,
        dossie: r.dossie,
        prazo_entrega: r.prazo_entrega,
        status: r.status,
        status_distribuicao: r.status_distribuicao,
        distribuido_em: r.distribuido_em,
        observacao_distribuicao: r.observacao_distribuicao,
        aba_origem: r.aba_origem,
        fontes_importacao: r.fontes_importacao || [],
        responsaveis: respMap.get(r.id) || [],
        raw: r,
        // Mesma regra do card: isentos ("não precisa fazer") não entram.
        semPendencia:
          (isMarcadoPronto(r) || !isNaoPrecisaFazer(r)) && getPendencias(r).length === 0,
      })));
    } catch (e: any) {
      toast.error("Erro ao carregar Kanban: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [JSON.stringify(filtroAdvogados)]);

  const saveStatusDialog = async () => {
    if (!statusCard) return;
    setSavingStatus(true);
    try {
      const patch: any = {
        status_distribuicao: statusValue,
        observacao_distribuicao: obsValue || null,
      };
      if (statusValue === "finalizada") {
        patch.entregue_em = new Date().toISOString();
        patch.entregue_por = user?.id || null;
      } else {
        patch.entregue_em = null;
        patch.entregue_por = null;
      }
      const { error } = await supabase.from("dados_benner" as any).update(patch).eq("id", statusCard.id);
      if (error) throw error;
      toast.success("Tarefa atualizada");
      setStatusCard(null);
      await fetchData();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setSavingStatus(false);
    }
  };

  // A quantidade delegada usa exatamente a mesma contagem da tela Distribuição TST.
  const resumoResponsaveis = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; total: number; pronto: number; semPend: number }>();
    cards.forEach((c) => {
      const pronto = isPronto(c);
      const prontoOk = pronto && !!c.semPendencia;
      if (c.responsaveis.length === 0) {
        // Mesmo id usado por useResponsaveisCounts para o bucket "Sem responsável",
        // evitando dois cards duplicados no resumo.
        const k = "00000000-0000-0000-0000-000000000000";
        const cur = map.get(k) || { id: k, nome: "Sem responsável", total: 0, pronto: 0, semPend: 0 };
        cur.total += 1;
        if (pronto) cur.pronto += 1;
        if (prontoOk) cur.semPend += 1;
        map.set(k, cur);
      } else {
        c.responsaveis.forEach((r) => {
          const cur = map.get(r.id) || { id: r.id, nome: r.nome, total: 0, pronto: 0, semPend: 0 };
          cur.total += 1;
          if (pronto) cur.pronto += 1;
          if (prontoOk) cur.semPend += 1;
          map.set(r.id, cur);
        });
      }
    });
    contagensDistribuicao.forEach((contagem) => {
      const cur = map.get(contagem.id) || {
        id: contagem.id,
        nome: contagem.nome,
        total: 0,
        pronto: contagem.pronto,
        semPend: 0,
      };
      cur.nome = contagem.nome;
      cur.total = contagem.count;
      cur.pronto = contagem.pronto;
      map.set(contagem.id, cur);
    });
    return [...map.values()].sort((a, b) => {
      const fa = a.total - a.pronto;
      const fb = b.total - b.pronto;
      if (fb !== fa) return fb - fa;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [cards, contagensDistribuicao]);

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

        <div className="flex-1 min-h-0 overflow-y-auto">
          {resumoResponsaveis.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Por responsável <span className="font-normal normal-case">({resumoResponsaveis.length})</span>
                </h3>
              </div>
              <div className="w-full">
                <div className="flex flex-wrap gap-2 pb-2">
                  {resumoResponsaveis.map((r) => {
                    const faltam = r.total - r.pronto;
                    const pct = r.total > 0 ? Math.round((r.pronto / r.total) * 100) : 0;
                    const ativo = filtroAdvogados.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          if (r.id === "00000000-0000-0000-0000-000000000000") return;
                          setFiltroAdvogados((prev) => prev.includes(r.id) ? [] : [r.id]);
                        }}
                        className={`w-[200px] max-w-full text-left rounded-lg border p-2.5 transition-colors bg-card hover:border-primary/60 ${
                          ativo ? "border-primary ring-1 ring-primary/40" : "border-border"
                        }`}
                      >
                        <p className="text-xs font-semibold truncate" title={r.nome}>{r.nome}</p>
                        <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">Delegada</p>
                            <p className="text-sm font-bold text-foreground">{r.total}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">Pronto</p>
                            <p className="text-sm font-bold text-teal-600">{r.pronto}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">S/pend</p>
                            <p className="text-sm font-bold text-emerald-600">{r.semPend}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-muted-foreground">Faltam</p>
                            <p className={`text-sm font-bold ${faltam > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{faltam}</p>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right mt-0.5">{pct}%</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {columns.map((col) => {
              const items = cards.filter(col.match);
              return (
                <div key={col.key} className={`flex flex-col rounded-lg border ${col.bg} min-h-[300px] max-h-[70vh] overflow-hidden`}>
                  <div className={`px-3 py-2 border-b ${col.bg}`}>
                    <h3 className={`text-sm font-semibold ${col.color} truncate`}>{col.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length} processo(s)</span>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {items.map((c) => {
                        const dias = getDias(c.prazo_entrega);
                        return (
                          <div key={c.id} className="bg-card border border-border rounded-lg p-2 space-y-1 hover:border-primary/60 transition-colors cursor-pointer"
                               onClick={() => navigate(`/distribuicao-tst?editId=${c.id}`)}>
                            <p className="text-xs font-mono font-semibold truncate">{c.processo || "Sem nº"}</p>
                            {c.dossie && <p className="text-[11px] text-muted-foreground truncate">Dossiê: {c.dossie}</p>}
                            {c.fontes_importacao && c.fontes_importacao.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {c.fontes_importacao.map((f) => (
                                  <Badge key={f} variant="outline" className="text-[9px] px-1 py-0 font-normal">
                                    {f}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1 flex-wrap text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {c.prazo_entrega ? format(new Date(c.prazo_entrega + "T12:00:00"), "dd/MM/yyyy") : "Sem prazo"}
                              {c.status_distribuicao !== "finalizada" && c.prazo_entrega && (
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] ml-auto"
                                onClick={(e) => { e.stopPropagation(); openStatusDialog(c); }}
                              >
                                Alterar situação
                              </Button>
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

      <Dialog open={!!statusCard} onOpenChange={(o) => !o && setStatusCard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Situação da delegação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {statusCard && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-mono text-foreground">{statusCard.processo || "Sem nº"}</p>
                {statusCard.dossie && <p>Dossiê: {statusCard.dossie}</p>}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Situação</Label>
              <Select value={statusValue} onValueChange={setStatusValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delegada">Delegada</SelectItem>
                  <SelectItem value="em_andamento">Em análise</SelectItem>
                  <SelectItem value="finalizada">Pronto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação</Label>
              <Textarea
                rows={4}
                value={obsValue}
                onChange={(e) => setObsValue(e.target.value)}
                placeholder="Anotações sobre o andamento da tarefa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusCard(null)} disabled={savingStatus}>Cancelar</Button>
            <Button onClick={saveStatusDialog} disabled={savingStatus}>
              {savingStatus && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}