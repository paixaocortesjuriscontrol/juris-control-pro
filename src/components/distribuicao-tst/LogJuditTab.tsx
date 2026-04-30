import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface JuditLog {
  id: string;
  processo_numero: string;
  tribunal: string | null;
  raw_response: any;
  request_payload: any;
  status: string;
  error_message: string | null;
  created_at: string;
  created_by: string | null;
}

interface Props {
  processoNumero: string;
}

function formatDateTime(s: string) {
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}

/** Pares chave/valor renderizados em uma grid compacta. */
function KV({ items }: { items: Array<[string, any]> }) {
  const visible = items.filter(([_, v]) => v !== null && v !== undefined && v !== "");
  if (!visible.length) return <p className="text-sm text-muted-foreground italic">Nenhum dado retornado.</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {visible.map(([k, v]) => (
        <div key={k} className="flex gap-2 min-w-0">
          <span className="font-medium text-muted-foreground min-w-[160px] shrink-0">{k}:</span>
          <span className="text-foreground break-words min-w-0 flex-1">{typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

/** Renderiza uma seção JSON colapsável com pretty-print. */
function JsonSection({ title, value, defaultOpen = false }: { title: string; value: any; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const isArr = Array.isArray(value);
  const isObj = value && typeof value === "object";
  const count = isArr ? value.length : isObj ? Object.keys(value).length : 0;
  if (!isObj || count === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm font-medium hover:text-primary w-full text-left py-1">
          <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
          {title}
          <Badge variant="secondary" className="text-xs h-5 px-1.5 ml-1">{count}</Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 p-3 bg-muted rounded text-xs leading-relaxed overflow-auto max-h-96 border border-border whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LogCard({ log, defaultExpanded = false }: { log: JuditLog; defaultExpanded?: boolean }) {
  const [open, setOpen] = useState(defaultExpanded);
  const r = log.raw_response || {};
  const ok = log.status === "sucesso";

  const camposPrincipais: Array<[string, any]> = [
    ["Processo", r.processo || log.processo_numero],
    ["Tribunal", r.tribunal_acronym || log.tribunal],
    ["Classe", r.classe || r.classification],
    ["Dossiê", r.dossie],
    ["Relator", r.relator],
    ["Turma", r.turma],
    ["Órgão Julgador", r.orgao_julgador],
    ["Data Distribuição", r.data_distribuicao],
    ["Situação", r.situacao_processo],
    ["Processo baixado", r.processo_baixado],
    ["Recorrente", r.recorrente],
    ["Tipo recurso", r.tipo_recurso],
    ["Tipo recurso (reclamante)", r.tipo_recurso_reclamante],
    ["Tipo recurso (banco)", r.tipo_recurso_banco],
    ["Valor da causa", r.valor_causa],
    ["Tem data de julgamento", r.tem_data_julgamento],
    ["Data julgamento", r.data_julgamento],
    ["Horário julgamento", r.horario_julgamento],
    ["Tipo julgamento", r.tipo_julgamento],
    ["Fonte tipo recurso", r._judit_meta?.fonte_tipo_recurso],
    ["Fonte dados", r._judit_meta?.fonte || r.fonte],
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
            {ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )}
            <CardTitle className="text-sm font-medium">{formatDateTime(log.created_at)}</CardTitle>
            <Badge variant={ok ? "outline" : "destructive"} className="text-[10px]">
              {log.status}
            </Badge>
            {log.tribunal && <Badge variant="secondary" className="text-[10px]">{log.tribunal}</Badge>}
          </div>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 pt-0">
          {log.error_message && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              {log.error_message}
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold mb-1.5 text-foreground/80">Campos principais</h4>
            <KV items={camposPrincipais} />
          </div>

          <JsonSection title="Partes (parties_detail)" value={r.parties_detail} />
          <JsonSection title="Partes (parties)" value={r.parties} />
          <JsonSection title="Movimentações (steps)" value={r.steps} />
          <JsonSection title="Tribunais (courts)" value={r.courts} />
          <JsonSection title="Classificações" value={r.classifications} />
          <JsonSection title="Anexos / Documentos" value={r.attachments} />
          <JsonSection title="Pauta de julgamento" value={r.pauta_julgamento} />
          <JsonSection title="Recursos detectados" value={r.recursos} />
          <JsonSection title="Metadados Judit (_judit_meta)" value={r._judit_meta} />
          <JsonSection title="Resposta completa (JSON cru)" value={r} />
          <JsonSection title="Payload da requisição" value={log.request_payload} />
        </CardContent>
      )}
    </Card>
  );
}

export function LogJuditTab({ processoNumero }: Props) {
  const [logs, setLogs] = useState<JuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!processoNumero) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("judit_logs" as any)
      .select("*")
      .eq("processo_numero", processoNumero)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Erro ao carregar logs Judit: " + error.message);
    } else {
      setLogs(((data as unknown) as JuditLog[]) || []);
    }
    setLoading(false);
  }, [processoNumero]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  if (!processoNumero) {
    return <p className="text-sm text-muted-foreground">Salve o registro com um número de processo para visualizar logs.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Histórico de consultas Judit</h3>
          <p className="text-xs text-muted-foreground">
            Cada clique no botão Judit grava aqui a resposta completa retornada pela API.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          Atualizar
        </Button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma consulta Judit registrada para este processo ainda.
        </p>
      ) : (
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-2 pr-3">
            {logs.map((log, idx) => (
              <LogCard key={log.id} log={log} defaultExpanded={idx === 0} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}