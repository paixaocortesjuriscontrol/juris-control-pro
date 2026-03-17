import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PrazoTstInsert } from "@/hooks/usePrazosTst";

interface Props {
  open: boolean;
  onClose: () => void;
  coordenacaoId: string | null;
  coordenacoes: { id: string; nome: string }[];
  onImport: (prazos: PrazoTstInsert[]) => Promise<any>;
  onClearAndImport: (data: { coordenacaoId: string; prazos: PrazoTstInsert[] }) => Promise<any>;
  isImporting: boolean;
  onCoordenacaoChange: (id: string) => void;
}

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  if (typeof val === "string") {
    const normalized = val.trim();

    const brDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brDate) {
      return `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
      return normalized.slice(0, 10);
    }

    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
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
      row.push(cell?.w ?? cell?.v ?? "");
    }

    rows.push(row);
  }

  return rows;
}

export function TstImportDialog({
  open,
  onClose,
  coordenacaoId,
  coordenacoes,
  onImport,
  onClearAndImport,
  isImporting,
  onCoordenacaoChange,
}: Props) {
  const [clearBefore, setClearBefore] = useState(true);
  const [preview, setPreview] = useState<PrazoTstInsert[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setPreview([]);
    setProgress(10);

    const ab = await file.arrayBuffer();
    setProgress(25);

    const wb = XLSX.read(ab, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = getSheetRows(ws);

    setProgress(40);

    if (rows.length < 2) {
      setParsing(false);
      setProgress(0);
      return;
    }

    const headers = rows[0].map((h) => String(h ?? ""));

    const colFatal = findColumn(headers, ["fatal"]);
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

    const { data: processos } = await supabase.from("processos").select("id, numero");
    const processosMap = new Map<string, string>();
    processos?.forEach((p) => {
      const digits = (p.numero || "").replace(/\D/g, "");
      if (digits.length >= 10) processosMap.set(digits, p.id);
    });

    const parsed: PrazoTstInsert[] = [];
    const totalRows = Math.max(rows.length - 1, 1);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dataFatal = colFatal >= 0 ? parseExcelDate(row[colFatal]) : null;
      const numProc = colProcesso >= 0 ? String(row[colProcesso] || "").trim() : "";

      if (!dataFatal && !numProc) continue;

      let processoId: string | null = null;
      const digits = numProc.replace(/\D/g, "");
      if (digits.length >= 10) {
        processoId = processosMap.get(digits) ?? null;
      }

      parsed.push({
        coordenacao_id: coordenacaoId,
        processo_id: processoId,
        numero_processo: numProc || null,
        dossie: colDossie >= 0 ? String(row[colDossie] || "").trim() || null : null,
        reu: colReu >= 0 ? String(row[colReu] || "").trim() || null : null,
        autor: colAutor >= 0 ? String(row[colAutor] || "").trim() || null : null,
        equipe: colEquipe >= 0 ? String(row[colEquipe] || "").trim() || null : null,
        decisao: colDecisao >= 0 ? String(row[colDecisao] || "").trim() || null : null,
        formulario: colFormulario >= 0 ? String(row[colFormulario] || "").trim() || null : null,
        providencias: colProvidencias >= 0 ? String(row[colProvidencias] || "").trim() || null : null,
        deposito_judicial: colDeposito >= 0 ? String(row[colDeposito] || "").trim() || null : null,
        preparo: colPreparo >= 0 ? String(row[colPreparo] || "").trim() || null : null,
        multa_custas: colMulta >= 0 ? String(row[colMulta] || "").trim() || null : null,
        responsavel: colResponsavel >= 0 ? String(row[colResponsavel] || "").trim() || null : null,
        data_fatal: dataFatal,
      });

      if (i % 25 === 0 || i === rows.length - 1) {
        setProgress(55 + Math.round((i / totalRows) * 45));
      }
    }

    setPreview(parsed);
    setParsing(false);
    setProgress(100);
  };

  const handleConfirm = async () => {
    if (!coordenacaoId || preview.length === 0) return;

    if (clearBefore) {
      await onClearAndImport({ coordenacaoId, prazos: preview });
    } else {
      await onImport(preview);
    }

    setPreview([]);
    setProgress(0);
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
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="clear" className="text-sm">Substituir todos os dados da coordenação</Label>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!coordenacaoId || preview.length === 0 || isImporting || parsing}>
              <Upload className="w-4 h-4 mr-1" />
              {isImporting ? "Importando..." : `Importar ${preview.length} registros`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
