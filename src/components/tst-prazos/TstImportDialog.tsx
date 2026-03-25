import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { ProcessoTstImport } from "@/hooks/usePrazosTst";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  coordenacaoId: string | null;
  coordenacoes: { id: string; nome: string }[];
  onImport: (items: ProcessoTstImport[]) => Promise<any>;
  onClearAndImport: (data: { coordenacaoId: string; items: ProcessoTstImport[] }) => Promise<any>;
  isImporting: boolean;
  onCoordenacaoChange: (id: string) => void;
}

interface Membro {
  id: string;
  nome: string;
}

const MESES_ABREV: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  fev: "02", abr: "04", mai: "05", ago: "08", set: "09", out: "10", dez: "12",
};

function formatIsoDate(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseExcelDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatIsoDate(val.getUTCFullYear(), val.getUTCMonth() + 1, val.getUTCDate());
  }
  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) return formatIsoDate(parsed.y, parsed.m, parsed.d);
  }
  if (typeof val === "string") {
    const normalized = val.trim();
    if (!normalized) return null;

    if (/^\d+(\.\d+)?$/.test(normalized)) {
      const parsed = XLSX.SSF.parse_date_code(Number(normalized));
      if (parsed) return formatIsoDate(parsed.y, parsed.m, parsed.d);
    }

    const brDate = normalized.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (brDate) {
      const year = brDate[3].length === 2 ? 2000 + Number(brDate[3]) : Number(brDate[3]);
      return formatIsoDate(year, Number(brDate[2]), Number(brDate[1]));
    }

    const isoDate = normalized.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (isoDate) return formatIsoDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));

    const shortDayFirst = normalized.match(/^(\d{1,2})[-\/\s](\w{3,})(?:[-\/\s](\d{2,4}))?$/i);
    if (shortDayFirst) {
      const monthKey = shortDayFirst[2].toLowerCase().slice(0, 3);
      const year = shortDayFirst[3]
        ? (shortDayFirst[3].length === 2 ? 2000 + Number(shortDayFirst[3]) : Number(shortDayFirst[3]))
        : new Date().getFullYear();
      if (MESES_ABREV[monthKey]) {
        return formatIsoDate(year, Number(MESES_ABREV[monthKey]), Number(shortDayFirst[1]));
      }
    }

    const shortMonthFirst = normalized.match(/^(\w{3,})[-\/\s](\d{1,2})(?:[-\/\s](\d{2,4}))?$/i);
    if (shortMonthFirst) {
      const monthKey = shortMonthFirst[1].toLowerCase().slice(0, 3);
      const year = shortMonthFirst[3]
        ? (shortMonthFirst[3].length === 2 ? 2000 + Number(shortMonthFirst[3]) : Number(shortMonthFirst[3]))
        : new Date().getFullYear();
      if (MESES_ABREV[monthKey]) {
        return formatIsoDate(year, Number(MESES_ABREV[monthKey]), Number(shortMonthFirst[2]));
      }
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10);
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h?.toString().toLowerCase().trim().includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function getSheetRows(ws: XLSX.WorkSheet): unknown[][] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: unknown[][] = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
    const row: unknown[] = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
      const cell = ws[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      if (cell && (cell.t === "d" || cell.v instanceof Date)) {
        row.push(cell.v);
      } else {
        row.push(cell?.w ?? cell?.v ?? "");
      }
    }
    rows.push(row);
  }
  return rows;
}

/** Try to find the header row by looking for a row that contains "processo" */
function detectHeaderRow(rows: unknown[][]): number {
  const maxScan = Math.min(rows.length, 10);
  for (let i = 0; i < maxScan; i++) {
    const rowStr = rows[i].map((c) => String(c ?? "").toLowerCase()).join("|");
    if (rowStr.includes("processo")) {
      return i;
    }
  }
  return 0;
}

export function TstImportDialog({
  open, onClose, coordenacaoId, coordenacoes,
  onImport, onClearAndImport, isImporting, onCoordenacaoChange,
}: Props) {
  const { user } = useAuth();
  const [clearBefore, setClearBefore] = useState(false);
  const [preview, setPreview] = useState<ProcessoTstImport[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [defaultResponsavelId, setDefaultResponsavelId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch membros for selected coordenação
  const activeCoordId = coordenacaoId && coordenacaoId !== "todas" ? coordenacaoId : "";
  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["tst-import-membros", activeCoordId],
    queryFn: async () => {
      if (!activeCoordId) return [];
      const { data } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id, usuario:profiles_basic!membros_coordenacao_usuario_id_fkey(id, nome)")
        .eq("coordenacao_id", activeCoordId);
      return (data ?? [])
        .map((m: any) => ({
          id: m.usuario?.id ?? m.usuario_id,
          nome: m.usuario?.nome ?? "Sem nome",
        }))
        .filter((m) => m.id);
    },
    enabled: open && !!activeCoordId,
  });

  useEffect(() => {
    if (open) {
      setDefaultResponsavelId("");
    }
  }, [open, activeCoordId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setPreview([]);
    setProgress(10);

    try {
      const ab = await file.arrayBuffer();
      setProgress(25);

      const wb = XLSX.read(ab, { type: "array", cellDates: true, cellStyles: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = getSheetRows(ws);
      setProgress(40);

      console.log("[TST Import] Total rows (incl header):", rows.length);
      console.log("[TST Import] First 5 rows raw:", rows.slice(0, 5).map((r, i) => ({ row: i, cells: r.map((c) => ({ value: c, type: typeof c })) })));

      if (rows.length < 2) {
        toast.error("Planilha vazia ou sem dados suficientes.");
        setParsing(false);
        setProgress(0);
        return;
      }

      const headerRowIdx = detectHeaderRow(rows);
      const headers = rows[headerRowIdx].map((h) => String(h ?? ""));
      console.log("[TST Import] Header row index:", headerRowIdx, "Headers:", headers);

      const detectedFatalColumn = findColumn(headers, ["data fatal", "dt fatal", "prazo fatal", "fatal", "data limite", "vencimento", "prazo"]);
      const colFatal = detectedFatalColumn >= 0 ? detectedFatalColumn : 1;
      const colDossie = findColumn(headers, ["dossi", "dossie"]);
      const colProcesso = findColumn(headers, ["processo"]);
      const colReu = findColumn(headers, ["réu", "reu"]);
      const colAutor = findColumn(headers, ["autor"]);
      const colEquipe = findColumn(headers, ["equipe"]);
      const colDecisao = findColumn(headers, ["decisão", "decisao"]);
      const colFormulario = findColumn(headers, ["formulário", "formulario"]);
      const colProvidencias = findColumn(headers, ["providências", "providencias"]);
      const colDeposito = findColumn(headers, ["dep", "depósito", "deposito"]);
      const colPreparo = findColumn(headers, ["preparo"]);
      const colMulta = findColumn(headers, ["multa", "custas"]);
      const colResponsavel = findColumn(headers, ["responsável", "responsavel"]);
      setProgress(55);

      console.log("[TST Import] Column indices:", {
        colFatal,
        colProcesso,
        colDossie,
        colReu,
        colAutor,
        fatalHeader: headers[colFatal] ?? null,
        detectedFatalColumn,
      });
      if (detectedFatalColumn < 0) {
        console.warn("[TST Import] Coluna de data fatal não identificada pelos cabeçalhos; usando fallback para a coluna índice 1.", {
          fallbackHeader: headers[1] ?? null,
          headers,
        });
      }

      // Fetch existing processos for matching (by numero and by digits)
      const { data: processos } = await supabase.from("processos").select("id, numero");
      const processosMapDigits = new Map<string, string>();
      const processosMapNumero = new Map<string, string>();
      processos?.forEach((p) => {
        if (p.numero) processosMapNumero.set(p.numero.trim(), p.id);
        const digits = (p.numero || "").replace(/\D/g, "");
        if (digits.length >= 10) processosMapDigits.set(digits, p.id);
      });

      const parsed: ProcessoTstImport[] = [];
      const seenNumeros = new Map<string, number>();
      const totalRows = Math.max(rows.length - 1, 1);
      let skippedCount = 0;
      let dateDebugCount = 0;

      const dataStartRow = headerRowIdx + 1;
      console.log("[TST Import] Data starts at row index:", dataStartRow, "(Excel row", dataStartRow + 1, ")");

      for (let i = dataStartRow; i < rows.length; i++) {
        const row = rows[i];
        const excelRowIdx = i; // rows array is 0-indexed matching Excel sheet rows
        const fatalCell = colFatal >= 0 ? ws[XLSX.utils.encode_cell({ r: excelRowIdx, c: colFatal })] : undefined;
        const rawFatalValue = fatalCell?.v ?? row[colFatal];
        const formattedFatalValue = fatalCell?.w ?? null;
        const parsedFromFormatted = formattedFatalValue ? parseExcelDate(formattedFatalValue) : null;
        const parsedFromRaw = parseExcelDate(rawFatalValue);
        const dataFatal = parsedFromFormatted ?? parsedFromRaw;
        const numProc = colProcesso >= 0 ? String(row[colProcesso] || "").trim() : "";

        if (dateDebugCount < 12 && (formattedFatalValue || rawFatalValue || numProc)) {
          console.log("[TST Import] Date parse sample", {
            excelRow: i + 1,
            processo: numProc || null,
            header: headers[colFatal] ?? null,
            cellType: fatalCell?.t ?? null,
            rawFatalValue,
            formattedFatalValue,
            parsedFromFormatted,
            parsedFromRaw,
            chosenDataFatal: dataFatal,
          });
          dateDebugCount++;
        }

        if (!dataFatal && !numProc) {
          skippedCount++;
          continue;
        }

        let existingId: string | null = null;
        if (numProc) {
          existingId = processosMapNumero.get(numProc) ?? null;
        }
        if (!existingId) {
          const digits = numProc.replace(/\D/g, "");
          if (digits.length >= 10) {
            existingId = processosMapDigits.get(digits) ?? null;
          }
        }

        const item: ProcessoTstImport = {
          _existing_id: existingId,
          numero: numProc || "SEM-NUMERO",
          coordenacao_id: coordenacaoId && coordenacaoId !== "todas" ? coordenacaoId : null,
          polo_ativo: colAutor >= 0 ? String(row[colAutor] || "").trim() || null : null,
          polo_passivo: colReu >= 0 ? String(row[colReu] || "").trim() || null : null,
          dossie_tst: colDossie >= 0 ? String(row[colDossie] || "").trim() || null : null,
          equipe_tst: colEquipe >= 0 ? String(row[colEquipe] || "").trim() || null : null,
          decisao_tst: colDecisao >= 0 ? String(row[colDecisao] || "").trim() || null : null,
          formulario_tst: colFormulario >= 0 ? String(row[colFormulario] || "").trim() || null : null,
          providencias_tst: colProvidencias >= 0 ? String(row[colProvidencias] || "").trim() || null : null,
          deposito_judicial_tst: colDeposito >= 0 ? String(row[colDeposito] || "").trim() || null : null,
          preparo_tst: colPreparo >= 0 ? String(row[colPreparo] || "").trim() || null : null,
          multa_custas_tst: colMulta >= 0 ? String(row[colMulta] || "").trim() || null : null,
          responsavel_tst: colResponsavel >= 0 ? String(row[colResponsavel] || "").trim() || null : null,
          data_fatal: dataFatal,
          area: "trabalhista",
          status: "ativo",
        };

        const dedupeKey = numProc || `row-${i}`;
        if (numProc && seenNumeros.has(dedupeKey)) {
          const prevIdx = seenNumeros.get(dedupeKey)!;
          parsed[prevIdx] = item;
        } else {
          seenNumeros.set(dedupeKey, parsed.length);
          parsed.push(item);
        }

        if (i % 25 === 0 || i === rows.length - 1) {
          setProgress(55 + Math.round((i / totalRows) * 45));
        }
      }

      const dedupedParsed = parsed.filter(Boolean);
      console.log("[TST Import] Parsed:", dedupedParsed.length, "Skipped:", skippedCount);
      
      if (dedupedParsed.length === 0) {
        toast.warning("Nenhum registro válido encontrado na planilha. Verifique se as colunas 'Processo' e datas fatais estão preenchidas.");
      }
      
      setPreview(dedupedParsed);
      setProgress(100);
    } catch (err) {
      console.error("[TST Import] Error:", err);
      toast.error("Erro ao processar a planilha. Verifique o formato do arquivo.");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    const effectiveCoordId = coordenacaoId && coordenacaoId !== "todas" ? coordenacaoId : null;
    if (!effectiveCoordId || preview.length === 0) return;

    // Inject criado_por_tst and responsavel_tst_id into all items
    const enrichedItems = preview.map((item) => ({
      ...item,
      criado_por_tst: user?.id || null,
      responsavel_tst_id: defaultResponsavelId || null,
      coordenacao_id: effectiveCoordId,
    }));

    if (clearBefore) {
      await onClearAndImport({ coordenacaoId: effectiveCoordId, items: enrichedItems });
    } else {
      await onImport(enrichedItems);
    }

    setPreview([]);
    setProgress(0);
    setDefaultResponsavelId("");
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Planilha TST</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Coordenação</Label>
            <Select value={coordenacaoId ?? ""} onValueChange={onCoordenacaoChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a coordenação" />
              </SelectTrigger>
              <SelectContent>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Responsável padrão (para prazos sem responsável)</Label>
            <Select value={defaultResponsavelId} onValueChange={setDefaultResponsavelId} disabled={!activeCoordId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={activeCoordId ? "Selecione o responsável" : "Selecione a coordenação primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {membros.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Este membro será o responsável por todos os prazos importados. Os prazos aparecerão na agenda dele e de quem está cadastrando.
            </p>
          </div>

          <div>
            <Label>Arquivo XLSX</Label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="mt-1 block w-full text-sm" />
          </div>
          {(parsing || progress > 0) && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {parsing ? "Processando planilha..." : `${preview.length} registros encontrados`}
              </p>
            </div>
          )}
          {preview.length > 0 && !parsing && (
            <div className="flex items-center gap-2">
              <Checkbox id="clear" checked={clearBefore} onCheckedChange={(v) => setClearBefore(!!v)} />
              <Label htmlFor="clear" className="text-sm">Substituir dados TST da coordenação</Label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!activeCoordId || preview.length === 0 || isImporting || parsing}>
              <Upload className="w-4 h-4 mr-1" />
              {isImporting ? "Importando..." : `Importar ${preview.length} registros`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
