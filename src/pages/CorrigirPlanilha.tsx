import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";

interface Stats {
  totalCarga: number;
  duplicatasRemovidas: number;
  cejuscRemovidas: number;
  bennerSimRemovidas: number;
  processoIgualDossie: number;
  totalFinal: number;
}

export default function CorrigirPlanilha() {
  const [distFile, setDistFile] = useState<File | null>(null);
  const [cargaFile, setCargaFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [distResultBlob, setDistResultBlob] = useState<Blob | null>(null);

  const readFile = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });

  const normalize = (val: unknown): string =>
    String(val ?? "").trim().toUpperCase();

  const normalizeForCompare = (val: unknown): string =>
    String(val ?? "").trim().replace(/\s+/g, "").toUpperCase();


  const processar = useCallback(async () => {
    if (!distFile || !cargaFile) {
      toast.error("Selecione ambas as planilhas");
      return;
    }
    setProcessing(true);
    setStats(null);
    setResultBlob(null);
    setDistResultBlob(null);

    try {
      const [distBuf, cargaBuf] = await Promise.all([readFile(distFile), readFile(cargaFile)]);

      // === DISTRIBUTION: read with XLSX for Benner SIM and build dossier set ===
      const distWb = XLSX.read(new Uint8Array(distBuf), { type: "array" });
      const bennerSimContracts = new Set<string>();
      let bennerSimEncontrados = 0;
      const processoIgualDossieDossies = new Set<string>();

      for (const sheetName of distWb.SheetNames) {
        const ws = distWb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          // Detect processo (col B) = dossiê (col C) in distribution
          const procDist = normalizeForCompare(row[1]);
          const dossDist = normalizeForCompare(row[2]);
          const procDigits = String(row[1] ?? "").replace(/\D/g, "");
          const dossDigits = String(row[2] ?? "").replace(/\D/g, "");
          if (procDist && dossDist && (procDist === dossDist || (procDigits.length >= 7 && procDigits === dossDigits))) {
            processoIgualDossieDossies.add(normalize(row[2]));
          }
          const bennerAtualizado = normalize(row[26]); // col AA
          if (bennerAtualizado === "SIM") {
            bennerSimEncontrados++;
            const dossie = normalize(row[2]); // col C = dossiê
            if (dossie) bennerSimContracts.add(dossie);
          }
        }
      }

      // === Generate distribution result via JSZip — detect and paint problematic rows directly from XML ===
      const distZip = await JSZip.loadAsync(distBuf.slice(0));
      const distParser = new DOMParser();
      const distSerializer = new XMLSerializer();
      let dossieIgualProcesso = 0;

      // Parse shared strings from distribution file
      const distSstXml = await distZip.file("xl/sharedStrings.xml")?.async("string");
      const distSharedStrings: string[] = [];
      if (distSstXml) {
        const distSstDoc = distParser.parseFromString(distSstXml, "application/xml");
        const distSstNs = distSstDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const siEls = Array.from(distSstDoc.getElementsByTagNameNS(distSstNs, "si"));
        for (const si of siEls) {
          const tEls = si.getElementsByTagNameNS(distSstNs, "t");
          distSharedStrings.push(tEls.length > 0 ? Array.from(tEls).map(t => t.textContent || "").join("") : "");
        }
      }

      // Helper to read cell value from XML element
      const readCellValue = (cell: Element, ns: string, strings: string[]): string => {
        const cellType = cell.getAttribute("t");
        if (cellType === "s") {
          const vEl = cell.getElementsByTagNameNS(ns, "v")[0];
          const idx = parseInt(vEl?.textContent || "0", 10);
          return strings[idx] || "";
        }
        if (cellType === "inlineStr") {
          const tEls = cell.getElementsByTagNameNS(ns, "t");
          return tEls.length > 0 ? tEls[0].textContent || "" : "";
        }
        const vEl = cell.getElementsByTagNameNS(ns, "v")[0];
        return vEl?.textContent || "";
      };

      // Discover dist sheet paths
      const wbXml = await distZip.file("xl/workbook.xml")?.async("string");
      const wbRelsXml = await distZip.file("xl/_rels/workbook.xml.rels")?.async("string");
      const distSheetPaths: { index: number; path: string }[] = [];

      if (wbXml && wbRelsXml) {
        const wbDoc = distParser.parseFromString(wbXml, "application/xml");
        const relsDoc = distParser.parseFromString(wbRelsXml, "application/xml");
        const wbNs = wbDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const relsNs = relsDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/package/2006/relationships";
        const sheetEls = Array.from(wbDoc.getElementsByTagNameNS(wbNs, "sheet"));
        for (let si = 0; si < sheetEls.length; si++) {
          const rId = sheetEls[si].getAttribute("r:id") || sheetEls[si].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
          const rel = rId ? Array.from(relsDoc.getElementsByTagNameNS(relsNs, "Relationship")).find(n => n.getAttribute("Id") === rId) : null;
          const target = rel?.getAttribute("Target");
          if (target) {
            distSheetPaths.push({ index: si, path: `xl/${target.replace(/^\/+/, "").replace(/^xl\//, "")}` });
          }
        }
      }
      if (distSheetPaths.length === 0) distSheetPaths.push({ index: 0, path: "xl/worksheets/sheet1.xml" });

      // Add red fill + black font style to styles.xml
      const stylesPath = "xl/styles.xml";
      const stylesXml = await distZip.file(stylesPath)?.async("string");
      let redStyleIndex = "0";

      if (stylesXml) {
        const stylesDoc = distParser.parseFromString(stylesXml, "application/xml");
        const ns = stylesDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

        const fonts = stylesDoc.getElementsByTagNameNS(ns, "fonts")[0];
        const fontCount = fonts ? Number(fonts.getAttribute("count") || "0") : 0;
        const newFontIdx = fontCount;
        if (fonts) {
          const fontEl = stylesDoc.createElementNS(ns, "font");
          const szEl = stylesDoc.createElementNS(ns, "sz"); szEl.setAttribute("val", "11");
          const colorEl = stylesDoc.createElementNS(ns, "color"); colorEl.setAttribute("rgb", "FF000000");
          const nameEl = stylesDoc.createElementNS(ns, "name"); nameEl.setAttribute("val", "Calibri");
          fontEl.appendChild(szEl); fontEl.appendChild(colorEl); fontEl.appendChild(nameEl);
          fonts.appendChild(fontEl);
          fonts.setAttribute("count", String(fontCount + 1));
        }

        const fills = stylesDoc.getElementsByTagNameNS(ns, "fills")[0];
        const fillCount = fills ? Number(fills.getAttribute("count") || "0") : 0;
        const newFillIdx = fillCount;
        if (fills) {
          const fillEl = stylesDoc.createElementNS(ns, "fill");
          const patternEl = stylesDoc.createElementNS(ns, "patternFill"); patternEl.setAttribute("patternType", "solid");
          const fgColor = stylesDoc.createElementNS(ns, "fgColor"); fgColor.setAttribute("rgb", "FFFF0000");
          const bgColor = stylesDoc.createElementNS(ns, "bgColor"); bgColor.setAttribute("indexed", "64");
          patternEl.appendChild(fgColor); patternEl.appendChild(bgColor);
          fillEl.appendChild(patternEl);
          fills.appendChild(fillEl);
          fills.setAttribute("count", String(fillCount + 1));
        }

        const cellXfs = stylesDoc.getElementsByTagNameNS(ns, "cellXfs")[0];
        const xfCount = cellXfs ? Number(cellXfs.getAttribute("count") || "0") : 0;
        redStyleIndex = String(xfCount);
        if (cellXfs) {
          const xfEl = stylesDoc.createElementNS(ns, "xf");
          xfEl.setAttribute("fontId", String(newFontIdx));
          xfEl.setAttribute("fillId", String(newFillIdx));
          xfEl.setAttribute("borderId", "0");
          xfEl.setAttribute("numFmtId", "0");
          xfEl.setAttribute("xfId", "0");
          xfEl.setAttribute("applyFont", "1");
          xfEl.setAttribute("applyFill", "1");
          const alignment = stylesDoc.createElementNS(ns, "alignment");
          alignment.setAttribute("horizontal", "center");
          alignment.setAttribute("vertical", "center");
          xfEl.appendChild(alignment);
          cellXfs.appendChild(xfEl);
          cellXfs.setAttribute("count", String(xfCount + 1));
        }

        distZip.file(stylesPath, distSerializer.serializeToString(stylesDoc));
      }

      // Detect and paint problematic rows directly from XML (correct row numbers)
      for (const { path: worksheetPath } of distSheetPaths) {
        const sheetXml = await distZip.file(worksheetPath)?.async("string");
        if (!sheetXml) continue;

        const sheetDoc = distParser.parseFromString(sheetXml, "application/xml");
        const sheetNs = sheetDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const sheetDataEl = sheetDoc.getElementsByTagNameNS(sheetNs, "sheetData")[0];
        if (!sheetDataEl) continue;

        let changed = false;
        const allRows = Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row")).filter(r => r.parentNode === sheetDataEl);

        for (const rowEl of allRows) {
          const rn = Number(rowEl.getAttribute("r"));
          const cells = Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter(c => c.parentNode === rowEl);

          // Find col B and col C cells
          let colBVal = "";
          let colCVal = "";
          for (const cell of cells) {
            const ref = cell.getAttribute("r") || "";
            const colLetters = ref.replace(/\d+/g, "");
            if (colLetters === "B") colBVal = readCellValue(cell, sheetNs, distSharedStrings);
            else if (colLetters === "C") colCVal = readCellValue(cell, sheetNs, distSharedStrings);
          }

          const processoNorm = normalizeForCompare(colBVal);
          const dossieNorm = normalizeForCompare(colCVal);
          const processoDigits = colBVal.replace(/\D/g, "");
          const dossieDigits = colCVal.replace(/\D/g, "");

          // Match by exact text OR by digits only (covers formatting differences)
          const isMatch = processoNorm && dossieNorm && (
            processoNorm === dossieNorm ||
            (processoDigits.length >= 7 && processoDigits === dossieDigits)
          );

          if (isMatch) {
            dossieIgualProcesso++;
            changed = true;
            // Paint all cells in this row red
            for (const cell of cells) {
              cell.setAttribute("s", redStyleIndex);
            }
          }
        }

        if (changed) {
          distZip.file(worksheetPath, distSerializer.serializeToString(sheetDoc));
        }
      }

      if (dossieIgualProcesso > 0) {
        const distBlob = await distZip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        setDistResultBlob(distBlob);
      }

      // === CARGA BENNER: JSZip row removal preserving styles ===
      const cargaWb = XLSX.read(new Uint8Array(cargaBuf), { type: "array", cellDates: true });

      const rowsToRemovePerSheet: Map<number, Set<number>> = new Map();
      let duplicatasRemovidas = 0;
      let cejuscRemovidas = 0;
      let bennerSimRemovidasNaCarga = 0;
      let totalCarga = 0;
      let processoIgualDossieRemovidas = 0;

      const CARGA_HEADER_ROWS = 2;
      const CARGA_DATA_START_ROW = CARGA_HEADER_ROWS + 1;
      const LAST_ALLOWED_DATA_COL_IDX = 6; // G

      for (let si = 0; si < cargaWb.SheetNames.length; si++) {
        const ws = cargaWb.Sheets[cargaWb.SheetNames[si]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
        if (rows.length < CARGA_DATA_START_ROW) continue;

        const dataRows = rows.slice(CARGA_HEADER_ROWS);
        totalCarga += dataRows.length;
        const removeSet = new Set<number>();

        // Step 1: Remove CEJUSC
        for (let i = 0; i < dataRows.length; i++) {
          const colF = normalize(dataRows[i][5]);
          if (colF.includes("CEJUSC")) { cejuscRemovidas++; removeSet.add(i + CARGA_DATA_START_ROW); }
        }

        // Step 2: Remove duplicates FIRST (so Benner SIM doesn't double-count)
        const seen = new Set<string>();
        for (let i = 0; i < dataRows.length; i++) {
          const excelRow = i + CARGA_DATA_START_ROW;
          if (removeSet.has(excelRow)) continue;
          const key = `${normalize(dataRows[i][0])}|${normalize(dataRows[i][1])}`;
          if (seen.has(key)) { duplicatasRemovidas++; removeSet.add(excelRow); }
          else seen.add(key);
        }

        // Step 3: Remove processo = dossiê (using dossiês identified in distribution)
        for (let i = 0; i < dataRows.length; i++) {
          const excelRow = i + CARGA_DATA_START_ROW;
          if (removeSet.has(excelRow)) continue;
          const dossieVal = normalize(dataRows[i][0]);
          if (dossieVal && processoIgualDossieDossies.has(dossieVal)) {
            processoIgualDossieRemovidas++; removeSet.add(excelRow);
          }
        }

        // Step 4: Remove Benner SIM (after dedup, so each dossiê counted once)
        for (let i = 0; i < dataRows.length; i++) {
          const excelRow = i + CARGA_DATA_START_ROW;
          if (removeSet.has(excelRow)) continue;
          const dossie = normalize(dataRows[i][0]);
          if (dossie && bennerSimContracts.has(dossie)) {
            bennerSimRemovidasNaCarga++; removeSet.add(excelRow);
          }
        }

        if (removeSet.size > 0) rowsToRemovePerSheet.set(si, removeSet);
      }

      const totalFinal = totalCarga - duplicatasRemovidas - cejuscRemovidas - processoIgualDossieRemovidas - bennerSimRemovidasNaCarga;

      // JSZip manipulation for carga
      const zip = await JSZip.loadAsync(cargaBuf);
      const parser = new DOMParser();
      const serializer = new XMLSerializer();

      const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
      const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
      const sheetPaths: { index: number; path: string }[] = [];

      if (workbookXml && workbookRelsXml) {
        const wbDoc = parser.parseFromString(workbookXml, "application/xml");
        const relsDoc = parser.parseFromString(workbookRelsXml, "application/xml");
        const wbNs = wbDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const relsNs = relsDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/package/2006/relationships";
        const sheetEls = Array.from(wbDoc.getElementsByTagNameNS(wbNs, "sheet"));
        for (let si = 0; si < sheetEls.length; si++) {
          const rId = sheetEls[si].getAttribute("r:id") || sheetEls[si].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
          const rel = rId ? Array.from(relsDoc.getElementsByTagNameNS(relsNs, "Relationship")).find(n => n.getAttribute("Id") === rId) : null;
          const target = rel?.getAttribute("Target");
          if (target) {
            sheetPaths.push({ index: si, path: `xl/${target.replace(/^\/+/, "").replace(/^xl\//, "")}` });
          }
        }
      }
      if (sheetPaths.length === 0) sheetPaths.push({ index: 0, path: "xl/worksheets/sheet1.xml" });

      for (const { index: sheetIdx, path: worksheetPath } of sheetPaths) {
        const removeSet = rowsToRemovePerSheet.get(sheetIdx) || new Set<number>();

        const sheetXml = await zip.file(worksheetPath)?.async("string");
        if (!sheetXml) continue;

        const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
        const sheetNs = sheetDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const sheetDataEl = sheetDoc.getElementsByTagNameNS(sheetNs, "sheetData")[0];
        if (!sheetDataEl) continue;

        const allRows = Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row")).filter(r => r.parentNode === sheetDataEl);

        // Remove flagged rows
        for (const rowEl of allRows) {
          if (removeSet.has(Number(rowEl.getAttribute("r")))) sheetDataEl.removeChild(rowEl);
        }

        const remainingRows = Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row"))
          .filter(r => r.parentNode === sheetDataEl)
          .sort((a, b) => Number(a.getAttribute("r")) - Number(b.getAttribute("r")));

        // Helper: column letters to 0-based index
        const colToIdx = (letters: string): number => {
          let v = 0;
          for (const ch of letters) v = v * 26 + (ch.charCodeAt(0) - 64);
          return v - 1;
        };
        // Helper: 0-based index to column letters
        const idxToCol = (idx: number): string => {
          let s = "";
          let n = idx + 1;
          while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
          return s;
        };

        const sortRowCells = (rowEl: Element) => {
          const cells = Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c"))
            .filter(c => c.parentNode === rowEl)
            .sort((a, b) => {
              const aRef = (a.getAttribute("r") || "").replace(/\d+/g, "");
              const bRef = (b.getAttribute("r") || "").replace(/\d+/g, "");
              return colToIdx(aRef) - colToIdx(bRef);
            });

          for (const cell of cells) rowEl.appendChild(cell);
        };

        const clearCellContent = (cell: Element) => {
          cell.removeAttribute("t");
          while (cell.firstChild) cell.removeChild(cell.firstChild);
        };

        // Remove col B (processo) in the whole sheet and shift all subsequent cols left by 1
        for (const rowEl of remainingRows) {
          const rn = Number(rowEl.getAttribute("r"));
          const cells = Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter(c => c.parentNode === rowEl);
          const toRemove: Element[] = [];
          const toShift: { cell: Element; oldIdx: number }[] = [];

          for (const cell of cells) {
            const ref = cell.getAttribute("r") || "";
            const colLetters = ref.replace(/\d+/g, "");
            const colIdx = colToIdx(colLetters);

            if (colIdx === 1) {
              toRemove.push(cell);
            } else if (colIdx >= 2) {
              toShift.push({ cell, oldIdx: colIdx });
            }
          }

          for (const cell of toRemove) rowEl.removeChild(cell);
          for (const { cell, oldIdx } of toShift) {
            cell.setAttribute("r", idxToCol(oldIdx - 1) + rn);
          }

          sortRowCells(rowEl);
        }

        // Renumber rows sequentially
        let newRowNum = 1;
        for (const rowEl of remainingRows) {
          const oldRowNum = Number(rowEl.getAttribute("r")!);
          if (oldRowNum !== newRowNum) {
            rowEl.setAttribute("r", String(newRowNum));
            const cells = Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter(c => c.parentNode === rowEl);
            for (const cell of cells) {
              const ref = cell.getAttribute("r") || "";
              cell.setAttribute("r", ref.replace(/\d+/g, "") + newRowNum);
            }
          }

          if (newRowNum >= CARGA_DATA_START_ROW) {
            const cells = Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter(c => c.parentNode === rowEl);
            for (const cell of cells) {
              const ref = cell.getAttribute("r") || "";
              const colIdx = colToIdx(ref.replace(/\d+/g, ""));
              if (colIdx > LAST_ALLOWED_DATA_COL_IDX) {
                clearCellContent(cell);
              }
            }
          }

          sortRowCells(rowEl);
          newRowNum++;
        }

        const dimEl = sheetDoc.getElementsByTagNameNS(sheetNs, "dimension")[0];
        if (dimEl) {
          const dimRef = dimEl.getAttribute("ref") || "";
          const dimMatch = dimRef.match(/^([A-Z]+)\d+:([A-Z]+)\d+$/);
          if (dimMatch) {
            const startIdx = colToIdx(dimMatch[1]);
            const endIdx = colToIdx(dimMatch[2]);
            const newStart = idxToCol(startIdx >= 2 ? startIdx - 1 : startIdx);
            const newEnd = idxToCol(endIdx >= 2 ? endIdx - 1 : Math.max(endIdx - 1, 0));
            dimEl.setAttribute("ref", `${newStart}1:${newEnd}${newRowNum - 1}`);
          }
        }

        const mergeCellsEl = sheetDoc.getElementsByTagNameNS(sheetNs, "mergeCells")[0];
        if (mergeCellsEl) {
          const merges = Array.from(mergeCellsEl.getElementsByTagNameNS(sheetNs, "mergeCell"));
          for (const m of merges) {
            const ref = m.getAttribute("ref") || "";
            const match = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
            if (!match) continue;
            const startCol = colToIdx(match[1]);
            const endCol = colToIdx(match[3]);
            const rowStart = match[2];
            const rowEnd = match[4];

            let newStartCol = startCol;
            let newEndCol = endCol;

            if (startCol === 1 && endCol === 1) {
              mergeCellsEl.removeChild(m);
              continue;
            }
            if (startCol >= 2) newStartCol -= 1;
            if (endCol >= 2) newEndCol -= 1;
            if (newEndCol < newStartCol) {
              mergeCellsEl.removeChild(m);
              continue;
            }

            m.setAttribute("ref", `${idxToCol(newStartCol)}${rowStart}:${idxToCol(newEndCol)}${rowEnd}`);
          }
          const remaining = mergeCellsEl.getElementsByTagNameNS(sheetNs, "mergeCell").length;
          if (remaining === 0) mergeCellsEl.parentNode?.removeChild(mergeCellsEl);
          else mergeCellsEl.setAttribute("count", String(remaining));
        }

        zip.file(worksheetPath, serializer.serializeToString(sheetDoc));
      }

      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      setResultBlob(blob);
      setStats({ totalCarga, duplicatasRemovidas, cejuscRemovidas, bennerSimRemovidas: bennerSimRemovidasNaCarga, processoIgualDossie: processoIgualDossieRemovidas, totalFinal });
      toast.success("Planilhas processadas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao processar: " + (err?.message || String(err)));
    } finally {
      setProcessing(false);
    }
  }, [distFile, cargaFile]);

  const makeTimeSuffix = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()}_${now.getHours().toString().padStart(2, "0")}h${now.getMinutes().toString().padStart(2, "0")}`;
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${makeTimeSuffix()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title="Corrigir Planilha" subtitle="Remova duplicatas, linhas CEJUSC e registros já atualizados no Benner">
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                Planilha de Distribuição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="dist-file" className="text-xs text-muted-foreground mb-2 block">
                Identifica Benner SIM (col AA) e marca processo = dossiê em vermelho
              </Label>
              <Input id="dist-file" type="file" accept=".xlsx,.xls" onChange={(e) => setDistFile(e.target.files?.[0] || null)} />
              {distFile && <p className="text-xs text-green-600 mt-1">✓ {distFile.name}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                Planilha Carga Benner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="carga-file" className="text-xs text-muted-foreground mb-2 block">
                Será corrigida preservando layout original (cores, fontes, centralização)
              </Label>
              <Input id="carga-file" type="file" accept=".xlsx,.xls" onChange={(e) => setCargaFile(e.target.files?.[0] || null)} />
              {cargaFile && <p className="text-xs text-green-600 mt-1">✓ {cargaFile.name}</p>}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={processar} disabled={processing || !distFile || !cargaFile} className="gap-2">
            <Upload className="w-4 h-4" />
            {processing ? "Processando..." : "Processar"}
          </Button>
          {resultBlob && (
            <Button variant="outline" onClick={() => downloadBlob(resultBlob, "Carga_Benner_Corrigida")} className="gap-2">
              <Download className="w-4 h-4" />
              Baixar Carga Corrigida
            </Button>
          )}
          {distResultBlob && (
            <Button variant="outline" onClick={() => downloadBlob(distResultBlob, "Distribuicoes_Verificada")} className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
              <Download className="w-4 h-4" />
              Baixar Distribuição (verificada)
            </Button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{stats.totalCarga}</p>
                <p className="text-xs text-muted-foreground">Total Original</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-red-600">
                  <Trash2 className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.duplicatasRemovidas}</p>
                </div>
                <p className="text-xs text-muted-foreground">Duplicatas</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-orange-600">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.cejuscRemovidas}</p>
                </div>
                <p className="text-xs text-muted-foreground">CEJUSC</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.bennerSimRemovidas}</p>
                </div>
                <p className="text-xs text-muted-foreground">Benner SIM (AA)</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.totalFinal}</p>
                </div>
                <p className="text-xs text-muted-foreground">Total Final</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-purple-600">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.processoIgualDossie}</p>
                </div>
                <p className="text-xs text-muted-foreground">Processo = Dossiê</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
