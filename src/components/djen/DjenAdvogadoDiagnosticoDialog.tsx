import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";

type MonitoramentoAdvogado = {
  id: string;
  tipo: string;
  termo_busca: string;
  oab: string | null;
  uf: string | null;
  tribunais: string[] | null;
};

type AttemptResult = {
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  itemsCount: number | null;
  total: number | null;
  sample: unknown;
  error: string | null;
};

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";
const ENDPOINTS = [`${PJE_COMUNICA_API}/comunicacao`, `${PJE_COMUNICA_API}/comunicacoes`];

const TODOS_IDS_CIVEIS = [
  "TJAC",
  "TJAL",
  "TJAM",
  "TJAP",
  "TJBA",
  "TJCE",
  "TJDFT",
  "TJES",
  "TJGO",
  "TJMA",
  "TJMG",
  "TJMS",
  "TJMT",
  "TJPA",
  "TJPB",
  "TJPE",
  "TJPI",
  "TJPR",
  "TJRJ",
  "TJRN",
  "TJRO",
  "TJRR",
  "TJRS",
  "TJSC",
  "TJSE",
  "TJSP",
  "TJTO",
];

const TODOS_IDS_TRABALHISTAS = [
  "TST",
  "TRT1",
  "TRT2",
  "TRT3",
  "TRT4",
  "TRT5",
  "TRT6",
  "TRT7",
  "TRT8",
  "TRT9",
  "TRT10",
  "TRT11",
  "TRT12",
  "TRT13",
  "TRT14",
  "TRT15",
  "TRT16",
  "TRT17",
  "TRT18",
  "TRT19",
  "TRT20",
  "TRT21",
  "TRT22",
  "TRT23",
  "TRT24",
];

function expandirTribunais(tribunais: string[] | null | undefined): string[] {
  if (!tribunais || tribunais.length === 0) return [];
  const expandidos = new Set<string>();
  for (const t of tribunais) {
    if (t === "TODOS_CIVEIS") TODOS_IDS_CIVEIS.forEach((id) => expandidos.add(id));
    else if (t === "TODOS_TRT") TODOS_IDS_TRABALHISTAS.forEach((id) => expandidos.add(id));
    else if (t) expandidos.add(String(t).trim().toUpperCase());
  }
  return Array.from(expandidos);
}

function extractItems(data: any): any[] {
  const items = data?.items ?? data?.content ?? data?.comunicacoes ?? data?.publicacoes ?? [];
  return Array.isArray(items) ? items : [];
}

function safeNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function getTotal(data: any): number | null {
  return (
    safeNumber(data?.totalElements) ??
    safeNumber(data?.count) ??
    safeNumber(data?.total) ??
    safeNumber(data?.totalCount)
  );
}

function normalizeAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type DiagnosticRunInput = {
  oab: string;
  uf: string;
  tribunal?: string;
  dataInicio: string;
  dataFim: string;
  pageSize: number;
};

function buildQueryParams(input: DiagnosticRunInput, opts: { includeTexto: boolean }) {
  const qp = new URLSearchParams();

  // Texto: hoje o app sempre envia (via pjeComunicaClient). Aqui testamos os 2 cenários.
  if (opts.includeTexto) {
    qp.set("texto", normalizeAccents(`OAB ${input.oab} ${input.uf}`));
  }

  qp.set("numeroOab", input.oab);
  qp.set("ufOab", input.uf);

  if (input.tribunal) qp.set("siglaTribunal", input.tribunal);

  qp.set("dataDisponibilizacaoInicio", input.dataInicio);
  qp.set("dataDisponibilizacaoFim", input.dataFim);

  // Paginação: enviar variações para compatibilidade
  qp.set("pagina", "0");
  qp.set("tamanhoPagina", String(input.pageSize));
  qp.set("page", "0");
  qp.set("size", String(input.pageSize));
  qp.set("itensPorPagina", String(input.pageSize));

  return qp;
}

async function tryFetch(url: string, signal?: AbortSignal): Promise<AttemptResult> {
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json, text/plain, */*" },
      signal,
    });
    const contentType = resp.headers.get("content-type");

    const text = await resp.text().catch(() => "");
    const isJson = (contentType || "").includes("application/json");

    const data = isJson ? JSON.parse(text || "null") : null;
    const items = isJson ? extractItems(data) : [];
    const total = isJson ? getTotal(data) : null;

    return {
      label: "",
      url,
      status: resp.status,
      ok: resp.ok,
      contentType,
      itemsCount: Array.isArray(items) ? items.length : null,
      total,
      sample: isJson ? items?.[0] ?? data : text.slice(0, 600),
      error: resp.ok ? null : text.slice(0, 600),
    };
  } catch (e: any) {
    return {
      label: "",
      url,
      status: null,
      ok: false,
      contentType: null,
      itemsCount: null,
      total: null,
      sample: null,
      error: e?.message || String(e),
    };
  }
}

export function DjenAdvogadoDiagnosticoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loadingMonitoramentos, setLoadingMonitoramentos] = useState(false);
  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoAdvogado[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const selected = useMemo(
    () => monitoramentos.find((m) => m.id === selectedId) ?? null,
    [monitoramentos, selectedId]
  );

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AttemptResult[]>([]);

  const loadMonitoramentos = async () => {
    setLoadingMonitoramentos(true);
    try {
      const { data, error } = await supabase
        .from("monitoramentos_djen")
        .select("id,tipo,termo_busca,oab,uf,tribunais")
        .eq("ativo", true)
        .eq("tipo", "advogado")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const list = (data || []) as unknown as MonitoramentoAdvogado[];
      setMonitoramentos(list);
      setSelectedId((prev) => prev || list?.[0]?.id || "");
    } catch (e: any) {
      setMonitoramentos([]);
      setSelectedId("");
      setResults([
        {
          label: "Erro ao carregar monitoramentos",
          url: "",
          status: null,
          ok: false,
          contentType: null,
          itemsCount: null,
          total: null,
          sample: null,
          error: e?.message || String(e),
        },
      ]);
    } finally {
      setLoadingMonitoramentos(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    // Carregar só ao abrir para não impactar performance
    loadMonitoramentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleRun = async () => {
    if (!selected?.oab || !selected?.uf) {
      setResults([
        {
          label: "Monitoramento inválido",
          url: "",
          status: null,
          ok: false,
          contentType: null,
          itemsCount: null,
          total: null,
          sample: selected,
          error: "OAB/UF ausentes no monitoramento selecionado.",
        },
      ]);
      return;
    }

    setRunning(true);
    setResults([]);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25_000);

    try {
      // Range idêntico ao do monitoramento: últimos 3 dias em BRT
      const now = new Date();
      const todayBrasilia = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const startBrasilia = new Date(todayBrasilia);
      startBrasilia.setDate(startBrasilia.getDate() - 2);

      const dataFim = todayBrasilia.toISOString().split("T")[0];
      const dataInicio = startBrasilia.toISOString().split("T")[0];

      const oab = String(selected.oab).replace(/\D/g, "").trim();
      const uf = String(selected.uf).trim().toUpperCase();

      const tribunais = expandirTribunais(selected.tribunais);
      const tribunal = tribunais[0];

      const baseInput: DiagnosticRunInput = {
        oab,
        uf,
        tribunal,
        dataInicio,
        dataFim,
        pageSize: 10,
      };

      const attempts: AttemptResult[] = [];

      for (const includeTexto of [true, false]) {
        const modeLabel = includeTexto ? "Modo atual (com texto)" : "Modo alternativo (sem texto)";
        const qp = buildQueryParams(baseInput, { includeTexto });

        for (const endpoint of ENDPOINTS) {
          const url = `${endpoint}?${qp.toString()}`;
          const r = await tryFetch(url, controller.signal);
          attempts.push({ ...r, label: `${modeLabel} • ${endpoint.split("/").pop()}` });
        }
      }

      setResults(attempts);
    } finally {
      window.clearTimeout(timeoutId);
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Diagnóstico: DJEN por Advogado (OAB)</DialogTitle>
          <DialogDescription>
            Executa 1 consulta real no PJE Comunica e mostra URL/HTTP/contagem (sem rodar o loop completo).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Monitoramento (tipo advogado)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMonitoramentos}
                disabled={loadingMonitoramentos}
              >
                {loadingMonitoramentos ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loadingMonitoramentos || monitoramentos.length === 0}
            >
              {monitoramentos.length === 0 ? (
                <option value="">Nenhum monitoramento advogado ativo</option>
              ) : (
                monitoramentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.termo_busca} • OAB {m.oab ?? "-"}/{m.uf ?? "-"}
                  </option>
                ))
              )}
            </select>
            {selected && (
              <div className="text-xs text-muted-foreground">
                Tribunais: {(expandirTribunais(selected.tribunais).slice(0, 8).join(", ") || "(sem filtro)")}
                {expandirTribunais(selected.tribunais).length > 8 ? "…" : ""}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Resultado</Label>
            <div className="max-h-[320px] overflow-auto rounded-md border bg-muted/20 p-3">
              {results.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Clique em <strong>Executar diagnóstico</strong> para gerar as requisições.
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(results, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            onClick={handleRun}
            disabled={running || !selectedId}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              "Executar diagnóstico"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
