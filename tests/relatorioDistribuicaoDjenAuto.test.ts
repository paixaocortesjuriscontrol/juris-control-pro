import { describe, expect, test } from "bun:test";
import { filtrarSituacao, linhasRelatorioIara, fmtDataBr, type LinhaDjenAuto } from "../src/lib/relatorioDistribuicaoDjenAuto";

const base = { dossie: null, equipe: null, centralizador: null, importado_djen_em: "2026-11-04T02:30:00Z" };
const linhas: LinhaDjenAuto[] = [
  { ...base, processo: "A", data_distribuicao_real: "2026-11-03", ja_existia_antes_djen: false },
  { ...base, processo: "B", data_distribuicao_real: "2026-11-03", ja_existia_antes_djen: true },
];

describe("relatório distribuições DJEN automático", () => {
  test("separa novos dos que já existiam", () => {
    expect(filtrarSituacao(linhas, "novos").map((l) => l.processo)).toEqual(["A"]);
    expect(filtrarSituacao(linhas, "ja_existiam").map((l) => l.processo)).toEqual(["B"]);
    expect(filtrarSituacao(linhas, "todos").length).toBe(2);
  });
  test("colunas iguais ao modelo da Dra. Iara e data DD/MM/AAAA", () => {
    const r = linhasRelatorioIara(linhas);
    expect(r[0]).toEqual(["Processo", "Dossiê", "Equipe", "Data da Distribuição", "Pedidos", "CENTRALIZADOR"]);
    expect(r[1][3]).toBe("03/11/2026");
  });
  test("lançamento usa horário de Brasília", () => {
    expect(fmtDataBr("2026-11-04T02:30:00Z")).toBe("03/11/2026");
  });
});
