import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  calcularDataFatal,
  calcularDataFatalISO,
  calcularDataPrevista,
  calcularDataPrevistaISO,
  paraISO,
} from "./datasBase";
import { definirFeriadosCache } from "./feriados";

const base = new Date(2026, 10, 16, 12, 0, 0); // segunda-feira 16/11/2026

test("com prazo: prevista é a base somada em dias úteis", () => {
  // 17,18,19,20 (sex) e 23 (seg) = 5 dias úteis
  assert.equal(paraISO(calcularDataPrevista(base, 5, "uteis")), "2026-11-23");
});

test("feriado da coordenação não conta como dia útil", () => {
  definirFeriadosCache("coord-teste", false, ["2026-11-20"]);
  // pula a sexta 20/11 feriado: 17,18,19,23,24
  assert.equal(paraISO(calcularDataPrevista(base, 5, "uteis", "coord-teste")), "2026-11-24");
});

test("dias corridos somam o calendário inteiro", () => {
  assert.equal(paraISO(calcularDataPrevista(base, 5, "corridos")), "2026-11-21");
});

test("sem prazo cadastrado: prevista é a própria data base", () => {
  assert.equal(paraISO(calcularDataPrevista(base, 0, "uteis")), "2026-11-16");
});

test("sem fatal do modelo: fatal é a data prevista", () => {
  assert.equal(paraISO(calcularDataFatal(base, 5, "uteis", null, null)), "2026-11-23");
});

test("fatal do modelo tem prioridade sobre a prevista", () => {
  assert.equal(paraISO(calcularDataFatal(base, 5, "uteis", null, "2026-12-01")), "2026-12-01");
});

test("sem prazo e sem fatal do modelo: fatal é a data base", () => {
  assert.equal(paraISO(calcularDataFatal(base, 0, "uteis", null, null)), "2026-11-16");
});

test("variante em texto devolve yyyy-MM-dd e vira vazia sem base", () => {
  assert.equal(calcularDataPrevistaISO("2026-11-16", 5, "uteis"), "2026-11-23");
  assert.equal(calcularDataFatalISO("2026-11-16", 0, "uteis", null, null), "2026-11-16");
  assert.equal(calcularDataPrevistaISO(undefined, 5, "uteis"), "");
});
