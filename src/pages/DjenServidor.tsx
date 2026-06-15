import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, Activity, FileSearch, GitCompare, PlayCircle, Loader2 } from "lucide-react";
import {
  useConfiguracoesServidor,
  useExecucoesServidor,
  useWorkersServidor,
  usePublicacoesServidor,
  useEnfileirarManual,
  useComparadorPublicacoes,
  useTickAge,
  type ConfigServidor,
} from "@/hooks/useDjenServidor";

const LABELS: Record<string, string> = {
  djen_paralela_servidor: "DJEN Termos Paralela",
  kurier_servidor: "DJEN Kurier",
  djet_pautas_servidor: "DJET Pautas DEJT",
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pendente: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    executando: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    concluido: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    erro: "bg-red-500/15 text-red-600 border-red-500/30",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
}

function ConfigCard({ cfg, onToggle, onRun, runningId }: {
  cfg: ConfigServidor;
  onToggle: (id: string, ativo: boolean) => void;
  onRun: (tipo: string) => void;
  runningId: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{LABELS[cfg.tipo] || cfg.tipo}</CardTitle>
          <Switch checked={cfg.ativo} onCheckedChange={(v) => onToggle(cfg.id, v)} />
        </div>
        <CardDescription className="text-xs">{cfg.frequencia} · {(cfg.horarios_execucao || []).join(", ") || "—"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="text-muted-foreground">Última execução: <span className="text-foreground">{fmtDate(cfg.ultima_execucao)}</span></div>
        <Button size="sm" variant="secondary" onClick={() => onRun(cfg.tipo)} disabled={runningId === cfg.tipo}>
          {runningId === cfg.tipo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
          Executar agora
        </Button>
      </CardContent>
    </Card>
  );
}

function VisaoGeral() {
  const { data: cfgs = [], toggle } = useConfiguracoesServidor();
  const { data: workers = [] } = useWorkersServidor();
  const enfileirar = useEnfileirarManual();
  const tick = useTickAge();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cfgs.map((cfg) => (
          <ConfigCard
            key={cfg.id}
            cfg={cfg}
            onToggle={(id, ativo) => toggle.mutate({ id, ativo })}
            onRun={(tipo) => enfileirar.mutate(tipo)}
            runningId={enfileirar.isPending ? enfileirar.variables ?? null : null}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" /> Workers da VPS
          </CardTitle>
          <CardDescription>Heartbeat dos slots ativos no daemon Hostinger</CardDescription>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum worker registrado ainda. Suba o daemon na VPS.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo atual</TableHead>
                  <TableHead>Heartbeat (s)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((w) => {
                  const ageS = Math.floor((tick - new Date(w.heartbeat_at).getTime()) / 1000);
                  const stale = ageS > 60;
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.worker_id}</TableCell>
                      <TableCell className="text-xs">{w.host || "—"}</TableCell>
                      <TableCell>{statusBadge(w.status)}</TableCell>
                      <TableCell className="text-xs">{w.current_tipo || "—"}</TableCell>
                      <TableCell className={stale ? "text-red-600 text-xs" : "text-xs"}>{ageS}s</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExecucoesPanel() {
  const { data: execs = [], isLoading } = useExecucoesServidor(100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Execuções ao vivo</CardTitle>
        <CardDescription>Realtime — últimas 100 execuções</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Agendado</TableHead>
                <TableHead>Iniciado</TableHead>
                <TableHead>Finalizado</TableHead>
                <TableHead>Tent.</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {execs.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{e.tipo}</TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell className="font-mono text-xs">{e.worker_id || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.agendado_para)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.iniciado_em)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.finalizado_em)}</TableCell>
                  <TableCell className="text-xs">{e.tentativas}</TableCell>
                  <TableCell className="text-xs max-w-md truncate">{e.erro || JSON.stringify(e.resultado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function todayYmd(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function PublicacoesPanel() {
  const [dataInicio, setDataInicio] = useState(todayYmd(-7));
  const [dataFim, setDataFim] = useState(todayYmd());
  const { data: pubs = [], isLoading } = usePublicacoesServidor({ dataInicio, dataFim, limit: 500 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileSearch className="h-4 w-4" /> Publicações encontradas (servidor)</CardTitle>
        <CardDescription>Tabela `publicacoes_djen_servidor` — origem = 'servidor'</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <Badge variant="outline">{pubs.length} resultados</Badge>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tribunal</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Data pub.</TableHead>
                <TableHead>Encontrada em</TableHead>
                <TableHead>Trecho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pubs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.tribunal || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{p.processo_numero || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.data_publicacao)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.created_at)}</TableCell>
                  <TableCell className="text-xs max-w-md truncate">{p.conteudo?.slice(0, 200) || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ComparadorPanel() {
  const [dataInicio, setDataInicio] = useState(todayYmd(-7));
  const [dataFim, setDataFim] = useState(todayYmd());
  const { data, isLoading } = useComparadorPublicacoes({ dataInicio, dataFim });

  const exportarCsv = (rows: Array<{ processo_numero?: string | null; tribunal?: string | null; dedup_data_ref?: string | null; hash_conteudo: string }>, nome: string) => {
    const header = "tribunal,processo,data,hash\n";
    const body = rows.map((r) => `${r.tribunal || ""},${r.processo_numero || ""},${r.dedup_data_ref || ""},${r.hash_conteudo}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><GitCompare className="h-4 w-4" /> Comparador Servidor × Browser</CardTitle>
        <CardDescription>Diff entre `publicacoes_djen_servidor` e `publicacoes_djen` no período</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Apenas Servidor ({data.soServidor.length})</CardTitle></CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" onClick={() => exportarCsv(data.soServidor, "so_servidor")}>Exportar CSV</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Apenas Browser ({data.soBrowser.length})</CardTitle></CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" onClick={() => exportarCsv(data.soBrowser, "so_browser")}>Exportar CSV</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Em ambos ({data.ambos.length})</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Total Servidor: {data.totalServidor}</p>
                <p className="text-xs text-muted-foreground">Total Browser: {data.totalBrowser}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DjenServidor() {
  const [tab, setTab] = useState("geral");
  return (
    <MainLayout
      title="DJEN Servidor"
      subtitle="Pipeline DJEN/Kurier/Pautas executado 24/7 na VPS, com tabela separada para comparação"
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral"><Server className="h-4 w-4 mr-1" />Visão geral</TabsTrigger>
          <TabsTrigger value="execucoes"><Activity className="h-4 w-4 mr-1" />Execuções</TabsTrigger>
          <TabsTrigger value="publicacoes"><FileSearch className="h-4 w-4 mr-1" />Publicações</TabsTrigger>
          <TabsTrigger value="comparador"><GitCompare className="h-4 w-4 mr-1" />Comparador</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><VisaoGeral /></TabsContent>
        <TabsContent value="execucoes"><ExecucoesPanel /></TabsContent>
        <TabsContent value="publicacoes"><PublicacoesPanel /></TabsContent>
        <TabsContent value="comparador"><ComparadorPanel /></TabsContent>
      </Tabs>
    </MainLayout>
  );
}