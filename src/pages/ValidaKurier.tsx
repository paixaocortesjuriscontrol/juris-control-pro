import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Search } from "lucide-react";
import * as XLSX from "xlsx";

type Pub = {
  id: string;
  id_djen: string | null;
  processo_numero: string | null;
  tribunal: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  tipo_comunicacao: string | null;
  orgao: string | null;
  kurier_login: string | null;
  fonte: string | null;
};

const KURIER_COORD_DEFAULT_ID = "a7843a1f-a90e-4a2f-8f6b-12160ce3e86d";

function todayBRT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D+/g, "");
}

function dateRef(p: Pub): string {
  return (p.data_disponibilizacao || p.data_publicacao || "").slice(0, 10);
}

function keysFor(p: Pub): { primary: string; fallback: string } {
  const idKey = p.id_djen ? `djen:${p.id_djen}` : "";
  const fb = `${onlyDigits(p.processo_numero)}|${dateRef(p)}`;
  return { primary: idKey || fb, fallback: fb };
}

async function fetchAll(coordId: string, ini: string, fim: string): Promise<Pub[]> {
  const PAGE = 1000;
  let from = 0;
  const out: Pub[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("publicacoes_djen")
      .select("id, id_djen, processo_numero, tribunal, data_disponibilizacao, data_publicacao, tipo_comunicacao, orgao, kurier_login, fonte")
      .eq("coordenacao_id", coordId)
      .gte("data_disponibilizacao", ini)
      .lte("data_disponibilizacao", fim)
      .order("data_disponibilizacao", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Pub[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

type Comparison = {
  soDjen: Pub[];
  soKurier: Pub[];
  ambos: { djen: Pub; kurier: Pub }[];
};

function comparar(djen: Pub[], kurier: Pub[]): Comparison {
  // Index Kurier by primary (id_djen if present) and by fallback (processo+data)
  const kPrimary = new Map<string, Pub>();
  const kFallback = new Map<string, Pub>();
  for (const p of kurier) {
    const k = keysFor(p);
    if (k.primary) kPrimary.set(k.primary, p);
    if (k.fallback && !kFallback.has(k.fallback)) kFallback.set(k.fallback, p);
  }
  const matchedKurier = new Set<string>();
  const ambos: { djen: Pub; kurier: Pub }[] = [];
  const soDjen: Pub[] = [];
  for (const d of djen) {
    const k = keysFor(d);
    let m = (k.primary && kPrimary.get(k.primary)) || kFallback.get(k.fallback);
    if (m) {
      ambos.push({ djen: d, kurier: m });
      matchedKurier.add(m.id);
    } else {
      soDjen.push(d);
    }
  }
  const soKurier = kurier.filter((p) => !matchedKurier.has(p.id));
  return { soDjen, soKurier, ambos };
}

export default function ValidaKurier() {
  const [coordDjenId, setCoordDjenId] = useState<string>("");
  const [coordKurierId, setCoordKurierId] = useState<string>(KURIER_COORD_DEFAULT_ID);
  const today = todayBRT();
  const [dataIni, setDataIni] = useState<string>(today);
  const [dataFim, setDataFim] = useState<string>(today);
  const [run, setRun] = useState(0);

  const { data: coords } = useQuery({
    queryKey: ["valida-kurier-coords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const enabled = run > 0 && !!coordDjenId && !!coordKurierId;
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["valida-kurier", coordDjenId, coordKurierId, dataIni, dataFim, run],
    enabled,
    queryFn: async () => {
      const [djen, kurier] = await Promise.all([
        fetchAll(coordDjenId, dataIni, dataFim),
        fetchAll(coordKurierId, dataIni, dataFim),
      ]);
      return { djen, kurier, cmp: comparar(djen, kurier) };
    },
  });

  const resumo = useMemo(() => {
    if (!data) return null;
    const totalDjen = data.djen.length;
    const totalKurier = data.kurier.length;
    const ambos = data.cmp.ambos.length;
    const soDjen = data.cmp.soDjen.length;
    const soKurier = data.cmp.soKurier.length;
    const coberturaKurier = totalDjen > 0 ? (ambos / totalDjen) * 100 : 0;
    const coberturaDjen = totalKurier > 0 ? (ambos / totalKurier) * 100 : 0;
    // Breakdown por tribunal
    const byTrib = new Map<string, { soDjen: number; soKurier: number; ambos: number }>();
    const bump = (t: string | null | undefined, k: "soDjen" | "soKurier" | "ambos") => {
      const key = t || "—";
      const r = byTrib.get(key) ?? { soDjen: 0, soKurier: 0, ambos: 0 };
      r[k] += 1;
      byTrib.set(key, r);
    };
    data.cmp.soDjen.forEach((p) => bump(p.tribunal, "soDjen"));
    data.cmp.soKurier.forEach((p) => bump(p.tribunal, "soKurier"));
    data.cmp.ambos.forEach(({ djen }) => bump(djen.tribunal, "ambos"));
    const tribunais = Array.from(byTrib.entries())
      .map(([tribunal, v]) => ({ tribunal, ...v, total: v.soDjen + v.soKurier + v.ambos }))
      .sort((a, b) => b.total - a.total);
    return { totalDjen, totalKurier, ambos, soDjen, soKurier, coberturaKurier, coberturaDjen, tribunais };
  }, [data]);

  const nomeCoord = (id: string) => coords?.find((c: any) => c.id === id)?.nome ?? id;

  function rowsParaExport(list: Pub[], origem: string) {
    return list.map((p) => ({
      Origem: origem,
      Processo: p.processo_numero ?? "",
      Tribunal: p.tribunal ?? "",
      Órgão: p.orgao ?? "",
      "Tipo Comunicação": p.tipo_comunicacao ?? "",
      "Data Disponibilização": (p.data_disponibilizacao ?? "").slice(0, 10),
      "Data Publicação": (p.data_publicacao ?? "").slice(0, 10),
      "ID DJEN": p.id_djen ?? "",
      "Kurier Login": p.kurier_login ?? "",
      Fonte: p.fonte ?? "",
    }));
  }

  function exportCSV() {
    if (!data) return;
    const all = [
      ...rowsParaExport(data.cmp.soDjen, "Só DJEN"),
      ...rowsParaExport(data.cmp.soKurier, "Só Kurier"),
      ...data.cmp.ambos.flatMap(({ djen, kurier }) =>
        rowsParaExport([djen], "Em ambos (DJEN)").concat(rowsParaExport([kurier], "Em ambos (Kurier)")),
      ),
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
    if (!data || !resumo) return;
    const wb = XLSX.utils.book_new();
    const resumoRows = [
      { Métrica: "Coordenação DJEN", Valor: nomeCoord(coordDjenId) },
      { Métrica: "Coordenação Kurier", Valor: nomeCoord(coordKurierId) },
      { Métrica: "Período", Valor: `${dataIni} → ${dataFim}` },
      { Métrica: "Total DJEN", Valor: resumo.totalDjen },
      { Métrica: "Total Kurier", Valor: resumo.totalKurier },
      { Métrica: "Em ambos", Valor: resumo.ambos },
      { Métrica: "Só DJEN", Valor: resumo.soDjen },
      { Métrica: "Só Kurier", Valor: resumo.soKurier },
      { Métrica: "Cobertura Kurier vs DJEN", Valor: `${resumo.coberturaKurier.toFixed(1)}%` },
      { Métrica: "Cobertura DJEN vs Kurier", Valor: `${resumo.coberturaDjen.toFixed(1)}%` },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo.tribunais), "Por Tribunal");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsParaExport(data.cmp.soDjen, "Só DJEN")), "Só DJEN");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsParaExport(data.cmp.soKurier, "Só Kurier")), "Só Kurier");
    const ambosRows = data.cmp.ambos.map(({ djen, kurier }) => ({
      Processo: djen.processo_numero ?? kurier.processo_numero ?? "",
      Tribunal: djen.tribunal ?? kurier.tribunal ?? "",
      "Data Disp.": (djen.data_disponibilizacao ?? kurier.data_disponibilizacao ?? "").slice(0, 10),
      "ID DJEN": djen.id_djen ?? kurier.id_djen ?? "",
      "Tipo (DJEN)": djen.tipo_comunicacao ?? "",
      "Tipo (Kurier)": kurier.tipo_comunicacao ?? "",
      "Órgão (DJEN)": djen.orgao ?? "",
      "Órgão (Kurier)": kurier.orgao ?? "",
      "Kurier Login": kurier.kurier_login ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ambosRows), "Em ambos");
    XLSX.writeFile(wb, `valida-kurier_${dataIni}_a_${dataFim}.xlsx`);
  }

  function executar() {
    if (!coordDjenId || !coordKurierId) {
      toast.error("Selecione as duas coordenações");
      return;
    }
    if (coordDjenId === coordKurierId) {
      toast.error("Escolha coordenações diferentes");
      return;
    }
    setRun((n) => n + 1);
    setTimeout(() => refetch(), 0);
  }

  return (
    <MainLayout
      title="Valida Kurier"
      subtitle="Compara publicações encontradas pelo Kurier com as encontradas no DJEN para a coordenação escolhida"
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Coordenação DJEN</Label>
              <Select value={coordDjenId} onValueChange={setCoordDjenId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(coords ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Coordenação Kurier</Label>
              <Select value={coordKurierId} onValueChange={setCoordKurierId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(coords ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data inicial</Label>
              <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data final</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="md:col-span-4 flex items-center gap-2">
              <Button onClick={executar} disabled={isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Comparar
              </Button>
              <Button variant="outline" onClick={exportCSV} disabled={!data}>
                <Download className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" onClick={exportXLSX} disabled={!data}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {resumo && (
          <Card>
            <CardHeader><CardTitle>Resumo executivo</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Kpi label="Total DJEN" value={resumo.totalDjen} />
                <Kpi label="Total Kurier" value={resumo.totalKurier} />
                <Kpi label="Em ambos" value={resumo.ambos} tone="success" />
                <Kpi label="Só DJEN" value={resumo.soDjen} tone="warn" />
                <Kpi label="Só Kurier" value={resumo.soKurier} tone="info" />
                <Kpi label="Cobertura Kurier vs DJEN" value={`${resumo.coberturaKurier.toFixed(1)}%`} />
                <Kpi label="Cobertura DJEN vs Kurier" value={`${resumo.coberturaDjen.toFixed(1)}%`} />
              </div>
              {resumo.tribunais.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tribunal</TableHead>
                        <TableHead className="text-right">Em ambos</TableHead>
                        <TableHead className="text-right">Só DJEN</TableHead>
                        <TableHead className="text-right">Só Kurier</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumo.tribunais.map((t) => (
                        <TableRow key={t.tribunal}>
                          <TableCell>{t.tribunal}</TableCell>
                          <TableCell className="text-right">{t.ambos}</TableCell>
                          <TableCell className="text-right">{t.soDjen}</TableCell>
                          <TableCell className="text-right">{t.soKurier}</TableCell>
                          <TableCell className="text-right font-medium">{t.total}</TableCell>
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
              <Tabs defaultValue="soDjen">
                <TabsList>
                  <TabsTrigger value="soDjen">Só DJEN ({data.cmp.soDjen.length})</TabsTrigger>
                  <TabsTrigger value="soKurier">Só Kurier ({data.cmp.soKurier.length})</TabsTrigger>
                  <TabsTrigger value="ambos">Em ambos ({data.cmp.ambos.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="soDjen"><PubTable rows={data.cmp.soDjen} /></TabsContent>
                <TabsContent value="soKurier"><PubTable rows={data.cmp.soKurier} /></TabsContent>
                <TabsContent value="ambos">
                  <PubTable rows={data.cmp.ambos.map((x) => x.djen)} extraRight={(_, i) => (
                    <Badge variant="outline">{data.cmp.ambos[i].kurier.kurier_login ?? "kurier"}</Badge>
                  )} />
                </TabsContent>
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

function PubTable({ rows, extraRight }: { rows: Pub[]; extraRight?: (p: Pub, i: number) => React.ReactNode }) {
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
            <TableHead>Origem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 500).map((p, i) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.processo_numero ?? "—"}</TableCell>
              <TableCell>{p.tribunal ?? "—"}</TableCell>
              <TableCell className="max-w-[260px] truncate" title={p.orgao ?? ""}>{p.orgao ?? "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={p.tipo_comunicacao ?? ""}>{p.tipo_comunicacao ?? "—"}</TableCell>
              <TableCell>{(p.data_disponibilizacao ?? "").slice(0, 10) || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{p.id_djen ?? "—"}</TableCell>
              <TableCell className="space-x-1">
                <Badge variant="secondary">{p.fonte ?? "—"}</Badge>
                {p.kurier_login && <Badge variant="outline">{p.kurier_login}</Badge>}
                {extraRight?.(p, i)}
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