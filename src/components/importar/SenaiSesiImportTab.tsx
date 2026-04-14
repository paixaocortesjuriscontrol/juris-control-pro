import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buscarAndamentosExternos } from "@/hooks/useBuscarAndamentos";
import { useImport } from "@/contexts/ImportContext";
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2, FileDown, Building2, Users, Clock } from "lucide-react";
import * as XLSX from "xlsx";

interface ValidationError {
  campo: string;
  mensagem: string;
}

interface ProcessoImport {
  numero: string;
  assunto: string | null;
  situacao: string | null;
  responsavel: string | null;
  parteAtiva: string | null;
  partePassiva: string | null;
  area: string | null;
  valorAcao: number | null;
  dataDistribuicao: string | null;
  orgaoJulgador: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: ValidationError[];
  erroImport?: string;
  linhaOriginal: number;
  abaOrigem?: string;
  senaiData?: {
    pasta: string | null;
    jurisdicaoAtual: string | null;
    tipoProcesso: string | null;
    calculoValidado: string | null;
    partesProcesso: string | null;
    faseAtual: string | null;
    objeto: string | null;
    valorPedido: number | null;
    prognostico: string | null;
    dataCalculo: string | null;
    naturezaFinanceira: string | null;
    entidade: string | null;
    valorPerdaRemota: number | null;
    valorPerdaPossivel: number | null;
    valorPerdaProvavel: number | null;
    rateio: string | null;
    observacoes: string | null;
    entidade2: string | null;
    advogadoCliente: string | null;
  };
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

const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  if (typeof dateValue === "number") {
    const d = new Date((dateValue - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof dateValue === "string") {
    const t = dateValue.trim();
    if (!t) return null;
    // Try ISO-like from Excel: "2024-03-12 00:00:00"
    const isoMatch = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    const brMatch = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }
  return null;
};

const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
};

const normalizeAreaToSlug = (area: string | null): string => {
  if (!area) return "civil";
  const areaLower = area.toLowerCase().trim();
  if (areaLower.includes("trabalhista") || areaLower.includes("trabalho")) return "trabalhista";
  if (areaLower.includes("empresarial")) return "empresarial";
  if (areaLower.includes("cível") || areaLower.includes("civel") || areaLower === "civil") return "civil";
  return areaLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_");
};

const mapStatusToEnum = (situacao: string | null): "ativo" | "pendente" | "urgente" | "encerrado" | "arquivado" => {
  if (!situacao) return "ativo";
  const s = situacao.toLowerCase().trim();
  if (s.includes("encerrado") || s.includes("finalizado") || s.includes("baixado") || s.includes("arquivado")) return "encerrado";
  if (s.includes("ativo")) return "ativo";
  return "ativo";
};

export function SenaiSesiImportTab({
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
  const [processos, setProcessos] = useState<ProcessoImport[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buscarAndamentos, setBuscarAndamentos] = useState(true);
  const cancelledRef = useRef(false);
  const { toast } = useToast();
  const { startImport, endImport } = useImport();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcel(selectedFile);
    }
  }, []);

  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: false });

      const allParsed: ProcessoImport[] = [];
      let globalLine = 2;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: null,
          blankrows: true,
        }) as any[][];

        if (!aoa.length) continue;

        const headerRow = (aoa[0] || []).map((h: any) => String(h ?? "").trim());

        const normalizeKey = (value: string) =>
          value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

        const colIndex = (keys: string[]): number => {
          for (const k of keys) {
            const nk = normalizeKey(k);
            const idx = headerRow.findIndex(h => normalizeKey(h) === nk);
            if (idx >= 0) return idx;
          }
          // Partial match
          for (const k of keys) {
            const nk = normalizeKey(k);
            const idx = headerRow.findIndex(h => normalizeKey(h).includes(nk));
            if (idx >= 0) return idx;
          }
          return -1;
        };

        const get = (row: any[], keys: string[]): any => {
          const idx = colIndex(keys);
          return idx >= 0 ? row[idx] : null;
        };

        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i];
          if (!row || row.every((c: any) => c === null || c === undefined || String(c).trim() === "")) continue;

          const numeroRaw = String(get(row, ["Numero atual do processo", "Numero do processo", "Processo"]) ?? "").trim();
          if (!numeroRaw || numeroRaw.length < 5) {
            allParsed.push({
              numero: numeroRaw,
              assunto: null, situacao: null, responsavel: null, parteAtiva: null, partePassiva: null,
              area: null, valorAcao: null, dataDistribuicao: null, orgaoJulgador: null,
              status: "invalido",
              erros: [{ campo: "numero", mensagem: !numeroRaw ? "Número do processo vazio" : `Número muito curto (${numeroRaw.length} chars)` }],
              linhaOriginal: globalLine,
              abaOrigem: sheetName,
            });
            globalLine++;
            continue;
          }

          const partesProcesso = String(get(row, ["Partes do Processo"]) ?? "").trim();
          // Try to split "PARTE1(RÉU), PARTE2(AUTOR)" into polo_ativo/passivo
          let poloAtivo: string | null = null;
          let poloPassivo: string | null = null;
          if (partesProcesso) {
            // Simple heuristic: first entry is often the client
            const clientePrincipal = String(get(row, ["Cliente Principal"]) ?? "").trim();
            const adverso = String(get(row, ["Adverso Principal"]) ?? "").trim();
            if (clientePrincipal || adverso) {
              poloPassivo = clientePrincipal || null;
              poloAtivo = adverso || null;
            } else {
              poloPassivo = partesProcesso;
            }
          }

          const processo: ProcessoImport = {
            numero: numeroRaw,
            assunto: String(get(row, ["Objeto"]) ?? "").trim() || null,
            situacao: String(get(row, ["status"]) ?? "").trim() || null,
            responsavel: String(get(row, ["Advogado do Cliente", "Advogado principal do Cliente"]) ?? "").trim() || null,
            parteAtiva: poloAtivo,
            partePassiva: poloPassivo,
            area: String(get(row, ["Natureza"]) ?? "").trim() || "trabalhista",
            valorAcao: parseNumber(get(row, ["Valor Pedido", "Valor da Garantia"])),
            dataDistribuicao: parseDate(get(row, ["Data de Início", "Data de Inclusão"])),
            orgaoJulgador: String(get(row, ["Jurisdição Atual", "Jurisdicao Atual"]) ?? "").trim() || null,
            status: "valido",
            erros: [],
            linhaOriginal: globalLine,
            abaOrigem: sheetName,
            senaiData: {
              pasta: String(get(row, ["Pasta"]) ?? "").trim() || null,
              jurisdicaoAtual: String(get(row, ["Jurisdição Atual", "Jurisdicao Atual"]) ?? "").trim() || null,
              tipoProcesso: String(get(row, ["Tipo de Processo"]) ?? "").trim() || null,
              calculoValidado: String(get(row, ["CALCULO VALIDADO"]) ?? "").trim() || null,
              partesProcesso: partesProcesso || null,
              faseAtual: String(get(row, ["Fase Atual"]) ?? "").trim() || null,
              objeto: String(get(row, ["Objeto"]) ?? "").trim() || null,
              valorPedido: parseNumber(get(row, ["Valor Pedido"])),
              prognostico: String(get(row, ["Prognóstico", "Prognostico"]) ?? "").trim() || null,
              dataCalculo: parseDate(get(row, ["Data Cálculo", "Data Calculo"])) || String(get(row, ["Data Cálculo", "Data Calculo"]) ?? "").trim() || null,
              naturezaFinanceira: String(get(row, ["Natureza Financeira"]) ?? "").trim() || null,
              entidade: String(get(row, ["Entidade"]) ?? "").trim() || null,
              valorPerdaRemota: parseNumber(get(row, ["Valor Perda Remota Corrigido"])),
              valorPerdaPossivel: parseNumber(get(row, ["Valor Perda Possível Objeto Corrigido", "Valor Perda Possivel Objeto Corrigido"])),
              valorPerdaProvavel: parseNumber(get(row, ["Valor Perda Provável Objeto Corrigido", "Valor Perda Provavel Objeto Corrigido"])),
              rateio: String(get(row, ["Rateio"]) ?? "").trim() || null,
              observacoes: String(get(row, ["Observações", "Observacoes", "Detalhes"]) ?? "").trim() || null,
              entidade2: null,
              advogadoCliente: String(get(row, ["Advogado do Cliente", "Advogado principal do Cliente"]) ?? "").trim() || null,
            },
          };

          // For "Garantias não Liberadas" sheet, mark differently
          if (sheetName.toLowerCase().includes("garantia")) {
            const garantiaTipo = String(get(row, ["Garantia"]) ?? "").trim();
            const liberada = String(get(row, ["Liberada"]) ?? "").trim();
            processo.senaiData!.observacoes = [
              garantiaTipo ? `Garantia: ${garantiaTipo}` : null,
              liberada ? `Liberada: ${liberada}` : null,
              processo.senaiData!.observacoes,
            ].filter(Boolean).join(" | ");
          }

          allParsed.push(processo);
          globalLine++;
        }

        globalLine++; // gap between sheets
      }

      setProcessos(allParsed);

      const validCount = allParsed.filter(p => p.status === "valido").length;
      const invalidCount = allParsed.filter(p => p.status === "invalido").length;

      toast({
        title: "Planilha carregada",
        description: `${allParsed.length} registro(s) de ${workbook.SheetNames.length} aba(s): ${validCount} importável(is), ${invalidCount} rejeitado(s).`,
        variant: invalidCount > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Erro ao ler planilha SENAI/SESI:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    const validProcessos = processos.filter(p => p.status === "valido");
    if (validProcessos.length === 0) {
      toast({ title: "Nenhum processo válido", variant: "destructive" });
      return;
    }

    setImporting(true);
    cancelledRef.current = false;
    startImport("Importando SENAI/SESI");
    setProgress(0);

    const updated = [...processos];
    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    let rejectedCount = 0;

    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updated.length; i++) {
      if (cancelledRef.current) {
        toast({ title: "Importação cancelada", description: `Cancelada após ${i} de ${updated.length} registros.` });
        setImporting(false);
        endImport();
        return;
      }

      const processo = updated[i];
      if (processo.status === "invalido") {
        rejectedCount++;
        setProgress(((i + 1) / updated.length) * 100);
        setProcessos([...updated]);
        continue;
      }

      try {
        const sd = processo.senaiData || {} as any;

        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const areaSlug = normalizeAreaToSlug(processo.area);

        // Determine cliente from entidade
        let clienteIdToUse = selectedCliente || null;
        const entidade = sd.entidade?.trim();
        if (entidade) {
          const existing = clientesCache.find(c => c.nome.toLowerCase().trim() === entidade.toLowerCase());
          if (existing) {
            clienteIdToUse = existing.id;
          } else {
            const { data: novo, error: cErr } = await supabase
              .from("clientes")
              .insert({ nome: entidade, tipo: "pessoa_juridica" })
              .select("id, nome")
              .single();
            if (!cErr && novo) {
              clienteIdToUse = novo.id;
              clientesCache.push({ id: novo.id, nome: novo.nome, tipo: "pessoa_juridica" });
            }
          }
        }

        const processoData: any = {
          numero: processo.numero.trim(),
          area: areaSlug,
          status: mapStatusToEnum(processo.situacao),
          situacao_original: processo.situacao,
          assunto: sd.objeto || processo.assunto,
          vara: sd.jurisdicaoAtual,
          data_distribuicao: parseDate(processo.dataDistribuicao),
          valor_causa: sd.valorPedido || parseNumber(processo.valorAcao),
          polo_ativo: processo.parteAtiva,
          polo_passivo: processo.partePassiva,
          coordenacao_id: selectedCoordenacao || null,
          advogado_responsavel_id: selectedMembro || null,
          cliente_id: clienteIdToUse,
          monitorar_andamentos: buscarAndamentos,
          advogado_externo: sd.advogadoCliente,
          fase: sd.faseAtual,
          tipo_processo: sd.tipoProcesso,
          probabilidade: sd.prognostico,
          observacoes_processo: sd.observacoes,
          pasta_cliente: sd.pasta,
          provisionamento_remoto: sd.valorPerdaRemota,
          provisionamento_possivel: sd.valorPerdaPossivel,
          provisionamento_provavel: sd.valorPerdaProvavel,
          natureza: sd.naturezaFinanceira === "PASSIVO" ? "passivo" : sd.naturezaFinanceira?.toLowerCase() || null,
          categoria_importacao: "senai_sesi",
          // New columns
          objeto: sd.objeto,
          natureza_financeira: sd.naturezaFinanceira,
          entidade: sd.entidade,
          calculo_validado: sd.calculoValidado,
          rateio: sd.rateio,
        };

        let isUpdate = false;

        if (existingProcesso) {
          const updateData = { ...processoData };
          const { data: current } = await supabase
            .from("processos")
            .select("coordenacao_id, advogado_responsavel_id")
            .eq("id", existingProcesso.id)
            .single();
          if (current) {
            if (current.coordenacao_id && !selectedCoordenacao) delete updateData.coordenacao_id;
            if (current.advogado_responsavel_id && !selectedMembro) delete updateData.advogado_responsavel_id;
          }
          const { error } = await supabase.from("processos").update(updateData).eq("id", existingProcesso.id);
          if (error) {
            updated[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCount++;
            continue;
          }
          isUpdate = true;
        } else {
          const { data: inserted, error } = await supabase
            .from("processos")
            .insert(processoData as any)
            .select("id")
            .single();
          if (error) {
            updated[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCount++;
            continue;
          }
          if (buscarAndamentos && inserted) {
            const res = await buscarAndamentosExternos(inserted.id, processo.numero.trim());
            if (!res.success) console.warn(`Andamentos falhou para ${processo.numero}:`, res.error);
          }
        }

        updated[i] = { ...processo, status: "sucesso", erroImport: isUpdate ? "Atualizado (já existia)" : undefined };
        if (isUpdate) updateCount++;
        else successCount++;
      } catch (err: any) {
        updated[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCount++;
      }

      setProgress(((i + 1) / updated.length) * 100);
      setProcessos([...updated]);
    }

    setImporting(false);
    endImport();

    toast({
      title: "Importação SENAI/SESI concluída",
      description: `${successCount} novo(s), ${updateCount} atualizado(s), ${rejectedCount} rejeitado(s), ${errorCount} erro(s).`,
      variant: errorCount > 0 || rejectedCount > 0 ? "destructive" : "default",
    });
  };

  const downloadRejeitados = () => {
    const problemas = processos.filter(p => p.status === "invalido" || p.status === "erro");
    if (!problemas.length) {
      toast({ title: "Nenhum problema encontrado" });
      return;
    }
    const data = problemas.map(p => ({
      Linha: p.linhaOriginal,
      Aba: p.abaOrigem || "",
      "Número": p.numero || "(vazio)",
      "Partes": p.partePassiva || p.parteAtiva || "-",
      Status: p.situacao || "-",
      Motivo: p.erroImport || p.erros.map(e => `${e.campo}: ${e.mensagem}`).join("; "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Problemas");
    XLSX.writeFile(wb, "senai_sesi_problemas.xlsx");
  };

  const validCount = processos.filter(p => p.status === "valido").length;
  const invalidCount = processos.filter(p => p.status === "invalido").length;
  const successCount = processos.filter(p => p.status === "sucesso").length;
  const errorCount = processos.filter(p => p.status === "erro").length;
  const totalProblemas = invalidCount + errorCount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Importar SENAI / SESI
          </CardTitle>
          <CardDescription>
            Importe processos trabalhistas usando a planilha de controle SENAI/SESI. Todas as abas serão processadas. Processos existentes serão atualizados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">1. Faça upload da planilha</h4>
            <p className="text-sm text-muted-foreground mb-3">
              A planilha deve conter as colunas: Numero atual do processo, status, Natureza, Partes do Processo, Fase Atual, etc.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs"
                disabled={importing}
              />
              {file && (
                <Button variant="outline" onClick={() => { setFile(null); setProcessos([]); setProgress(0); }} disabled={importing}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Coordenação Selection */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Coordenação Responsável
            </Label>
            <Select
              value={selectedCoordenacao}
              onValueChange={(v) => { setSelectedCoordenacao(v); setSelectedMembro(""); }}
              disabled={importing}
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

          {/* Member Selection */}
          {selectedCoordenacao && membrosDisponiveis.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Advogado Responsável (opcional)
              </Label>
              <Select value={selectedMembro} onValueChange={setSelectedMembro} disabled={importing}>
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

          {/* Cliente Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cliente (opcional — será detectado da coluna "Entidade")
            </Label>
            <Select value={selectedCliente} onValueChange={setSelectedCliente} disabled={importing}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione o cliente (ou deixe vazio para usar a planilha)" />
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

          {/* Buscar andamentos */}
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4" />
                Buscar andamentos na importação
              </Label>
              <p className="text-xs text-muted-foreground">
                {buscarAndamentos
                  ? "Os andamentos serão buscados durante a importação."
                  : "Os andamentos NÃO serão buscados."}
              </p>
            </div>
            <Switch checked={buscarAndamentos} onCheckedChange={setBuscarAndamentos} disabled={importing} />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Colunas reconhecidas:</strong> Data de Início, Natureza, Pasta, Jurisdição Atual, Tipo de Processo, Numero atual do processo, CALCULO VALIDADO, status, Partes do Processo, Fase Atual, Objeto, Valor Pedido, Prognóstico, Data Cálculo, Natureza Financeira, Entidade, Valor Perda Remota/Possível/Provável, Rateio, Observações, Advogado do Cliente, Garantia, Liberada.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Preview */}
      {file && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Pré-visualização SENAI / SESI</CardTitle>
                <CardDescription>
                  {processos.length} registro(s) encontrado(s) em "{file.name}"
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {processos.length > 0 && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                      {validCount} importáveis
                    </Badge>
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                      {invalidCount} rejeitados
                    </Badge>
                    {successCount > 0 && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                        {successCount} importados
                      </Badge>
                    )}
                    {errorCount > 0 && (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                        {errorCount} erros
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  {importing ? (
                    <Button variant="destructive" onClick={() => { cancelledRef.current = true; }}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => { setFile(null); setProcessos([]); setProgress(0); }}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Limpar
                    </Button>
                  )}
                  {totalProblemas > 0 && (
                    <Button variant="outline" onClick={downloadRejeitados}>
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
            {importing && <Progress value={progress} className="mt-4" />}
          </CardHeader>
          <CardContent>
            {processos.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Nenhum processo encontrado na planilha.</AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[60px]">Linha</TableHead>
                        <TableHead className="w-[60px]">Status</TableHead>
                        <TableHead>Aba</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Partes</TableHead>
                        <TableHead>Prognóstico</TableHead>
                        <TableHead className="min-w-[300px]">Avisos/Erros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processos.map((p, idx) => (
                        <TableRow key={idx} className={
                          p.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" :
                          p.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : ""
                        }>
                          <TableCell className="text-muted-foreground">{p.linhaOriginal}</TableCell>
                          <TableCell>
                            {p.status === "valido" && <div className="w-3 h-3 rounded-full bg-green-500" />}
                            {p.status === "invalido" && <XCircle className="h-4 w-4 text-red-500" />}
                            {p.status === "sucesso" && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                            {p.status === "erro" && <XCircle className="h-4 w-4 text-orange-500" />}
                          </TableCell>
                          <TableCell className="text-xs">{p.abaOrigem || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{p.numero || <span className="text-red-500 italic">vazio</span>}</TableCell>
                          <TableCell>{p.senaiData?.entidade || "-"}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{p.partePassiva || p.parteAtiva || "-"}</TableCell>
                          <TableCell>{p.senaiData?.prognostico || "-"}</TableCell>
                          <TableCell className="text-sm">
                            {p.status === "invalido" && p.erros.length > 0 && (
                              <div className="text-red-600 space-y-1">
                                {p.erros.map((e, j) => <div key={j}>• {e.campo}: {e.mensagem}</div>)}
                              </div>
                            )}
                            {p.erroImport && <div className="text-orange-600">• {p.erroImport}</div>}
                            {p.status === "valido" && p.erros.length === 0 && "-"}
                            {p.status === "sucesso" && !p.erroImport && <span className="text-blue-600">Importado com sucesso</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
