import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, ArrowRightLeft, FileSpreadsheet, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface Coordenacao { id: string; nome: string }
interface PubRow {
  id: string;
  hash_conteudo: string;
  processo_numero: string | null;
  tribunal: string | null;
  data_disponibilizacao: string | null;
  conteudo: string | null;
  created_at: string;
}
interface DiffResult {
  somenteA: PubRow[];
  somenteB: PubRow[];
  comuns: number;
  labelA: string;
  labelB: string;
  totalA: number;
  totalB: number;
  unicasA: number;
  unicasB: number;
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }); } catch { return iso; }
}

/**
 * Busca TODAS as publicações de uma coordenação numa data de disponibilização,
 * independente de qual execução as capturou.
 */
async function fetchPubsByCoordData(params: {
  coordenacaoId: string;
  dataDisp: string; // yyyy-mm-dd
}): Promise<PubRow[]> {
  const { coordenacaoId, dataDisp } = params;
  const dispStart = `${dataDisp}T00:00:00.000Z`;
  const dispEnd = `${dataDisp}T23:59:59.999Z`;

  const all: PubRow[] = [];
  let lastId: string | null = null;
  // cursor pagination by id to bypass 1000-row limit
  for (let page = 0; page < 500; page++) {
    let q = supabase
      .from("publicacoes_djen")
      .select("id,hash_conteudo,processo_numero,tribunal,data_disponibilizacao,conteudo,created_at")
      .eq("coordenacao_id", coordenacaoId)
      .gte("data_disponibilizacao", dispStart)
      .lte("data_disponibilizacao", dispEnd)
      .order("id", { ascending: true })
      .limit(1000);
    if (lastId) q = q.gt("id", lastId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as PubRow[]));
    if (data.length < 1000) break;
    lastId = data[data.length - 1].id;
  }
  return all;
}

function exportarExcel(diff: DiffResult, dataDisp: string) {
  const wb = XLSX.utils.book_new();
  const toRows = (rows: PubRow[]) => rows.map((r) => ({
    processo: r.processo_numero || "",
    tribunal: r.tribunal || "",
    data_disponibilizacao: r.data_disponibilizacao ? format(new Date(r.data_disponibilizacao), "dd/MM/yyyy") : "",
    capturado_em: fmtDateTime(r.created_at),
    hash_conteudo: r.hash_conteudo,
    conteudo: (r.conteudo || "").slice(0, 2000),
  }));
  const wsA = XLSX.utils.json_to_sheet(toRows(diff.somenteA));
  const wsB = XLSX.utils.json_to_sheet(toRows(diff.somenteB));
  XLSX.utils.book_append_sheet(wb, wsA, `Somente_${diff.labelA}`.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, wsB, `Somente_${diff.labelB}`.slice(0, 31));
  XLSX.writeFile(wb, `errata_djen_${dataDisp}.xlsx`);
}

function exportarPdf(diff: DiffResult, dataDisp: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const mL = 14;
  let y = 0;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, w, 24, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Relatório • Errata DJEN", w / 2, 11, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data de disponibilização: ${format(new Date(`${dataDisp}T12:00:00`), "dd/MM/yyyy")}`, w / 2, 18, { align: "center" });
  doc.setTextColor(0);
  y = 30;

  const cards = [
    { label: `Somente em ${diff.labelA}`, value: diff.somenteA.length, color: [217, 119, 6] as [number, number, number] },
    { label: "Em Comum", value: diff.comuns, color: [22, 163, 74] as [number, number, number] },
    { label: `Somente em ${diff.labelB}`, value: diff.somenteB.length, color: [234, 88, 12] as [number, number, number] },
  ];
  const cardW = (w - mL * 2 - 6) / 3;
  cards.forEach((c, i) => {
    const x = mL + i * (cardW + 3);
    doc.setDrawColor(220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "FD");
    doc.setTextColor(...c.color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(String(c.value), x + cardW / 2, y + 11, { align: "center" });
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(c.label, x + cardW / 2, y + 18, { align: "center" });
  });
  doc.setTextColor(0);
  y += 28;

  const section = (title: string, rows: PubRow[]) => {
    if (y > h - 30) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text(`${title} (${rows.length})`, mL, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);
    if (rows.length === 0) {
      doc.setTextColor(120);
      doc.text("Nenhum processo exclusivo.", mL, y);
      doc.setTextColor(0);
      y += 5;
      return;
    }
    const cols = 3;
    const colW = (w - mL * 2) / cols;
    rows.forEach((r, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (col === 0 && y + 5 > h - 15) { doc.addPage(); y = 20; }
      const x = mL + col * colW;
      doc.text(r.processo_numero || "—", x, y + row * 4 + 4);
      if (col === cols - 1) y += 4;
    });
    y += 6;
  };

  section(`Somente em ${diff.labelA}`, diff.somenteA);
  section(`Somente em ${diff.labelB}`, diff.somenteB);

  doc.save(`errata_djen_${dataDisp}.pdf`);
}

export default function ErrataDjen() {
  const [coordenacoes, setCoordenacoes] = useState<Coordenacao[]>([]);
  const [coordA, setCoordA] = useState<string>("");
  const [coordB, setCoordB] = useState<string>("");
  const [dataA, setDataA] = useState<Date>(new Date());
  const [dataB, setDataB] = useState<Date>(new Date());
  const [comparando, setComparando] = useState(false);
  const [diff, setDiff] = useState<DiffResult | null>(null);

  const dataAStr = useMemo(() => format(dataA, "yyyy-MM-dd"), [dataA]);
  const dataBStr = useMemo(() => format(dataB, "yyyy-MM-dd"), [dataB]);

  // Load coordenacoes
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id,nome")
        .order("nome");
      if (error) { toast.error("Falha ao carregar coordenações"); return; }
      setCoordenacoes((data || []) as Coordenacao[]);
    })();
  }, []);

  const nomeCoord = (id: string) => coordenacoes.find((c) => c.id === id)?.nome || "—";

  const handleComparar = async () => {
    if (!coordA || !coordB) { toast.error("Selecione as duas coordenações"); return; }
    if (coordA === coordB && dataAStr === dataBStr) {
      toast.error("Escolha coordenações ou datas diferentes para o lado A e B");
      return;
    }

    setComparando(true);
    setDiff(null);
    try {
      const [pubsA, pubsB] = await Promise.all([
        fetchPubsByCoordData({ coordenacaoId: coordA, dataDisp: dataAStr }),
        fetchPubsByCoordData({ coordenacaoId: coordB, dataDisp: dataBStr }),
      ]);
      const hashesB = new Set(pubsB.map((p) => p.hash_conteudo));
      const hashesA = new Set(pubsA.map((p) => p.hash_conteudo));
      const somenteA: PubRow[] = [];
      const seenA = new Set<string>();
      for (const p of pubsA) {
        if (!hashesB.has(p.hash_conteudo) && !seenA.has(p.hash_conteudo)) {
          seenA.add(p.hash_conteudo);
          somenteA.push(p);
        }
      }
      const somenteB: PubRow[] = [];
      const seenB = new Set<string>();
      for (const p of pubsB) {
        if (!hashesA.has(p.hash_conteudo) && !seenB.has(p.hash_conteudo)) {
          seenB.add(p.hash_conteudo);
          somenteB.push(p);
        }
      }
      const comuns = new Set<string>();
      hashesA.forEach((h) => { if (hashesB.has(h)) comuns.add(h); });

      const labelA = `${nomeCoord(coordA)} · ${format(dataA, "dd/MM/yyyy")}`;
      const labelB = `${nomeCoord(coordB)} · ${format(dataB, "dd/MM/yyyy")}`;

      setDiff({
        somenteA, somenteB, comuns: comuns.size, labelA, labelB,
        totalA: pubsA.length, totalB: pubsB.length,
        unicasA: hashesA.size, unicasB: hashesB.size,
      });
      toast.success(`Comparação concluída: ${somenteA.length} + ${somenteB.length} diferenças`);
    } catch (e: any) {
      toast.error("Erro ao comparar: " + (e?.message || e));
    } finally {
      setComparando(false);
    }
  };

  return (
    <MainLayout title="Errata DJEN">
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Errata DJEN</h1>
            <p className="text-sm text-muted-foreground">
              Compare publicações de uma coordenação/data com outra coordenação/data — independente de qual execução capturou.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração da comparação</CardTitle>
            <CardDescription>
              Selecione o modo, a data de disponibilização e as execuções que devem ser cruzadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Compara todas as publicações já capturadas (independente da execução) para cada Lado A e B.
              Você pode comparar duas coordenações no mesmo dia, a mesma coordenação em dias diferentes,
              ou qualquer combinação dos dois.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LADO A */}
              <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Lado A</div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Coordenação A</label>
                  <Select value={coordA} onValueChange={(v) => { setCoordA(v); setDiff(null); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {coordenacoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data de disponibilização A</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataA, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataA} onSelect={(d) => { if (d) { setDataA(d); setDiff(null); } }} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* LADO B */}
              <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Lado B</div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Coordenação B</label>
                  <Select value={coordB} onValueChange={(v) => { setCoordB(v); setDiff(null); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {coordenacoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data de disponibilização B</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataB, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataB} onSelect={(d) => { if (d) { setDataB(d); setDiff(null); } }} locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleComparar} disabled={comparando}>
                {comparando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                Comparar
              </Button>
              {diff && (
                <>
                  <Button variant="outline" onClick={() => exportarExcel(diff, dataAStr)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
                  </Button>
                  <Button variant="outline" onClick={() => exportarPdf(diff, dataAStr)}>
                    <FileText className="w-4 h-4 mr-2" /> Exportar PDF
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {diff && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Somente em {diff.labelA}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-amber-600">{diff.somenteA.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Em comum</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{diff.comuns}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                    <div>Total A: <strong>{diff.totalA}</strong> · Únicas A: <strong>{diff.unicasA}</strong></div>
                    <div>Total B: <strong>{diff.totalB}</strong> · Únicas B: <strong>{diff.unicasB}</strong></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Somente em {diff.labelB}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-orange-600">{diff.somenteB.length}</div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Somente em {diff.labelA} ({diff.somenteA.length})
                  </CardTitle>
                  <CardDescription>Publicações capturadas em A e ausentes em B (cruzamento por hash do conteúdo).</CardDescription>
                </CardHeader>
                <CardContent>
                  {diff.somenteA.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma publicação exclusiva.</p>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {diff.somenteA.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 whitespace-nowrap">
                            {p.processo_numero || "—"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{p.tribunal || ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" /> Somente em {diff.labelB} ({diff.somenteB.length})
                  </CardTitle>
                  <CardDescription>Publicações capturadas em B e ausentes em A.</CardDescription>
                </CardHeader>
                <CardContent>
                  {diff.somenteB.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma publicação exclusiva.</p>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {diff.somenteB.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 whitespace-nowrap">
                            {p.processo_numero || "—"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{p.tribunal || ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}