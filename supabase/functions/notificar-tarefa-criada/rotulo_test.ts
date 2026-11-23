import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { rotuloTipo } from "./rotulo.ts";
Deno.test("prazo", () => assertEquals(rotuloTipo({ tipo_registro: "prazo" }).novo, "Novo Prazo"));
Deno.test("ata", () => assertEquals(rotuloTipo({ tipo_registro: "tarefa", tipo_tarefa: "ATA" }).novo, "Nova Ata"));
Deno.test("tarefa", () => assertEquals(rotuloTipo({ tipo_registro: "tarefa" }).novo, "Nova Tarefa"));
