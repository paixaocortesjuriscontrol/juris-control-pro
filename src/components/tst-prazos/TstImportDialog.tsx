import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PrazoTstInsert } from "@/hooks/usePrazosTst";

interface Props {
  open: boolean;
  onClose: () => void;
  coordenacaoId: string | null;
  onImport: (prazos: PrazoTstInsert[]) => Promise<any>;
  onClearAndImport: (data: { coordenacaoId: string; prazos: PrazoTstInsert[] }) => Promise<any>;
  isImporting: boolean;
}

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof val === "string") {
    // Try dd/MM/yyyy
    const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // Try yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
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

export function TstImportDialog({ open, onClose, coordenacaoId, onImport, onClearAndImport, isImporting }: Props) {
  const [clearBefore, setClearBefore] = useState(true);
  const [preview, setPreview] = useState<PrazoTstInsert[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

    if (rows.length < 2) return;
    const headers = rows[0].map((h: any) => String(h));

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

    // Pre-fetch processos for matching
    const { data: processos } = await supabase.from("processos").select("id, numero");
    const processosMap = new Map<string, string>();
    processos?.forEach((p) => {
      const digits = (p.numero || "").replace(/\D/g, "");
      if (digits.length >= 10) processosMap.set(digits, p.id);
    });

    const parsed: PrazoTstInsert[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const dataFatal = colFatal >= 0 ? parseExcelDate(r[colFatal]) : null;
      const numProc = colProcesso >= 0 ? String(r[colProcesso] || "").trim() : "";
      if (!dataFatal && !numProc) continue; // skip empty rows
      if (!dataFatal) continue; // data_fatal is required

      let processoId: string | null = null;
      const digits = numProc.replace(/\D/g, "");
      if (digits.length >= 10) {
        processoId = processosMap.get(digits) ?? null;
      }

      parsed.push({
        coordenacao_id: coordenacaoId,
        processo_id: processoId,
        numero_processo: numProc || null,
        dossie: colDossie >= 0 ? String(r[colDossie] || "").trim() || null : null,
        reu: colReu >= 0 ? String(r[colReu] || "").trim() || null : null,
        autor: colAutor >= 0 ? String(r[colAutor] || "").trim() || null : null,
        equipe: colEquipe >= 0 ? String(r[colEquipe] || "").trim() || null : null,
        decisao: colDecisao >= 0 ? String(r[colDecisao] || "").trim() || null : null,
        formulario: colFormulario >= 0 ? String(r[colFormulario] || "").trim() || null : null,
        providencias: colProvidencias >= 0 ? String(r[colProvidencias] || "").trim() || null : null,
        deposito_judicial: colDeposito >= 0 ? String(r[colDeposito] || "").trim() || null : null,
        preparo: colPreparo >= 0 ? String(r[colPreparo] || "").trim() || null : null,
        multa_custas: colMulta >= 0 ? String(r[colMulta] || "").trim() || null : null,
        responsavel: colResponsavel >= 0 ? String(r[colResponsavel] || "").trim() || null : null,
        data_fatal: dataFatal,
      });
    }

    setPreview(parsed);
  };

  const handleConfirm = async () => {
    if (!coordenacaoId || preview.length === 0) return;
    if (clearBefore) {
      await onClearAndImport({ coordenacaoId, prazos: preview });
    } else {
      await onImport(preview);
    }
    setPreview([]);
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
            <Label>Arquivo XLSX</Label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="mt-1 block w-full text-sm" />
          </div>

          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{preview.length} registros encontrados.</p>
              <div className="flex items-center gap-2">
                <Checkbox id="clear" checked={clearBefore} onCheckedChange={(v) => setClearBefore(!!v)} />
                <Label htmlFor="clear" className="text-sm">Substituir todos os dados da coordenação</Label>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={preview.length === 0 || isImporting}>
              <Upload className="w-4 h-4 mr-1" />
              {isImporting ? "Importando..." : `Importar ${preview.length} registros`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
