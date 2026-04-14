import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extrairOrgaoJulgador, derivarRelatorDaTurma, type MovimentoBruto } from "./extrair-relator.ts";

Deno.test("extrai turma e relator de movimento de distribuição TST", () => {
  const movimentos: MovimentoBruto[] = [
    {
      step_date: "2025-07-02T00:00:00Z",
      content:
        "Distribuído por sorteio em 02/07/2025 ao Ministro Augusto César Leite de Carvalho - 6ª Turma",
      code: "26",
    },
  ];
  const result = extrairOrgaoJulgador(movimentos);
  assertEquals(result.turma, "6ª Turma");
  assertEquals(result.relator, "Augusto César Leite de Carvalho");
  assertEquals(result.data_distribuicao, "2025-07-02");
  assertEquals(result.fonte, "movimento_distribuicao");
});

Deno.test("lista vazia retorna tudo null com fonte nao_encontrado", () => {
  const result = extrairOrgaoJulgador([]);
  assertEquals(result.turma, null);
  assertEquals(result.relator, null);
  assertEquals(result.data_distribuicao, null);
  assertEquals(result.fonte, "nao_encontrado");
});

Deno.test("movimentos sem distribuição retorna nao_encontrado", () => {
  const movimentos: MovimentoBruto[] = [
    {
      step_date: "2025-06-10T00:00:00Z",
      content: "Juntada de petição",
    },
    {
      step_date: "2025-06-15T00:00:00Z",
      content: "Conclusos os autos ao juiz",
    },
  ];
  const result = extrairOrgaoJulgador(movimentos);
  assertEquals(result.turma, null);
  assertEquals(result.relator, null);
  assertEquals(result.fonte, "nao_encontrado");
});

Deno.test("dois movimentos de distribuição usa o mais recente (redistribuição)", () => {
  const movimentos: MovimentoBruto[] = [
    {
      step_date: "2025-01-10T00:00:00Z",
      content:
        "Distribuído por sorteio em 10/01/2025 ao Ministro João Batista Brito Pereira - 5ª Turma",
      code: "26",
    },
    {
      step_date: "2025-06-20T00:00:00Z",
      content:
        "Redistribuído ao Ministro Cláudio Mascarenhas Brandão - 7ª Turma",
    },
  ];
  const result = extrairOrgaoJulgador(movimentos);
  assertEquals(result.turma, "7ª Turma");
  assertEquals(result.relator, "Cláudio Mascarenhas Brandão");
  assertEquals(result.data_distribuicao, "2025-06-20");
  assertEquals(result.fonte, "movimento_redistribuicao");
});

Deno.test("extrai relator sem turma", () => {
  const movimentos: MovimentoBruto[] = [
    {
      step_date: "2025-03-01T00:00:00Z",
      content: "Distribuído ao Ministro Alberto Balazeiro",
      code: "26",
    },
  ];
  const result = extrairOrgaoJulgador(movimentos);
  assertEquals(result.relator, "Alberto Balazeiro");
  assertEquals(result.turma, null);
  assertEquals(result.fonte, "movimento_distribuicao");
});

Deno.test("extrai via código CNJ 51", () => {
  const movimentos: MovimentoBruto[] = [
    {
      step_date: "2025-04-01T00:00:00Z",
      content: "Conclusão para o Ministro Relator Mauricio Godinho Delgado - 3ª Turma",
      code: "51",
    },
  ];
  const result = extrairOrgaoJulgador(movimentos);
  assertEquals(result.relator, "Mauricio Godinho Delgado");
  assertEquals(result.turma, "3ª Turma");
});

Deno.test("extrai SBDI do texto", () => {
  const movimentos: MovimentoBruto[] = [
    {
      step_date: "2025-05-01T00:00:00Z",
      content: "Distribuído ao Ministro Lelio Bentes Corrêa - SBDI-1",
      code: "26",
    },
  ];
  const result = extrairOrgaoJulgador(movimentos);
  assertEquals(result.relator, "Lelio Bentes Corrêa");
  assertEquals(result.turma, "SBDI-1");
});
