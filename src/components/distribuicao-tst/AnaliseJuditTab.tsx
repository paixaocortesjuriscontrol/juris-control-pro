import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, FileText, Users, Gavel, Calendar, Scale, Building2, Paperclip } from "lucide-react";
import { toast } from "sonner";

interface Props {
  processoNumero: string;
}

interface JuditLog {
  id: string;
  processo_numero: string;
  tribunal: string | null;
  raw_response: any;
  request_payload: any;
  status: string;
  error_message: string | null;
  created_at: string;
}

function fmtDate(s: any): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleDateString("pt-BR");
  } catch { return String(s); }
}
function fmtDateTime(s: any): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString("pt-BR");
  } catch { return String(s); }
}
function fmtBool(v: any): string {
  if (v === true || v === "true" || v === "Sim" || v === "SIM") return "Sim";
  if (v === false || v === "false" || v === "Não" || v === "NAO" || v === "NÃO") return "Não";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
function fmtMoney(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  if (isNaN(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function nz(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function Field({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">{label}</div>
      <div className="text-sm text-foreground break-words">{value ?? "—"}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  count,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
          {typeof count === "number" && (
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
    if (error) {
      toast.error("Erro ao carregar análise Judit: " + error.message);
    } else {
      const row = ((data as unknown) as JuditLog[])?.[0] || null;
      setLog(row);
    }
    setLoading(false);
  }, [processoNumero]);

  useEffect(() => { void fetchLastLog(); }, [fetchLastLog]);

  const r: any = log?.raw_response || {};

  const partes = useMemo(() => {
    const arr: any[] = Array.isArray(r.parties_detail) && r.parties_detail.length
      ? r.parties_detail
      : Array.isArray(r.parties) ? r.parties : [];
    return arr;
  }, [r]);

  const movimentos = useMemo(() => {
    const steps: any[] = Array.isArray(r.steps) ? r.steps : [];
    // ordenar por data desc se possível
    return [...steps].sort((a, b) => {
      const da = new Date(a?.step_date || a?.date || a?.data || 0).getTime();
      const db = new Date(b?.step_date || b?.date || b?.data || 0).getTime();
      return db - da;
    });
  }, [r]);

  const anexos: any[] = Array.isArray(r.attachments) ? r.attachments : [];
  const tribunais: any[] = Array.isArray(r.courts) ? r.courts : [];
  const recursos: any[] = Array.isArray(r.recursos) ? r.recursos : [];
  const pauta = r.pauta_julgamento;

  if (!processoNumero) {
    return <p className="text-sm text-muted-foreground">Salve o registro com um número de processo para visualizar a análise.</p>;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold">Análise da resposta Judit</h3>
          <p className="text-sm text-muted-foreground">
            Última consulta organizada de forma legível para análise jurídica.
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
          {log && (
            <span className="text-xs text-muted-foreground">{fmtDateTime(log.created_at)}</span>
          )}
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
      ) : (
        <>
          {log.error_message && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              <strong>Erro:</strong> {log.error_message}
            </div>
          )}

          <Section title="Identificação do processo" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Número do processo" value={nz(r.processo || log.processo_numero)} />
              <Field label="Tribunal" value={nz(r.tribunal_acronym || log.tribunal)} />
              <Field label="Classe processual" value={nz(r.classe || r.classification)} />
              <Field label="Dossiê" value={nz(r.dossie)} />
              <Field label="Órgão julgador" value={nz(r.orgao_julgador)} />
              <Field label="Turma" value={nz(r.turma)} />
              <Field label="Relator" value={nz(r.relator)} />
              <Field label="Situação" value={nz(r.situacao_processo)} />
              <Field label="Processo baixado" value={fmtBool(r.processo_baixado)} />
              <Field label="Data da distribuição" value={fmtDate(r.data_distribuicao)} />
              <Field label="Valor da causa" value={fmtMoney(r.valor_causa)} />
              <Field label="Fonte dos dados" value={nz(r._judit_meta?.fonte || r.fonte)} />
            </div>
          </Section>

          <Section title="Recurso" icon={Scale}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Recorrente" value={nz(r.recorrente)} />
              <Field label="Tipo de recurso" value={nz(r.tipo_recurso)} />
              <Field label="Tipo de recurso (reclamante)" value={nz(r.tipo_recurso_reclamante)} />
              <Field label="Tipo de recurso (banco)" value={nz(r.tipo_recurso_banco)} />
              <Field label="Fonte do tipo de recurso" value={nz(r._judit_meta?.fonte_tipo_recurso)} />
            </div>
            {recursos.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                  Recursos detectados ({recursos.length})
                </div>
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {recursos.map((rec: any, i: number) => (
                    <li key={i} className="break-words">
                      {typeof rec === "string" ? rec : (rec?.tipo || rec?.descricao || JSON.stringify(rec))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Julgamento e pauta" icon={Calendar}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Tem data de julgamento" value={fmtBool(r.tem_data_julgamento)} />
              <Field label="Data do julgamento" value={fmtDate(r.data_julgamento)} />
              <Field label="Horário" value={nz(r.horario_julgamento)} />
              <Field label="Tipo de julgamento" value={nz(r.tipo_julgamento)} />
            </div>
            {pauta && (typeof pauta === "object") && (
              <div className="mt-4 border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(pauta).map(([k, v]) => (
                  <Field key={k} label={k} value={typeof v === "object" ? JSON.stringify(v) : nz(v)} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Partes do processo" icon={Users} count={partes.length}>
            {partes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma parte retornada.</p>
            ) : (
              <div className="space-y-3">
                {partes.map((p: any, i: number) => {
                  const nome = p?.name || p?.nome || p?.party_name || "—";
                  const tipo = p?.type || p?.tipo || p?.party_type || p?.role || "";
                  const doc = p?.document || p?.cpf || p?.cnpj || p?.documento || "";
                  const lado = p?.side || p?.polo || p?.polo_processual || "";
                  const advs: any[] = Array.isArray(p?.lawyers) ? p.lawyers
                    : Array.isArray(p?.advogados) ? p.advogados : [];
                  return (
                    <div key={i} className="border rounded p-3 bg-muted/30">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="font-medium text-sm">{nome}</div>
                        <div className="flex gap-1 flex-wrap">
                          {tipo && <Badge variant="outline" className="text-xs">{tipo}</Badge>}
                          {lado && <Badge variant="secondary" className="text-xs">{lado}</Badge>}
                        </div>
                      </div>
                      {doc && <div className="text-xs text-muted-foreground mt-1">Documento: {doc}</div>}
                      {advs.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Advogados:</div>
                          <ul className="text-xs space-y-0.5 pl-4 list-disc">
                            {advs.map((a: any, j: number) => {
                              const an = a?.name || a?.nome || "—";
                              const oab = a?.license_number || a?.oab || a?.numero_oab || "";
                              return <li key={j}>{an}{oab ? ` — OAB ${oab}` : ""}</li>;
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Tribunais / Instâncias" icon={Building2} count={tribunais.length}>
            {tribunais.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sem informações de instâncias.</p>
            ) : (
              <div className="space-y-2">
                {tribunais.map((c: any, i: number) => (
                  <div key={i} className="border rounded p-2 text-sm bg-muted/30">
                    <div className="font-medium">{c?.tribunal_acronym || c?.acronym || c?.name || "Tribunal"}</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1 text-xs text-muted-foreground">
                      {c?.instance && <div>Instância: <span className="text-foreground">{c.instance}</span></div>}
                      {c?.distribution_date && <div>Distribuição: <span className="text-foreground">{fmtDate(c.distribution_date)}</span></div>}
                      {c?.judge && <div>Juiz/Relator: <span className="text-foreground">{c.judge}</span></div>}
                      {c?.court && <div>Vara/Órgão: <span className="text-foreground">{c.court}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Movimentações" icon={Gavel} count={movimentos.length}>
            {movimentos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sem movimentações.</p>
            ) : (
              <ol className="relative border-l border-border pl-4 space-y-3">
                {movimentos.slice(0, 100).map((s: any, i: number) => {
                  const data = s?.step_date || s?.date || s?.data;
                  const desc = s?.content || s?.descricao || s?.description || s?.title || s?.name;
                  return (
                    <li key={i} className="ml-1">
                      <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                      <div className="text-xs text-muted-foreground">{fmtDate(data)}</div>
                      <div className="text-sm text-foreground break-words">{nz(desc)}</div>
                    </li>
                  );
                })}
                {movimentos.length > 100 && (
                  <li className="text-xs text-muted-foreground italic ml-1">
                    Exibindo as 100 mais recentes de {movimentos.length}.
                  </li>
                )}
              </ol>
            )}
          </Section>

          <Section title="Anexos / Documentos" icon={Paperclip} count={anexos.length}>
            {anexos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sem anexos retornados.</p>
            ) : (
              <ul className="space-y-2">
                {anexos.map((a: any, i: number) => {
                  const nome = a?.name || a?.title || a?.filename || `Anexo ${i + 1}`;
                  const tipo = a?.type || a?.mime_type || "";
                  const url = a?.url || a?.link;
                  const data = a?.date || a?.created_at;
                  return (
                    <li key={i} className="border rounded p-2 text-sm bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {tipo && <span>{tipo}</span>}
                          {tipo && data && <span> · </span>}
                          {data && <span>{fmtDate(data)}</span>}
                        </div>
                      </div>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline shrink-0">
                          Abrir
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}