import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, Download, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { useKurierCredenciais } from "@/hooks/useKurierCredenciais";
import * as XLSX from "xlsx";

type Origem = "so_kurier" | "so_djen" | "ambos";

type Linha = {
  origem: Origem;
  login: string;
  id: string;
  id_djen: string | null;
  processo_numero: string | null;
  tribunal: string | null;
  orgao: string | null;
  tipo_comunicacao: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  coordenacao: string | null;
};

type ResumoLogin = {
  login: string;
  total_kurier: number;
  total_djen: number;
  ambos: number;
  so_kurier: number;
  so_djen: number;
  coordenacoes: string[];
};

type TribunalRow = { tribunal: string; ambos: number; so_kurier: number; so_djen: number };

type Comparacao = {
  resumo: ResumoLogin[];
  tribunais: TribunalRow[];
  linhas: Linha[];
  limite: number;
};

function todayBRT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

export default function ValidaKurier() {
  const today = todayBRT();
  const [dataIni, setDataIni] = useState<string>(today);
  const [dataFim, setDataFim] = useState<string>(today);
  const [logins, setLogins] = useState<string[]>([]);
  const [run, setRun] = useState(0);

  const { data: credenciais } = useKurierCredenciais();
  const loginsAtivos = useMemo(
    () => (credenciais ?? []).filter((c: any) => c.ativo).map((c: any) => c.login as string),
    [credenciais],
  );

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["valida-kurier-por-login", logins.join(","), dataIni, dataFim, run],
    enabled: run > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("comparar_kurier_djen_por_login", {
        p_logins: logins.length > 0 ? logins : null,
        p_ini: dataIni,
        p_fim: dataFim,
        p_limite: 5000,
      });
      if (error) throw error;
      const r = (data ?? {}) as Comparacao;
      return {
        resumo: r.resumo ?? [],
        tribunais: r.tribunais ?? [],
        linhas: r.linhas ?? [],
        limite: r.limite ?? 5000,
      } as Comparacao;
    },
  });

  const totais = useMemo(() => {
    if (!data) return null;
    const t = data.resumo.reduce(
      (acc, r) => ({
        totalKurier: acc.totalKurier + Number(r.total_kurier || 0),
        totalDjen: acc.totalDjen + Number(r.total_djen || 0),
        ambos: acc.ambos + Number(r.ambos || 0),
        soKurier: acc.soKurier + Number(r.so_kurier || 0),
        soDjen: acc.soDjen + Number(r.so_djen || 0),
      }),
      { totalKurier: 0, totalDjen: 0, ambos: 0, soKurier: 0, soDjen: 0 },
    );
    const cobertura = t.totalKurier > 0 ? (t.ambos / t.totalKurier) * 100 : 0;
    return { ...t, cobertura };
  }, [data]);

  const linhasPor = (origem: Origem) => (data?.linhas ?? []).filter((l) => l.origem === origem);

  const soKurier = useMemo(() => linhasPor("so_kurier"), [data]);
  const soDjen = useMemo(() => linhasPor("so_djen"), [data]);
  const ambos = useMemo(() => linhasPor("ambos"), [data]);

  const rotuloLogins = logins.length === 0 ? "Todos os logins ativos" : logins.length === 1 ? logins[0] : `${logins.length} logins`;

  function toggleLogin(login: string) {
    setLogins((prev) => (prev.includes(login) ? prev.filter((l) => l !== login) : [...prev, login]));
  }

  function rowsParaExport(list: Linha[], origem: string) {
    return list.map((p) => ({
      Origem: origem,
      Login: p.login ?? "",
      Coordenação: p.coordenacao ?? "",
      Processo: p.processo_numero ?? "",
      Tribunal: p.tribunal ?? "",
      Órgão: p.orgao ?? "",
      "Tipo Comunicação": p.tipo_comunicacao ?? "",
      "Data Disponibilização": (p.data_disponibilizacao ?? "").slice(0, 10),
      "Data Publicação": (p.data_publicacao ?? "").slice(0, 10),
      "ID DJEN": p.id_djen ?? "",
    }));
  }

  function exportCSV() {
    if (!data) return;
    const all = [
      ...rowsParaExport(soKurier, "Só Kurier"),
      ...rowsParaExport(soDjen, "Só DJEN"),
      ...rowsParaExport(ambos, "Em ambos"),
    ];
    const ws = XLSX.utils.json_to_sheet(all);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `valida-kurier_${dataIni}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXLSX() {
    if (!data || !totais) return;
    const wb = XLSX.utils.book_new();
    const resumoRows = data.resumo.map((r) => ({
      Login: r.login,
      Coordenações: (r.coordenacoes ?? []).join(" | "),
      "Total Kurier": Number(r.total_kurier || 0),
      "Total DJEN": Number(r.total_djen || 0),
      "Em ambos": Number(r.ambos || 0),
      "Só Kurier": Number(r.so_kurier || 0),
      "Só DJEN": Number(r.so_djen || 0),
      Cobertura: `${(Number(r.total_kurier || 0) > 0 ? (Number(r.ambos || 0) / Number(r.total_kurier)) * 100 : 0).toFixed(1)}%`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), "Resumo por login");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.tribunais.map((t) => ({
          Tribunal: t.tribunal,
          "Em ambos": Number(t.ambos || 0),
          "Só Kurier": Number(t.so_kurier || 0),
          "Só DJEN": Number(t.so_djen || 0),
        })),
      ),
      "Por Tribunal",
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsParaExport(soKurier, "Só Kurier")), "Só Kurier");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsParaExport(soDjen, "Só DJEN")), "Só DJEN");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsParaExport(ambos, "Em ambos")), "Em ambos");
    XLSX.writeFile(wb, `valida-kurier_${dataIni}_a_${dataFim}.xlsx`);
  }

  function executar() {
    if (dataIni > dataFim) {
      toast.error("A data inicial não pode ser maior que a final");
      return;
    }
    setRun((n) => n + 1);
    setTimeout(() => refetch(), 0);
  }

  return (
    <MainLayout
      title="Valida Kurier"
      subtitle="Mostra o que o Kurier encontrou e o DJEN Termos Servidor não encontrou, usando as coordenações já vinculadas a cada login"
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Login do Kurier</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{rotuloLogins}</span>
                    <ChevronDown className="w-4 h-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    <button
                      type="button"
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent"
                      onClick={() => setLogins([])}
                    >
                      Todos os logins ativos
                    </button>
                    {loginsAtivos.map((login) => (
                      <label key={login} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                        <Checkbox checked={logins.includes(login)} onCheckedChange={() => toggleLogin(login)} />
                        <span className="text-sm">{login}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Data inicial</Label>
              <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data final</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={executar} disabled={isFetching} className="w-full">
                {isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Comparar
              </Button>
            </div>
            <div className="md:col-span-4 flex items-center gap-2">
              <Button variant="outline" onClick={exportCSV} disabled={!data}>
                <Download className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" onClick={exportXLSX} disabled={!data}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {totais && (
          <Card>
            <CardHeader><CardTitle>Resumo executivo</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Kpi label="Total Kurier" value={totais.totalKurier} />
                <Kpi label="Total DJEN Servidor" value={totais.totalDjen} />
                <Kpi label="Em ambos" value={totais.ambos} tone="success" />
                <Kpi label="Só Kurier (o DJEN não achou)" value={totais.soKurier} tone="info" />
                <Kpi label="Só DJEN" value={totais.soDjen} tone="warn" />
                <Kpi label="Cobertura do DJEN sobre o Kurier" value={`${totais.cobertura.toFixed(1)}%`} />
              </div>

              {totais.totalKurier === 0 && (
                <div className="mt-3 text-sm text-amber-600">
                  Nenhuma publicação do Kurier no período selecionado — verifique se a captura do Kurier rodou nesses dias.
                </div>
              )}
              {totais.totalDjen === 0 && (
                <div className="mt-1 text-sm text-amber-600">
                  Nenhuma publicação do DJEN Termos Servidor no período — confira se os logins escolhidos têm coordenações vinculadas.
                </div>
              )}

              {data && data.resumo.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Login</TableHead>
                        <TableHead>Coordenações comparadas</TableHead>
                        <TableHead className="text-right">Kurier</TableHead>
                        <TableHead className="text-right">DJEN</TableHead>
                        <TableHead className="text-right">Em ambos</TableHead>
                        <TableHead className="text-right">Só Kurier</TableHead>
                        <TableHead className="text-right">Só DJEN</TableHead>
                        <TableHead className="text-right">Cobertura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.resumo.map((r) => {
                        const tk = Number(r.total_kurier || 0);
                        const cob = tk > 0 ? (Number(r.ambos || 0) / tk) * 100 : 0;
                        return (
                          <TableRow key={r.login}>
                            <TableCell className="font-medium">{r.login}</TableCell>
                            <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                              {(r.coordenacoes ?? []).join(" • ") || "—"}
                            </TableCell>
                            <TableCell className="text-right">{tk}</TableCell>
                            <TableCell className="text-right">{Number(r.total_djen || 0)}</TableCell>
                            <TableCell className="text-right text-emerald-600">{Number(r.ambos || 0)}</TableCell>
                            <TableCell className="text-right font-semibold text-sky-600">{Number(r.so_kurier || 0)}</TableCell>
                            <TableCell className="text-right text-amber-600">{Number(r.so_djen || 0)}</TableCell>
                            <TableCell className="text-right">{cob.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {data && data.tribunais.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tribunal</TableHead>
                        <TableHead className="text-right">Em ambos</TableHead>
                        <TableHead className="text-right">Só Kurier</TableHead>
                        <TableHead className="text-right">Só DJEN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.tribunais.map((t) => (
                        <TableRow key={t.tribunal}>
                          <TableCell>{t.tribunal}</TableCell>
                          <TableCell className="text-right">{Number(t.ambos || 0)}</TableCell>
                          <TableCell className="text-right">{Number(t.so_kurier || 0)}</TableCell>
                          <TableCell className="text-right">{Number(t.so_djen || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data && (
          <Card>
            <CardHeader><CardTitle>Detalhamento</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="soKurier">
                <TabsList>
                  <TabsTrigger value="soKurier">Só Kurier ({soKurier.length})</TabsTrigger>
                  <TabsTrigger value="soDjen">Só DJEN ({soDjen.length})</TabsTrigger>
                  <TabsTrigger value="ambos">Em ambos ({ambos.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="soKurier"><PubTable rows={soKurier} /></TabsContent>
                <TabsContent value="soDjen"><PubTable rows={soDjen} /></TabsContent>
                <TabsContent value="ambos"><PubTable rows={ambos} /></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warn" | "info" }) {
  const toneCls =
    tone === "success" ? "text-emerald-500"
    : tone === "warn" ? "text-amber-500"
    : tone === "info" ? "text-sky-500"
    : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function PubTable({ rows }: { rows: Linha[] }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground py-6 text-center">Nenhum registro.</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Processo</TableHead>
            <TableHead>Tribunal</TableHead>
            <TableHead>Órgão</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data Disp.</TableHead>
            <TableHead>ID DJEN</TableHead>
            <TableHead>Login / Coordenação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 500).map((p) => (
            <TableRow key={`${p.origem}-${p.id}`}>
              <TableCell className="font-mono text-xs">{p.processo_numero ?? "—"}</TableCell>
              <TableCell>{p.tribunal ?? "—"}</TableCell>
              <TableCell className="max-w-[260px] truncate" title={p.orgao ?? ""}>{p.orgao ?? "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={p.tipo_comunicacao ?? ""}>{p.tipo_comunicacao ?? "—"}</TableCell>
              <TableCell>{(p.data_disponibilizacao ?? "").slice(0, 10) || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{p.id_djen ?? "—"}</TableCell>
              <TableCell className="space-x-1">
                <Badge variant="outline">{p.login}</Badge>
                {p.coordenacao && <Badge variant="secondary" className="max-w-[220px] truncate">{p.coordenacao}</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 500 && (
        <div className="text-xs text-muted-foreground mt-2">Mostrando 500 de {rows.length}. Exporte para ver tudo.</div>
      )}
    </div>
  );
}
