import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

interface ColumnAnalysis {
  name: string;
  sampleValues: (string | number | null)[];
  uniqueValues: number;
  nullCount: number;
  type: "text" | "number" | "date" | "boolean" | "mixed";
}

interface AnalysisResult {
  totalRows: number;
  columns: ColumnAnalysis[];
  rawHeaders: string[];
  sampleData: Record<string, any>[];
}

export function useAnalisePlanilhaTarefas() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeFile = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new Error("Planilha sem abas");

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new Error("Aba principal não encontrada");

      // Parse with headers from row 3 (range: 2 to skip Projuris headers)
      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        range: 2,
      });

      if (jsonData.length === 0) {
        throw new Error("Planilha vazia ou sem dados");
      }

      // Get all column headers
      const firstRow = jsonData[0] as Record<string, any>;
      const headers = Object.keys(firstRow);

      // Analyze each column
      const columns: ColumnAnalysis[] = headers.map((header) => {
        const values = jsonData.map((row: any) => row[header]);
        const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
        const uniqueSet = new Set(nonNullValues.map(String));

        // Determine type
        let type: "text" | "number" | "date" | "boolean" | "mixed" = "text";
        const sampleNonNull = nonNullValues.slice(0, 10);

        if (sampleNonNull.length > 0) {
          const types = sampleNonNull.map((v) => {
            if (typeof v === "number") return "number";
            if (typeof v === "boolean") return "boolean";
            if (typeof v === "string") {
              // Check if date
              if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(v) || /^\d{4}-\d{2}-\d{2}/.test(v)) {
                return "date";
              }
            }
            return "text";
          });

          const uniqueTypes = [...new Set(types)];
          if (uniqueTypes.length === 1) {
            type = uniqueTypes[0] as any;
          } else {
            type = "mixed";
          }
        }

        return {
          name: header,
          sampleValues: nonNullValues.slice(0, 5),
          uniqueValues: uniqueSet.size,
          nullCount: values.length - nonNullValues.length,
          type,
        };
      });

      // Get sample data (first 10 rows)
      const sampleData = jsonData.slice(0, 10) as Record<string, any>[];

      setAnalysis({
        totalRows: jsonData.length,
        columns,
        rawHeaders: headers,
        sampleData,
      });
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze the file from public folder
  const analyzeFromPublic = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Arquivo não encontrado: ${path}`);
      
      const blob = await response.blob();
      const file = new File([blob], "temp.xlsx", { type: blob.type });
      await analyzeFile(file);
    } catch (err: any) {
      setError(err?.message || String(err));
      setLoading(false);
    }
  };

  return {
    analysis,
    loading,
    error,
    analyzeFile,
    analyzeFromPublic,
  };
}
