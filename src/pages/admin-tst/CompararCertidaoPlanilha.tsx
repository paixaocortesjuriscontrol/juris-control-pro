import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Loader2, FileDown, GitCompare } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoltarAdminTstButton } from "@/components/admin-tst/VoltarAdminTstButton";

const NUM_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
const DATE_RE = /\d{2}\/\d{2}\/\d{4}/;
const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const fmtCnj = (d: string) =>
  d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}` : d;

function normalizeNumberSpacing(raw: string): string {
  let prev = raw;
  for (let i = 0; i < 4; i++) {
    const next = prev.replace(/([\d.\-/:])\s+(?=[\d.\-/:])/g, "$1");
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

type ItemPdf = { processo: string; data: string };
type Resultado = {
  pdfTotal: number;
  planilhaTotal: number;
  somentePdf: ItemPdf[];
  emAmbos: ItemPdf[];
};

async function lerPdf(file: File): Promise<Map<string, ItemPdf>> {
  const pdfjsLib: any = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    text += c.items.map((it: any) => it.str).join(" ") + "\n";
  }
  text = normalizeNumberSpacing(text);
  const map = new Map<string, ItemPdf>();
  let m: RegExpExecArray | null;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(text)) !== null) {
    const d = onlyDigits(m[0]);
    if (map.has(d)) continue;
    const dm = text.slice(m.index + m[0].length, m.index + m[0].length + 240).match(DATE_RE);
    map.set(d, { processo: m[0], data: dm?.[0] ?? "" });
  }
  return map;
}

async function lerPlanilha(file: File): Promise<Set<string>> {
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const set = new Set<string>();
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" }) as any[][];
    for (const row of rows) {
      for (const cell of row) {
        const s = String(cell ?? "");
        const found = normalizeNumberSpacing(s).match(NUM_RE);
        if (found) found.forEach((f) => set.add(onlyDigits(f)));
        else {
          const d = onlyDigits(s);
          if (d.length === 20 && /^\s*'?[\d.\-\s]+$/.test(s)) set.add(d);
        }
      }
    }
  }
  return set;
}

export default function CompararCertidaoPlanilha() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const comparar = async () => {
    if (!pdf || !xlsx) return toast.error("Selecione o PDF e a planilha.");
    setLoading(true);
    setRes(null);
    try {
      const [mp, sp] = await Promise.all([lerPdf(pdf), lerPlanilha(xlsx)]);
      if (mp.size === 0) throw new Error("Nenhum número de processo encontrado no PDF.");
      const somentePdf: ItemPdf[] = [];
      const emAmbos: ItemPdf[] = [];
      for (const [d, it] of mp) (sp.has(d) ? emAmbos : somentePdf).push(it);
      setRes({ pdfTotal: mp.size, planilhaTotal: sp.size, somentePdf, emAmbos });
      toast.success(`${somentePdf.length} processo(s) do PDF não estão na planilha.`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao comparar");
    } finally {
      setLoading(false);
    }
  };

  const exportar = () => {
    if (!res) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Informação: "PDF", Valor: pdf?.name },
      { Informação: "Planilha", Valor: xlsx?.name },
      { Informação: "Gerado em", Valor: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) },
      { Informação: "Processos no PDF", Valor: res.pdfTotal },
      { Informação: "Processos na planilha", Valor: res.planilhaTotal },
      { Informação: "No PDF e não na planilha", Valor: res.somentePdf.length },
      { Informação: "Em ambos", Valor: res.emAmbos.length },
    ]), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      res.somentePdf.map((i) => ({ Processo: fmtCnj(onlyDigits(i.processo)), "Data autuação": i.data }))
    ), "Só no PDF");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      res.emAmbos.map((i) => ({ Processo: fmtCnj(onlyDigits(i.processo)), "Data autuação": i.data }))
    ), "Em ambos");
    XLSX.writeFile(wb, "comparacao_certidao_x_planilha.xlsx");
  };

  return (
    <MainLayout title="Comparar Certidão x Planilha" subtitle="Lista os processos que estão no PDF da Certidão e não estão na planilha base.">
      <div className="p-4 lg:p-6 space-y-6">
        <VoltarAdminTstButton />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GitCompare className="w-5 h-5" /> Arquivos</CardTitle>
            <CardDescription>Nada é gravado no sistema: apenas compara os dois arquivos pelo número CNJ.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>PDF da Certidão de Distribuição</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2">
              <Label>Planilha base (Excel)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setXlsx(e.target.files?.[0] ?? null)} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={comparar} disabled={loading || !pdf || !xlsx}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Comparar
              </Button>
              {res && <Button variant="outline" onClick={exportar}><FileDown className="w-4 h-4 mr-2" /> Baixar relatório Excel</Button>}
            </div>
          </CardContent>
        </Card>

        {res && (
          <Card>
            <CardHeader>
              <CardTitle>No PDF e não na planilha: {res.somentePdf.length}</CardTitle>
              <CardDescription>
                PDF: {res.pdfTotal} processos · Planilha: {res.planilhaTotal} processos · Em ambos: {res.emAmbos.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {res.somentePdf.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todos os processos do PDF estão na planilha.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Processo</TableHead><TableHead>Data autuação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {res.somentePdf.map((i, idx) => (
                      <TableRow key={i.processo}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-mono">{fmtCnj(onlyDigits(i.processo))}</TableCell>
                        <TableCell>{i.data}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
