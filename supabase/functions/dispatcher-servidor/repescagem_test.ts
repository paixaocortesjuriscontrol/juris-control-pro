import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { diaAlvoRepescagem } from "./repescagem.ts";

const normal = (d: string) => ({ agendado_para: `${d}T13:00:00Z`, payload: {} });

Deno.test("segunda busca a sexta anterior", () => {
  assertEquals(diaAlvoRepescagem("2026-10-26", [normal("2026-10-23"), normal("2026-10-22")]), "2026-10-23");
});
Deno.test("terça busca a segunda", () => {
  assertEquals(diaAlvoRepescagem("2026-10-27", [normal("2026-10-26"), normal("2026-10-23")]), "2026-10-26");
});
Deno.test("dia já repescado não roda de novo", () => {
  const rep = { agendado_para: "2026-10-27T02:30:00Z", payload: { repescagem: true, dataInicio: "2026-10-23" } };
  assertEquals(diaAlvoRepescagem("2026-10-26", [normal("2026-10-23"), rep]), null);
});
Deno.test("busca manual com data não conta como busca normal", () => {
  const manual = { agendado_para: "2026-10-25T13:00:00Z", payload: { dataInicio: "2026-10-20" } };
  assertEquals(diaAlvoRepescagem("2026-10-26", [normal("2026-10-23"), manual]), "2026-10-23");
});
