import { describe, expect, test } from "bun:test";
import { contarPor } from "../src/lib/exportWorkflowsExcel";
describe("Resumo do Excel de workflows", () => {
  test("conta por pessoa e ordena do maior para o menor", () => {
    expect(contarPor(["Lis", "Ana", "Lis", "Lis", "Ana", "Bia"])).toEqual([["Lis", 3], ["Ana", 2], ["Bia", 1]]);
  });
});
