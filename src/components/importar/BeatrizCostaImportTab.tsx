import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buscarAndamentosExternos } from "@/hooks/useBuscarAndamentos";
import { useImport } from "@/contexts/ImportContext";
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2, FileDown, Building2, Users, Clock, Scale } from "lucide-react";
import * as XLSX from "xlsx";

interface ValidationError {
  campo: string;
  mensagem: string;
}

interface BeatrizProcesso {
  numero: string;
  tribunal: string | null;
  parteAdversa: string | null;
  reclamada: string | null;
  empresaTerceirizada: string | null;
  vara: string | null;
  comarca: string | null;
  uf: string | null;
  objeto: string | null;
  valorCausa: number | null;
  processosRelacionados: string | null;
  segredoJustica: boolean | null;
  status: "valido" | "invalido" | "sucesso" | "erro";
  erros: ValidationError[];
  erroImport?: string;
  resultado?: string;
  linhaOriginal: number;
  abaOrigem?: string;
}

const TABLE_PAGE_SIZE = 50;
const LOOKUP_BATCH_SIZE = 200;
const IMPORT_BATCH_SIZE = 100;

const yieldToUI = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const normalizeHeader = (value: any) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const txt = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
};

const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const cleaned = String(value).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const parseSimNao = (value: any): boolean | null => {
  const s = txt(value);
  if (!s) return null;
  const n = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.startsWith("s")) return true;
  if (n.startsWith("n")) return false;
  return null;
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const HEADER_MAP: Record<string, keyof BeatrizProcesso | "ignorar"> = {
  tribunal: "tribunal",
  processo: "numero",
  parteadversa: "parteAdversa",
  reclamada: "reclamada",
  empresaterceirizada: "empresaTerceirizada",
  nvtdavara: "vara",
  navtdavara: "vara",
  vtdavara: "vara",
  vara: "vara",
  comarca: "comarca",
  uf: "uf",
  descricaodoobjeto: "objeto",
  objeto: "objeto",
  valordacausa: "valorCausa",
  processosrelacionados: "processosRelacionados",
  segredodejusticasimounao: "segredoJustica",
  segredodejustica: "segredoJustica",
};

function parseSheet(wb: XLSX.WorkBook): BeatrizProcesso[] {
  const out: BeatrizProcesso[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    if (!rows.length) continue;

    // Detect header row within the first 10 rows
    let headerIdx = -1;
    let colMap: Record<number, string> = {};
    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const map: Record<number, string> = {};
      rows[r].forEach((cell, c) => {
        const key = HEADER_MAP[normalizeHeader(cell)];
        if (key && key !== "ignorar") map[c] = key as string;
      });
      if (Object.values(map).includes("numero")) {
        headerIdx = r;
        colMap = map;
        break;
      }
    }
    if (headerIdx === -1) continue;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;

      const item: BeatrizProcesso = {
        numero: "",
        tribunal: null,
        parteAdversa: null,
        reclamada: null,
        empresaTerceirizada: null,
        vara: null,
        comarca: null,
        uf: null,
        objeto: null,
        valorCausa: null,
        processosRelacionados: null,
        segredoJustica: null,
        status: "valido",
        erros: [],
        linhaOriginal: r + 1,
        abaOrigem: sheetName,
      };

      Object.entries(colMap).forEach(([colIdx, field]) => {
        const raw = row[Number(colIdx)];
        switch (field) {
          case "numero":
            item.numero = txt(raw) ?? "";
            break;
          case "valorCausa":
            item.valorCausa = parseNumber(raw);
            break;
          case "segredoJustica":
            item.segredoJustica = parseSimNao(raw);
            break;
          default:
            (item as any)[field] = txt(raw);
        }
      });

      const digits = onlyDigits(item.numero);
      if (!item.numero) {
        item.status = "invalido";
        item.erros.push({ campo: "Processo", mensagem: "Número do processo vazio" });
      } else if (digits.length !== 20) {
        item.status = "invalido";
        item.erros.push({ campo: "Processo", mensagem: `Número CNJ inválido (${digits.length} dígitos)` });
      }

      out.push(item);
    }
  }

  return out;
}

function consolidar(items: BeatrizProcesso[]) {
  const validMap = new Map<string, BeatrizProcesso>();
  const invalid: BeatrizProcesso[] = [];
  let duplicadas = 0;

  for (const item of items) {
    if (item.status !== "valido" || !item.numero) {
      invalid.push(item);
      continue;
    }
    const key = item.numero.trim();
    const existing = validMap.get(key);
    if (!existing) {
      validMap.set(key, { ...item, numero: key });
      continue;
    }
    duplicadas += 1;
    validMap.set(key, {
      ...existing,
      tribunal: existing.tribunal || item.tribunal,
      parteAdversa: existing.parteAdversa || item.parteAdversa,
      reclamada: existing.reclamada || item.reclamada,
      empresaTerceirizada: existing.empresaTerceirizada || item.empresaTerceirizada,
      vara: existing.vara || item.vara,
      comarca: existing.comarca || item.comarca,
      uf: existing.uf || item.uf,
      objeto: existing.objeto || item.objeto,
      valorCausa: existing.valorCausa ?? item.valorCausa,
      processosRelacionados: existing.processosRelacionados || item.processosRelacionados,
      segredoJustica: existing.segredoJustica ?? item.segredoJustica,
    });
  }

  return { processos: [...validMap.values(), ...invalid], duplicadas };
}

interface Props {
  coordenacoes: any[];
  clientes: { id: string; nome: string; tipo: string }[];
  selectedCoordenacao: string;
  setSelectedCoordenacao: (v: string) => void;
  selectedMembro: string;
  setSelectedMembro: (v: string) => void;
  selectedCliente: string;
  setSelectedCliente: (v: string) => void;
  membrosDisponiveis: { id: string; nome: string }[];
}

export function BeatrizCostaImportTab({
  coordenacoes,
  clientes,
  selectedCoordenacao,
  setSelectedCoordenacao,
  selectedMembro,
  setSelectedMembro,
  selectedCliente,
  setSelectedCliente,
  membrosDisponiveis,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [processos, setProcessos] = useState<BeatrizProcesso[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [buscarAndamentos, setBuscarAndamentos] = useState(false);
  const [visibleRows, setVisibleRows] = useState(TABLE_PAGE_SIZE);
  const cancelledRef = useRef(false);
  const { toast } = useToast();
  const { startImport, endImport } = useImport();

  const limpar = () => {
    setFile(null);
    setProcessos([]);
    setProgress(0);
    setProgressMsg("");
    setVisibleRows(TABLE_PAGE_SIZE);
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    setFile(selected);
    setProcessos([]);
    setVisibleRows(TABLE_PAGE_SIZE);
    setParsing(true);
    setProgress(10);
    setProgressMsg("Lendo planilha...");
    await yieldToUI();

    try {
      const buffer = await selected.arrayBuffer();
      setProgress(45);
      setProgressMsg("Interpretando dados...");
      await yieldToUI();

      const wb = XLSX.read(buffer, { type: "array" });
      const parsed = parseSheet(wb);
      setProgress(100);
      await yieldToUI();
      setProcessos(parsed);
      setProgressMsg("");

      const validos = parsed.filter((p) => p.status === "valido").length;
      toast({
        title: "Planilha carregada",
        description: `${parsed.length} linha(s): ${validos} importável(is), ${parsed.length - validos} rejeitada(s).`,
        variant: parsed.length - validos > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      console.error("Erro ao ler planilha Beatriz Costa:", err);
      toast({
        title: "Erro ao ler planilha",
        description: err?.message || "Verifique se o arquivo é .xlsx ou .xls válido.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  }, [toast]);

  const handleImport = async () => {
    const { processos: consolidados, duplicadas } = consolidar(processos);
    const validos = consolidados.filter((p) => p.status === "valido");
    if (validos.length === 0) {
      toast({ title: "Nenhum processo válido", variant: "destructive" });
      return;
    }

    setImporting(true);
    cancelledRef.current = false;
    startImport(`Importando ${validos.length} processos (Dra. Beatriz Costa)`);
    setProgress(0);
    setProgressMsg(`Preparando ${validos.length} processo(s) único(s) (${duplicadas} duplicada(s) consolidada(s))...`);
    await yieldToUI();

    // Fase 1: buscar existentes em lotes
    const existingMap = new Map<string, string>();
    const numeros = validos.map((p) => p.numero);
    const lookupChunks = chunkArray(numeros, LOOKUP_BATCH_SIZE);
    for (let i = 0; i < lookupChunks.length; i++) {
      if (cancelledRef.current) break;
      const { data } = await supabase.from("processos").select("id, numero").in("numero", lookupChunks[i]);
      data?.forEach((row: any) => existingMap.set(row.numero, row.id));
      setProgress(((i + 1) / lookupChunks.length) * 15);
      setProgressMsg(`Verificando processos existentes (${Math.min((i + 1) * LOOKUP_BATCH_SIZE, numeros.length)}/${numeros.length})...`);
      await yieldToUI();
    }

    let novos = 0;
    let atualizados = 0;
    let erros = 0;
    const results = new Map<string, { status: "sucesso" | "erro"; msg?: string }>();

    const lotes = chunkArray(validos, IMPORT_BATCH_SIZE);
    let processados = 0;

    for (let l = 0; l < lotes.length; l++) {
      if (cancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após ${processados} de ${validos.length} processo(s).`,
        });
        break;
      }

      const lote = lotes[l];

      for (const p of lote) {
        if (cancelledRef.current) break;

        try {
          const payload: any = {
            numero: p.numero,
            area: "trabalhista",
            tribunal: p.tribunal,
            polo_ativo: p.parteAdversa,
            polo_passivo: p.reclamada,
            reclamados: p.reclamada,
            empresa_terceirizada: p.empresaTerceirizada,
            vara: p.vara,
            comarca: p.comarca,
            uf: p.uf,
            objeto: p.objeto,
            assunto: p.objeto,
            valor_causa: p.valorCausa,
            processos_relacionados: p.processosRelacionados,
            segredo_justica: p.segredoJustica,
            coordenacao_id: selectedCoordenacao || null,
            advogado_responsavel_id: selectedMembro || null,
            cliente_id: selectedCliente || null,
            categoria_importacao: "beatriz_costa",
            monitorar_andamentos: buscarAndamentos,
          };

          const existingId = existingMap.get(p.numero);

          if (existingId) {
            const updateData = { ...payload };
            delete updateData.numero;
            if (!selectedCoordenacao) delete updateData.coordenacao_id;
            if (!selectedMembro) delete updateData.advogado_responsavel_id;
            if (!selectedCliente) delete updateData.cliente_id;
            const { error } = await supabase.from("processos").update(updateData).eq("id", existingId);
            if (error) {
              results.set(p.numero, { status: "erro", msg: error.message });
              erros++;
            } else {
              results.set(p.numero, { status: "sucesso", msg: "Atualizado (já existia)" });
              atualizados++;
            }
          } else {
            const { data: inserted, error } = await supabase
              .from("processos")
              .insert(payload)
              .select("id")
              .single();
            if (error) {
              results.set(p.numero, { status: "erro", msg: error.message });
              erros++;
            } else {
              results.set(p.numero, { status: "sucesso", msg: "Cadastrado" });
              novos++;
              if (buscarAndamentos && inserted) {
                buscarAndamentosExternos(inserted.id, p.numero).catch(() => {});
              }
            }
          }
        } catch (err: any) {
          results.set(p.numero, { status: "erro", msg: err?.message || "Erro desconhecido" });
          erros++;
        }

        processados++;
        if (processados % 5 === 0 || processados === validos.length) {
          setProgress(15 + (processados / validos.length) * 85);
          setProgressMsg(
            `Lote ${l + 1}/${lotes.length} — ${processados}/${validos.length} processado(s): ${novos} novo(s), ${atualizados} atualizado(s), ${erros} erro(s)`
          );
          await yieldToUI();
        }
      }
    }

    const finais = consolidados.map((p) => {
      const r = results.get(p.numero);
      return r ? { ...p, status: r.status as BeatrizProcesso["status"], erroImport: r.status === "erro" ? r.msg : undefined, resultado: r.status === "sucesso" ? r.msg : undefined } : p;
    });
    setProcessos(finais);
    setImporting(false);
    setProgressMsg("");
    endImport();

    if (!cancelledRef.current) {
      const rejeitados = consolidados.filter((p) => p.status === "invalido").length;
      toast({
        title: "Importação concluída",
        description: `${novos} novo(s), ${atualizados} atualizado(s), ${rejeitados} rejeitado(s), ${erros} erro(s).`,
        variant: erros > 0 || rejeitados > 0 ? "destructive" : "default",
      });
    }
  };

  const baixarProblemas = () => {
    const problemas = processos.filter((p) => p.status === "invalido" || p.status === "erro");
    if (!problemas.length) {
      toast({ title: "Nenhum problema encontrado" });
      return;
    }
    const data = problemas.map((p) => ({
      Linha: p.linhaOriginal,
      Aba: p.abaOrigem || "",
      Processo: p.numero || "(vazio)",
      "Parte Adversa": p.parteAdversa || "-",
      Reclamada: p.reclamada || "-",
      Motivo: p.erroImport || p.erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Problemas");
    XLSX.writeFile(wb, "beatriz_costa_problemas.xlsx");
  };

  const validCount = processos.filter((p) => p.status === "valido").length;
  const invalidCount = processos.filter((p) => p.status === "invalido").length;
  const successCount = processos.filter((p) => p.status === "sucesso").length;
  const errorCount = processos.filter((p) => p.status === "erro").length;
  const totalProblemas = invalidCount + errorCount;

  const displayed = processos.slice(0, visibleRows);
  const hasMore = visibleRows < processos.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Importar — Dra. Beatriz Costa
          </CardTitle>
          <CardDescription>
            Importação em lotes da planilha "BASE - RELATÓRIOS - TODOS OS CLIENTES". Processos existentes são
            atualizados e os novos são cadastrados, aparecendo na tela Processos e Casos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">1. Faça upload da planilha</h4>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs"
                disabled={importing || parsing}
              />
              {file && !parsing && (
                <Button variant="outline" onClick={limpar} disabled={importing}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {parsing && (
            <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{progressMsg || "Processando..."}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="space-y-2 pt-4 border-t">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Coordenação Responsável
            </Label>
            <Select
              value={selectedCoordenacao}
              onValueChange={(v) => {
                setSelectedCoordenacao(v);
                setSelectedMembro("");
              }}
              disabled={importing || parsing}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione a coordenação (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {coordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>
                    {coord.nome} ({coord.area})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCoordenacao && membrosDisponiveis.length > 0 && (
            <div className="space-y-2">
              <Label>Advogado Responsável (opcional)</Label>
              <Select value={selectedMembro} onValueChange={setSelectedMembro} disabled={importing || parsing}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Selecione o advogado responsável" />
                </SelectTrigger>
                <SelectContent>
                  {membrosDisponiveis.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cliente (opcional)
            </Label>
            <Select value={selectedCliente} onValueChange={setSelectedCliente} disabled={importing || parsing}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} ({c.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4" />
                Buscar andamentos na importação
              </Label>
              <p className="text-xs text-muted-foreground">
                {buscarAndamentos
                  ? "Os andamentos serão buscados para os processos novos."
                  : "Os andamentos NÃO serão buscados (importação mais rápida)."}
              </p>
            </div>
            <Switch checked={buscarAndamentos} onCheckedChange={setBuscarAndamentos} disabled={importing || parsing} />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Colunas reconhecidas:</strong> TRIBUNAL, PROCESSO, PARTE ADVERSA, RECLAMADA, EMPRESA
              TERCEIRIZADA, Nª VT DA VARA, COMARCA, UF, DESCRIÇÃO DO OBJETO, VALOR DA CAUSA, PROCESSOS RELACIONADOS
              e SEGREDO DE JUSTIÇA? (SIM OU NÃO). Todas as abas do arquivo são lidas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {file && !parsing && processos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Acompanhamento da importação</CardTitle>
                <CardDescription>
                  {processos.length} linha(s) em "{file.name}"
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    {validCount} importáveis
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                    {invalidCount} rejeitados
                  </Badge>
                  {successCount > 0 && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                      {successCount} processados
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                      {errorCount} erros
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {importing ? (
                    <Button variant="destructive" onClick={() => { cancelledRef.current = true; }}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={limpar}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Limpar
                    </Button>
                  )}
                  {totalProblemas > 0 && (
                    <Button variant="outline" onClick={baixarProblemas}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Baixar Problemas ({totalProblemas})
                    </Button>
                  )}
                  <Button onClick={handleImport} disabled={importing || validCount === 0}>
                    {importing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Importar ({validCount})</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            {(importing || progress > 0) && (
              <div className="mt-4 space-y-1">
                <Progress value={progress} className="h-2" />
                {progressMsg && <p className="text-xs text-muted-foreground">{progressMsg}</p>}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[60px]">Linha</TableHead>
                      <TableHead className="w-[60px]">Status</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead>Tribunal</TableHead>
                      <TableHead>Parte Adversa</TableHead>
                      <TableHead>Reclamada</TableHead>
                      <TableHead>Comarca/UF</TableHead>
                      <TableHead className="min-w-[240px]">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayed.map((p, idx) => (
                      <TableRow
                        key={`${p.numero}-${idx}`}
                        className={
                          p.status === "invalido"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : p.status === "erro"
                            ? "bg-orange-50 dark:bg-orange-950/20"
                            : ""
                        }
                      >
                        <TableCell className="text-muted-foreground">{p.linhaOriginal}</TableCell>
                        <TableCell>
                          {p.status === "valido" && <div className="w-3 h-3 rounded-full bg-green-500" />}
                          {p.status === "invalido" && <XCircle className="h-4 w-4 text-red-500" />}
                          {p.status === "sucesso" && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                          {p.status === "erro" && <XCircle className="h-4 w-4 text-orange-500" />}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.numero || <span className="text-red-500 italic">vazio</span>}
                        </TableCell>
                        <TableCell className="text-xs">{p.tribunal || "-"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{p.parteAdversa || "-"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{p.reclamada || "-"}</TableCell>
                        <TableCell className="text-xs">{[p.comarca, p.uf].filter(Boolean).join("/") || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {p.status === "invalido" && (
                            <div className="text-red-600 space-y-1">
                              {p.erros.map((e, j) => <div key={j}>• {e.campo}: {e.mensagem}</div>)}
                            </div>
                          )}
                          {p.status === "erro" && <span className="text-orange-600">{p.erroImport}</span>}
                          {p.status === "sucesso" && <span className="text-blue-600">{p.resultado || "OK"}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setVisibleRows((v) => v + TABLE_PAGE_SIZE)}>
                  Mostrar mais ({processos.length - visibleRows} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}