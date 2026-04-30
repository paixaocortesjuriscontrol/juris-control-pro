import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Database, Cloud, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Props { processoNumero: string; }

interface JuditLog {
  id: string;
  processo_numero: string;
  tribunal: string | null;
  raw_response: any;
  created_at: string;
  status: string;
  error_message: string | null;
}

/* ───────────── Formatação ───────────── */

const DATE_KEY_RE = /(date|data|_at|criado|atualizado|distribuicao|julgamento|prazo)/i;
const MONEY_KEY_RE = /(valor|amount|preco|montante|causa)/i;
const BOOL_LABELS: Record<string, string> = { true: "Sim", false: "Não" };

const PT_LABELS: Record<string, string> = {
  cnj: "Número CNJ",
  code: "Código / CNJ",
  name: "Nome",
  amount: "Valor",
  area: "Área",
  city: "Cidade",
  county: "Comarca / Vara",
  state: "UF",
  status: "Status",
  phase: "Fase",
  situation: "Situação",
  instance: "Instância",
  justice: "Justiça",
  justice_description: "Justiça (descrição)",
  free_justice: "Justiça gratuita",
  judge: "Juiz / Relator",
  distribution_date: "Data de distribuição",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  step_date: "Data do movimento",
  step_id: "ID do movimento",
  step_type: "Tipo do movimento",
  steps_count: "Total de movimentos",
  content: "Descrição",
  source_name: "Fonte",
  crawl_id: "ID da consulta (crawler)",
  weight: "Peso",
  secrecy_level: "Nível de sigilo",
  private: "Sigiloso",
  tribunal_acronym: "Tribunal",
  orgao_julgador: "Órgão julgador",
  classe: "Classe",
  relator: "Relator",
  turma: "Turma",
  dossie: "Dossiê",
  recorrente: "Recorrente",
  tipo_recurso: "Tipo de recurso",
  data_julgamento: "Data do julgamento",
  horario_julgamento: "Horário do julgamento",
  tipo_julgamento: "Tipo de julgamento",
  tem_data_julgamento: "Tem data de julgamento",
  processo_baixado: "Processo baixado",
  situacao_processo: "Situação do processo",
  valor_causa: "Valor da causa",
  data_distribuicao: "Data de distribuição",
  fonte: "Fonte",
  documents: "Documentos",
  main_document: "Documento principal",
  person_type: "Tipo",
  side: "Polo",
  lawyers: "Advogados",
  parties: "Partes",
  parties_detail: "Partes (detalhe)",
  steps: "Movimentações",
  courts: "Tribunais",
  classifications: "Classificações",
  attachments: "Anexos",
  pipelines: "Pipelines",
  related_lawsuits: "Processos relacionados",
  phase_history: "Histórico de fases",
  last_step: "Último movimento",
  crawler: "Crawler (metadados)",
  cache_lookup: "Cache (consulta anterior)",
  datajud_tst: "DataJud TST (CNJ)",
  tribunal_hint: "Tribunal (sugerido)",
  numeroProcesso: "Número do processo",
  dataAjuizamento: "Data de ajuizamento",
  movimentos: "Movimentos",
  classe_orgaoJulgador: "Órgão julgador",
};

function label(k: string): string {
  if (PT_LABELS[k]) return PT_LABELS[k];
  return k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/* ───────────── Collapsible wrapper para listas ───────────── */

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold mb-2 text-foreground/80 hover:text-foreground transition-colors w-full text-left"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        <span>{title}</span>
        {typeof count === "number" && (
          <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>
        )}
      </button>
      {open && <div className="pl-1">{children}</div>}
    </div>
  );
}

function isIsoDate(v: any): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})/.test(v);
}
function fmtDate(v: any): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString("pt-BR");
  } catch { return String(v); }
}
function fmtMoney(v: any): string {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  if (isNaN(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPrimitive(k: string, v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (v === "true" || v === "false") return BOOL_LABELS[v];
  if (MONEY_KEY_RE.test(k) && (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v)))) return fmtMoney(v);
  if (isIsoDate(v) || (DATE_KEY_RE.test(k) && typeof v === "string" && !isNaN(Date.parse(v)))) return fmtDate(v);
  return String(v);
}

/* ───────────── Renderizadores ───────────── */

function PrimitiveField({ k, v }: { k: string; v: any }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">{label(k)}</div>
      <div className="text-sm text-foreground break-words">{fmtPrimitive(k, v)}</div>
    </div>
  );
}

function PartiesList({ parties }: { parties: any[] }) {
  if (!parties?.length) return <p className="text-sm text-muted-foreground italic">Nenhuma parte.</p>;
  return (
    <div className="space-y-2">
      {parties.map((p, i) => {
        const nome = p?.name || p?.nome || "—";
        const tipo = p?.person_type || p?.type || p?.tipo || "";
        const lado = p?.side || p?.polo || "";
        const doc = p?.main_document || p?.document || p?.cpf || p?.cnpj || "";
        const advs: any[] = Array.isArray(p?.lawyers) ? p.lawyers : (Array.isArray(p?.advogados) ? p.advogados : []);
        return (
          <div key={i} className="border rounded p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-medium text-sm break-words">{nome}</div>
              <div className="flex gap-1 flex-wrap">
                {tipo && <Badge variant="outline" className="text-xs">{tipo}</Badge>}
                {lado && <Badge variant="secondary" className="text-xs">{lado}</Badge>}
              </div>
            </div>
            {doc && <div className="text-xs text-muted-foreground mt-1">Documento: {doc}</div>}
            {advs.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">Advogados ({advs.length}):</div>
                <ul className="text-xs space-y-0.5 pl-4 list-disc">
                  {advs.map((a, j) => {
                    const an = a?.name || a?.nome || "—";
                    const oab = a?.license_number || a?.oab || a?.numero_oab || a?.main_document || "";
                    return <li key={j} className="break-words">{an}{oab ? ` — ${oab}` : ""}</li>;
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepsTimeline({ steps }: { steps: any[] }) {
  if (!steps?.length) return <p className="text-sm text-muted-foreground italic">Sem movimentações.</p>;
  const sorted = [...steps].sort((a, b) => {
    const da = new Date(a?.step_date || a?.date || a?.data || 0).getTime();
    const db = new Date(b?.step_date || b?.date || b?.data || 0).getTime();
    return db - da;
  });
  return (
    <ol className="relative border-l border-border pl-4 space-y-3">
      {sorted.slice(0, 200).map((s: any, i: number) => {
        const data = s?.step_date || s?.date || s?.data || s?.dataHora;
        const desc = s?.content || s?.descricao || s?.description || s?.title || s?.name || s?.nome;
        const tipo = s?.step_type || s?.type;
        return (
          <li key={i} className="ml-1">
            <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
            <div className="text-xs text-muted-foreground">{fmtDate(data)}{tipo && tipo !== "NÃO INFORMADO" ? ` · ${tipo}` : ""}</div>
            <div className="text-sm text-foreground break-words">{desc || "—"}</div>
          </li>
        );
      })}
      {sorted.length > 200 && (
        <li className="text-xs text-muted-foreground italic ml-1">
          Exibindo as 200 mais recentes de {sorted.length}.
        </li>
      )}
    </ol>
  );
}

function ListOfObjects({ items }: { items: any[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground italic">Nenhum item.</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="border rounded p-2 bg-muted/30">
          {typeof it === "object" && it !== null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(it).map(([k, v]) => {
                if (v === null || v === undefined || v === "") return null;
                if (Array.isArray(v) || typeof v === "object") {
                  return (
                    <div key={k} className="md:col-span-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">{label(k)}</div>
                      {Array.isArray(v) ? (
                        <ListOfObjects items={v} />
                      ) : (
                        <ObjectFlat obj={v} />
                      )}
                    </div>
                  );
                }
                return <PrimitiveField key={k} k={k} v={v} />;
              })}
            </div>
          ) : (
            <div className="text-sm break-words">{String(it)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Renderiza um objeto exibindo TODOS os campos (primitivos em grid, sub-objetos/arrays em sub-blocos). */
function ObjectFlat({ obj }: { obj: any }) {
  if (!obj || typeof obj !== "object") return <div className="text-sm">{String(obj ?? "—")}</div>;
  const entries = Object.entries(obj);
  const primitives = entries.filter(([_, v]) => v === null || (typeof v !== "object"));
  const complexes = entries.filter(([_, v]) => v !== null && typeof v === "object");

  return (
    <div className="space-y-3">
      {primitives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
          {primitives.map(([k, v]) => <PrimitiveField key={k} k={k} v={v} />)}
        </div>
      )}
      {complexes.map(([k, v]) => {
        const isArr = Array.isArray(v);
        const count = isArr ? (v as any[]).length : Object.keys(v as any).length;
        // Renderizadores especializados
        if (isArr && (k === "parties" || k === "parties_detail")) {
          return (
            <CollapsibleSection key={k} title={label(k)} count={count}>
              <PartiesList parties={v as any[]} />
            </CollapsibleSection>
          );
        }
        if (isArr && (k === "steps" || k === "movimentos")) {
          return (
            <CollapsibleSection key={k} title={label(k)} count={count} defaultOpen={false}>
              <StepsTimeline steps={v as any[]} />
            </CollapsibleSection>
          );
        }
        if (isArr) {
          return (
            <CollapsibleSection key={k} title={label(k)} count={count} defaultOpen={count > 0 && count <= 5}>
              {count === 0
                ? <p className="text-sm text-muted-foreground italic">Vazio.</p>
                : <ListOfObjects items={v as any[]} />}
            </CollapsibleSection>
          );
        }
        // Sub-objeto
        return (
          <div key={k} className="border rounded p-3 bg-muted/30">
            <div className="text-sm font-semibold mb-2 text-foreground/80">{label(k)}</div>
            <ObjectFlat obj={v} />
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── Card por fonte ───────────── */

const SOURCE_META: Record<string, { title: string; icon: any }> = {
  cache_lookup: { title: "Cache Judit (consulta anterior armazenada)", icon: Database },
  crawler: { title: "Crawler Judit (consulta nova ao tribunal)", icon: Cloud },
  datajud_tst: { title: "DataJud TST (API pública do CNJ)", icon: Building2 },
};

function SourceCard({ name, value }: { name: string; value: any }) {
  const meta = SOURCE_META[name] || { title: label(name), icon: Database };
  const Icon = meta.icon;
  const empty = !value || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {meta.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground italic">Sem dados retornados por esta fonte.</p>
        ) : typeof value === "object" && !Array.isArray(value) ? (
          <ObjectFlat obj={value} />
        ) : Array.isArray(value) ? (
          <ListOfObjects items={value} />
        ) : (
          <div className="text-sm break-words">{String(value)}</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────── Componente principal ───────────── */

export function AnaliseJuditTab({ processoNumero }: Props) {
  const [log, setLog] = useState<JuditLog | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLastLog = useCallback(async () => {
    if (!processoNumero) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("judit_logs" as any)
      .select("*")
      .eq("processo_numero", processoNumero)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) toast.error("Erro ao carregar análise Judit: " + error.message);
    else setLog(((data as unknown) as JuditLog[])?.[0] || null);
    setLoading(false);
  }, [processoNumero]);

  useEffect(() => { void fetchLastLog(); }, [fetchLastLog]);

  const r: any = log?.raw_response || {};
  const raw = r._judit_raw;

  // Lista ordenada de fontes a exibir (cnj/tribunal_hint vão no cabeçalho)
  const sources = useMemo(() => {
    if (!raw || typeof raw !== "object") return [];
    const order = ["cache_lookup", "crawler", "datajud_tst"];
    const known = order.filter(k => k in raw);
    const others = Object.keys(raw).filter(k => !order.includes(k) && !["cnj", "tribunal_hint"].includes(k));
    return [...known, ...others];
  }, [raw]);

  if (!processoNumero) {
    return <p className="text-sm text-muted-foreground">Salve o registro com um número de processo para visualizar a análise.</p>;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold">Análise da última consulta Judit</h3>
          <p className="text-sm text-muted-foreground">
            Todos os dados retornados pela Judit (Cache + Crawler + DataJud), organizados de forma legível.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {log && (
            <Badge variant={log.status === "sucesso" ? "outline" : "destructive"} className="text-xs">
              {log.status === "sucesso"
                ? <CheckCircle2 className="w-3 h-3 mr-1" />
                : <AlertCircle className="w-3 h-3 mr-1" />}
              {log.status}
            </Badge>
          )}
          {log && <span className="text-xs text-muted-foreground">{fmtDate(log.created_at)}</span>}
          <Button variant="outline" size="sm" onClick={() => void fetchLastLog()} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Atualizar
          </Button>
        </div>
      </div>

      {loading && !log ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !log ? (
        <p className="text-base text-muted-foreground py-8 text-center">
          Nenhuma consulta Judit registrada para este processo ainda.
        </p>
      ) : !raw ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Esta consulta foi feita antes da gravação do <strong>Judit RAW</strong>. Clique novamente no botão Judit
              na aba "Dados Benner" para registrar uma consulta nova com os dados completos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cabeçalho com cnj + tribunal_hint */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Identificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PrimitiveField k="cnj" v={raw.cnj || log.processo_numero} />
                <PrimitiveField k="tribunal_hint" v={raw.tribunal_hint || log.tribunal} />
                <PrimitiveField k="created_at" v={log.created_at} />
              </div>
            </CardContent>
          </Card>

          {sources.map(name => (
            <SourceCard key={name} name={name} value={raw[name]} />
          ))}
        </>
      )}
    </div>
  );
}