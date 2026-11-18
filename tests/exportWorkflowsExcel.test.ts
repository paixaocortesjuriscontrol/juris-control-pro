import { afterEach, describe, expect, spyOn, test } from "bun:test";
import ExcelJS from "exceljs";
import { supabase } from "../src/integrations/supabase/client";
import { contarPor, exportarWorkflowsExcel } from "../src/lib/exportWorkflowsExcel";

afterEach(() => {
  delete (globalThis as any).document;
});

describe("Resumo do Excel de workflows", () => {
  test("conta por pessoa e ordena do maior para o menor", () => {
    expect(contarPor(["Lis", "Ana", "Lis", "Lis", "Ana", "Bia"])).toEqual([["Lis", 3], ["Ana", 2], ["Bia", 1]]);
  });

  test("preenche a coluna Processo com o numero cadastrado no processo", async () => {
    const numero = "0001234-56.2026.5.02.0001";
    let arquivo: Blob | undefined;
    const fromSpy = spyOn(supabase, "from").mockImplementation(((tabela: string) => {
      let campos = "";
      return {
        select(camposSelecionados: string) {
          campos = camposSelecionados;
          return this;
        },
        async in() {
          if (tabela === "processos") {
            if (campos !== "id, numero") return { data: null, error: new Error("Campo do numero incorreto") };
            return { data: [{ id: "proc-1", numero }], error: null };
          }
          if (tabela === "profiles_basic") return { data: [{ id: "user-1", nome: "Giovanna" }], error: null };
          return { data: [], error: null };
        },
      };
    }) as any);
    const createUrlSpy = spyOn(URL, "createObjectURL").mockImplementation((blob: Blob) => {
      arquivo = blob;
      return "blob:workflow-teste";
    });
    const revokeUrlSpy = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const timeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as any);
    const anchor = { href: "", download: "", click() {}, remove() {} };
    (globalThis as any).document = {
      createElement: () => anchor,
      body: { appendChild: () => anchor },
    };

    try {
      await exportarWorkflowsExcel([
        {
          id: "exec-1",
          created_at: "2026-11-17T15:00:00.000Z",
          processo_id: "proc-1",
          iniciado_por: "user-1",
          coordenacao_id: "coord-1",
          status: "em_andamento",
          workflow: { nome: "Analise", coordenacao: { nome: "Santander Civel" } },
        },
      ], {}, { inicio: "2026-11-17", fim: "2026-11-17" });

      expect(arquivo).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await arquivo!.arrayBuffer());
      expect(wb.getWorksheet("Workflows")!.getCell("D3").value).toBe(numero);
    } finally {
      fromSpy.mockRestore();
      createUrlSpy.mockRestore();
      revokeUrlSpy.mockRestore();
      timeoutSpy.mockRestore();
    }
  });
});
