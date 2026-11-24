import { test } from "node:test";
import assert from "node:assert/strict";
import { ehCoordenadorPorRoleOuCargo } from "./coordenadorPorCargo";

test("advogado com cargo Coordenador na coordenação é coordenador", () => {
  assert.equal(ehCoordenadorPorRoleOuCargo("advogado", ["coordenador"]), true);
});
test("advogado sem cargo de gestão não é coordenador", () => {
  assert.equal(ehCoordenadorPorRoleOuCargo("advogado", ["advogado"]), false);
});
test("perfil geral coordenador vale sem cargo", () => {
  assert.equal(ehCoordenadorPorRoleOuCargo("coordenador", []), true);
});
