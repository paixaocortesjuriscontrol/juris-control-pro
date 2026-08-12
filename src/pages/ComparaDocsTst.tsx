import { useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileDiff, Upload, X, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import {
  CATEGORIAS_DOC_TST,
  CategoriaDocTst,
  classificarPublicacaoTst,
  detectarCategoriaDoc,
  extrairProcessosDoTexto,
  mascararCnj,
} from "@/lib/classificarPublicacaoTst";

type DocManual = {
  nome: string;
  categoria: CategoriaDocTst;
  processos: string[];
};

type Divergencia = {
  processo: string;
  tipo: "faltando" | "extra" | "categoria";
  detalhe: string;
};

type ResultadoCategoria = {
  categoria: CategoriaDocTst;
  label: string;
  doc: string;
  totalDoc: number;
  totalSistema: number;
  divergencias: Divergencia[];
};

const labelCategoria = (c: CategoriaDocTst) =>
  CATEGORIAS_DOC_TST.find((x) => x.key === c)?.label ?? c;

export default function ComparaDocsTst() {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const [dataInicio, setDataInicio] = useState(hoje);
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [docs, setDocs] = useState<DocManual[]>([]);
  const [lendo, setLendo] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<ResultadoCategoria[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: coordenacoes } = useCoordenacoesFull();

  const totalDivergencias = useMemo(
    () => (resultados || []).reduce((acc, r) => acc + r.divergencias.length, 0),
    [resultados]
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLendo(true);
    setResultados(null);
    try {
      const mammoth = await import("mammoth");
      const novos: DocManual[] = [];
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".docx")) {
          toast.error(`${file.name}: apenas arquivos .docx são aceitos`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
        const texto = value || "";
        const categoria = detectarCategoriaDoc(file.name, texto);
        if (!categoria) {
          toast.error(`${file.name}: não foi possível identificar a categoria (Temas IRR, Pauta, CEJUSC, Distribuições, Intimações ou Prazos)`);
          continue;
        }
        novos.push({ nome: file.name, categoria, processos: extrairProcessosDoTexto(texto) });
      }
      setDocs((prev) => {
        const map = new Map(prev.map((d) => [d.nome, d]));
        novos.forEach((d) => map.set(d.nome, d));
        return [...map.values()];
      });
      if (novos.length > 0) toast.success(`${novos.length} documento(s) lido(s)`);
    } catch (e) {
      toast.error(`Erro ao ler documento: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const buscarPublicacoes = async () => {
    // data_disponibilizacao é timestamp: usa intervalo do dia [dia, dia+1)
    // Importante: calcular em UTC para não perder um dia por causa do fuso local (UTC-3)
    const proximoDia = new Date(new Date(`${dataInicio}T00:00:00Z`).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    const linhas: { processo_numero: string | null; conteudo: string | null; tipo_comunicacao: string | null; orgao: string | null }[] = [];
    const pageSize = 1000;
    for (let page = 0; ; page++) {
      let q = supabase
        .from("publicacoes_djen")
        .select("processo_numero, conteudo, tipo_comunicacao, orgao")
        .eq("status", "encontrada")
        .gte("data_disponibilizacao", dataInicio)
        .lt("data_disponibilizacao", proximoDia)
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (coordenacaoId !== "todas") q = q.eq("coordenacao_id", coordenacaoId);
      const { data, error } = await q;
      if (error) throw error;
      linhas.push(...(data || []));
      setProgresso(Math.min(90, 10 + page * 15));
      if (!data || data.length < pageSize) break;
    }
    return linhas;
  };

  const handleComparar = async () => {
    setResultados(null);
    if (docs.length === 0) {
      toast.error("Envie ao menos um documento");
      return;
    }
    setComparando(true);
    setProgresso(5);
    try {
      const publicacoes = await buscarPublicacoes();
      if (publicacoes.length === 0) {
        toast.error("Nenhuma publicação encontrada no período/coordenação selecionados");
        setResultados([]);
        return;
      }
      // Classificação do sistema: processo -> categoria
      const catPorProcesso = new Map<string, CategoriaDocTst>();
      const processosPorCategoria = new Map<CategoriaDocTst, Set<string>>();
      publicacoes.forEach((p) => {
        const digits = String(p.processo_numero || "").replace(/\D/g, "");
        if (digits.length !== 20) return;
        const { categoria } = classificarPublicacaoTst(p);
        catPorProcesso.set(digits, categoria);
        if (!processosPorCategoria.has(categoria)) processosPorCategoria.set(categoria, new Set());
        processosPorCategoria.get(categoria)!.add(digits);
      });
      setProgresso(95);

      const res: ResultadoCategoria[] = docs.map((doc) => {
        const doDoc = new Set(doc.processos);
        const doSistema = processosPorCategoria.get(doc.categoria) ?? new Set<string>();
        const divergencias: Divergencia[] = [];
        doSistema.forEach((p) => {
          if (!doDoc.has(p)) divergencias.push({ processo: p, tipo: "faltando", detalhe: "O sistema classificou nesta categoria, mas o processo não consta no documento enviado" });
        });
        doDoc.forEach((p) => {
          if (doSistema.has(p)) return;
          const outra = catPorProcesso.get(p);
          if (outra) {
            divergencias.push({ processo: p, tipo: "categoria", detalhe: `O sistema classificou como "${labelCategoria(outra)}"` });
          } else {
            divergencias.push({ processo: p, tipo: "extra", detalhe: "Processo consta no documento, mas não há publicação no período/coordenação selecionados" });
          }
        });
        divergencias.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.processo.localeCompare(b.processo));
        return {
          categoria: doc.categoria,
          label: labelCategoria(doc.categoria),
          doc: doc.nome,
          totalDoc: doDoc.size,
          totalSistema: doSistema.size,
          divergencias,
        };
      });
      setResultados(res);
      setProgresso(100);
      const total = res.reduce((a, r) => a + r.divergencias.length, 0);
      if (total === 0) toast.success("Nenhuma divergência encontrada!");
      else toast.warning(`${total} divergência(s) encontrada(s)`);
    } catch (e) {
      toast.error(`Erro na comparação: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setComparando(false);
    }
  };

  const gerarPdf = async () => {
    if (!resultados || resultados.length === 0) {
      toast.error("Faça a comparação antes de gerar o relatório");
      return;
    }
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const coordNome =
      coordenacaoId === "todas"
        ? "Todas as coordenações"
        : ((coordenacoes || []).find((c: any) => c.id === coordenacaoId)?.nome ?? "-");
    const dataBr = dataInicio.split("-").reverse().join("/");

    doc.setFontSize(15);
    doc.text("Compara Docs TST - Relatório de Divergências", 40, 40);
    doc.setFontSize(10);
    doc.text(`Disponibilização: ${dataBr}`, 40, 60);
    doc.text(`Coordenação: ${coordNome}`, 40, 74);
    doc.text(`Total de divergências: ${totalDivergencias}`, 40, 88);

    let y = 110;
    resultados.forEach((r) => {
      doc.setFontSize(11);
      doc.text(`${r.label} — ${r.doc}`, 40, y);
      doc.setFontSize(9);
      doc.text(
        `Documento: ${r.totalDoc}  |  Sistema: ${r.totalSistema}  |  Divergências: ${r.divergencias.length}`,
        40,
        y + 14,
      );
      autoTable(doc, {
        startY: y + 24,
        head: [["Processo", "Tipo", "Detalhe"]],
        body: r.divergencias.map((d) => [
          mascararCnj(d.processo),
          d.tipo === "faltando" ? "Falta no documento" : d.tipo === "categoria" ? "Categoria divergente" : "Fora da base",
          d.detalhe,
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 130 } },
        margin: { left: 40, right: 40 },
      });
      y = (doc as any).lastAutoTable.finalY + 28;
      if (y > doc.internal.pageSize.getHeight() - 90) {
        doc.addPage();
        y = 50;
      }
    });

    doc.save(`Divergencias_Docs_TST_${dataInicio}.pdf`);
    toast.success("Relatório PDF gerado");
  };

  return (
    <MainLayout
      title="Compara Docs TST"
      subtitle="Compare os documentos feitos manualmente com a classificação do botão Docs TST (Análise DJEN) e veja as divergências."
    >
      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileDiff className="w-5 h-5 text-sky-400" /> Base de comparação
            </CardTitle>
            <CardDescription>
              O sistema reclassifica as publicações de um único dia (disponibilização) com as mesmas regras do botão "Docs TST" e confronta com os processos citados nos documentos enviados.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data da disponibilização</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Coordenação</Label>
              <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações</SelectItem>
                  {(coordenacoes || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-5 h-5 text-sky-400" /> Documentos manuais (.docx)
            </CardTitle>
            <CardDescription>
              Envie um ou todos os documentos. A categoria é identificada pelo nome do arquivo ou pelo título (Temas IRR, Pauta, CEJUSC, Distribuições, Intimações, Prazos).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              ref={inputRef}
              type="file"
              accept=".docx"
              multiple
              disabled={lendo || comparando}
              onChange={(e) => handleFiles(e.target.files)}
            />
            {docs.length > 0 && (
              <div className="space-y-2">
                {docs.map((d) => (
                  <div key={d.nome} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {labelCategoria(d.categoria)} · {d.processos.length} processo(s) identificado(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={d.categoria}
                        onValueChange={(v) =>
                          setDocs((prev) => prev.map((x) => (x.nome === d.nome ? { ...x, categoria: v as CategoriaDocTst } : x)))
                        }
                      >
                        <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS_DOC_TST.map((c) => (
                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => setDocs((prev) => prev.filter((x) => x.nome !== d.nome))}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleComparar} disabled={comparando || lendo || docs.length === 0}>
                {comparando ? "Comparando..." : "Comparar documentos"}
              </Button>
              {docs.length > 0 && (
                <Button variant="outline" onClick={() => { setDocs([]); setResultados(null); }} disabled={comparando}>
                  Limpar
                </Button>
              )}
            </div>
            {comparando && <Progress value={progresso} />}
          </CardContent>
        </Card>

        {resultados && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {totalDivergencias === 0 ? (
                  <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Sem divergências</>
                ) : (
                  <><AlertTriangle className="w-5 h-5 text-amber-500" /> {totalDivergencias} divergência(s)</>
                )}
              </CardTitle>
              {resultados.length > 0 && (
                <Button variant="outline" size="sm" onClick={gerarPdf}>
                  <FileText className="w-4 h-4 mr-2" /> Relatório PDF
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {resultados.map((r) => (
                <div key={r.doc} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
                    <span className="font-semibold text-sm">{r.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{r.doc}</span>
                    <Badge variant="outline">Documento: {r.totalDoc}</Badge>
                    <Badge variant="outline">Sistema: {r.totalSistema}</Badge>
                    <Badge variant={r.divergencias.length === 0 ? "secondary" : "destructive"}>
                      {r.divergencias.length} divergência(s)
                    </Badge>
                  </div>
                  {r.divergencias.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[220px]">Processo</TableHead>
                          <TableHead className="w-[160px]">Tipo</TableHead>
                          <TableHead>Detalhe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.divergencias.map((d, i) => (
                          <TableRow key={`${d.processo}-${i}`}>
                            <TableCell className="font-mono text-xs">{mascararCnj(d.processo)}</TableCell>
                            <TableCell>
                              <Badge variant={d.tipo === "faltando" ? "destructive" : d.tipo === "categoria" ? "default" : "secondary"}>
                                {d.tipo === "faltando" ? "Falta no documento" : d.tipo === "categoria" ? "Categoria divergente" : "Fora da base"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{d.detalhe}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}