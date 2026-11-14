import { test } from "node:test";
import assert from "node:assert/strict";
import { camposTipoTarefa } from "./conversaoTipoItem";

test("converter para tarefa grava TAREFA e tipo_registro tarefa", () => {
  assert.deepEqual(camposTipoTarefa("TAREFA"), {
    tipo_tarefa: "TAREFA",
    tipo_registro: "tarefa",
  });
});

test("converter para prazo grava PRAZO e tipo_registro prazo", () => {
  assert.deepEqual(camposTipoTarefa("PRAZO"), {
    tipo_tarefa: "PRAZO",
    tipo_registro: "prazo",
  });
});

test("converter para ata preserva ATA como tarefa na agenda", () => {
  assert.deepEqual(camposTipoTarefa("ata"), {
    tipo_tarefa: "ATA",
    tipo_registro: "tarefa",
  });
});
