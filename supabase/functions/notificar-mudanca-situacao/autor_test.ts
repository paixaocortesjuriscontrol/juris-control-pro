import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { recebeComoAutor } from "./regras.ts";
Deno.test("autor não recebe por padrão", () => {
  assertEquals(recebeComoAutor(undefined, "a", "a"), false);
  assertEquals(recebeComoAutor({ receber_proprias_alteracoes: false }, "a", "a"), false);
});
Deno.test("autor recebe se ligou a opção", () => {
  assertEquals(recebeComoAutor({ receber_proprias_alteracoes: true }, "a", "a"), true);
});
Deno.test("outras pessoas continuam recebendo", () => {
  assertEquals(recebeComoAutor(undefined, "b", "a"), true);
});
