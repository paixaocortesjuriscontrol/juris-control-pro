import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizar, normalizarParaBusca } from "./djenMatch.ts";

Deno.test("REDE D'OR casa com REDE DOR", () => {
  assertEquals(normalizar("REDE D'OR SAO LUIZ"), normalizar("REDE DOR SAO LUIZ S.A.").slice(0, 17));
  assertEquals(normalizarParaBusca("Rede D’Or São Luiz"), "rede dor sao luiz");
});
