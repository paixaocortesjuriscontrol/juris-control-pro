import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { canalAlertaPermitido, idsDestinatarios } from "./destinatarios.ts";

Deno.test("membro sem relação com a tarefa não recebe", () => {
  const cargos = new Map([["eduardo", "advogado"], ["coord", "coordenador"]]);
  const ids = idsDestinatarios(["felipe"], ["eduardo", "coord"], cargos);
  assertEquals([...ids].sort(), ["coord", "felipe"]);
});

Deno.test("WhatsApp desligado não recebe", () => {
  assertEquals(canalAlertaPermitido({ ativo: true, canal_whatsapp: false }, "whatsapp"), false);
  assertEquals(canalAlertaPermitido(null, "whatsapp"), false);
});

Deno.test("responsável com WhatsApp ligado recebe", () => {
  assertEquals(canalAlertaPermitido({ ativo: true, canal_whatsapp: true }, "whatsapp"), true);
  assertEquals(canalAlertaPermitido(undefined, "whatsapp"), false);
});
