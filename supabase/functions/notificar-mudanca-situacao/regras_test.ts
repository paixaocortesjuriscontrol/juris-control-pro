import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { canalPermitido, eventoPermitido } from "./regras.ts";

Deno.test("inclusão respeita sistema, email e WhatsApp escolhidos", () => {
  const cfg = { canal_in_app: false, canal_email: true, canal_whatsapp: false, evento_tarefa_nova: true };
  assertEquals(canalPermitido(cfg, "in_app", "participante_incluido"), false);
  assertEquals(canalPermitido(cfg, "email", "participante_incluido"), true);
  assertEquals(canalPermitido(cfg, "whatsapp", "participante_incluido"), false);
});
Deno.test("cobranças respeitam canais e preferência de comentários", () => {
  assertEquals(canalPermitido({ canal_email: false }, "email", "cobranca"), false);
  assertEquals(canalPermitido({ canal_whatsapp: true }, "whatsapp", "cobranca"), true);
  assertEquals(eventoPermitido({ evento_comentario: false }, "cobranca"), false);
});
Deno.test("alterações respeitam evento desativado e coordenação desativada", () => {
  assertEquals(eventoPermitido({ evento_mudanca_situacao: false }, "alteracao"), false);
  assertEquals(canalPermitido(null, "in_app", "alteracao"), false);
  assertEquals(canalPermitido({ ativo: false }, "email", "participante_incluido"), false);
  assertEquals(eventoPermitido({ evento_tarefa_nova: false }, "mudanca_situacao", true), false);
});