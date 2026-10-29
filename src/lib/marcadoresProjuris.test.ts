import { test } from "node:test";
import assert from "node:assert/strict";
import { montarVinculosMarcadores } from "./marcadoresProjuris";

const marcadores = [
  { cdmarcador: "1", flativo: "S", nmmarcador: "OUTLIER" },
  { cdmarcador: "2", flativo: "N", nmmarcador: "INS" },
  { cdmarcador: "3", flativo: "S", nmmarcador: "CAPTURA" },
];

test("módulo 3 vira processo e 4 vira tarefa", () => {
  const r = montarVinculosMarcadores(marcadores, [
    { cdmarcador: "1", cdmodulo: "3", cdregistrovinculo: "10" },
    { cdmarcador: "1", cdmodulo: "4", cdregistrovinculo: "20" },
  ]);
  assert.deepEqual(r.vinculos.map((v) => v.entidade), ["processo", "tarefa"]);
});

test("ignora marcadores inativos e CAPTURA", () => {
  const r = montarVinculosMarcadores(marcadores, [
    { cdmarcador: "2", cdmodulo: "3", cdregistrovinculo: "10" },
    { cdmarcador: "3", cdmodulo: "3", cdregistrovinculo: "11" },
  ]);
  assert.equal(r.vinculos.length, 0);
  assert.equal(r.ignorados, 2);
});
