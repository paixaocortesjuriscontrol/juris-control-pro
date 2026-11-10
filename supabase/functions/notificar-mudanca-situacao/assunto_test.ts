import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { montarAssunto } from "./assunto.ts";

Deno.test("sempre inclui coordenação e processo", () => {
  assertEquals(
    montarAssunto("[Tarefa] Item alterado — CHECAR DESPACHO 2D", "Coordenação Dra. Beatriz Costa", "1000872-65.2026.5.02.0079"),
    "[Coordenação Dra. Beatriz Costa] [Tarefa] Item alterado — CHECAR DESPACHO 2D — 1000872-65.2026.5.02.0079",
  );
});

Deno.test("sem processo nem coordenação mantém o base", () => {
  assertEquals(montarAssunto("[Tarefa] Item alterado — X", null, null), "[Tarefa] Item alterado — X");
});
