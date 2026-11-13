import { test } from "node:test";
import assert from "node:assert/strict";
import { menuPermitido, type RegraMenuCoordenacao } from "./permissoesMenuCoordenacao";

const r = (p: Partial<RegraMenuCoordenacao>): RegraMenuCoordenacao => ({ coordenacao_id: "A", cargo: null, user_id: null, menu_path: "/workflow", permitido: false, ...p });

test("sem regra, menu liberado", () => {
  assert.equal(menuPermitido("/workflow", "u", {}, [{ coordenacao_id: "A", cargo: "advogado" }], []), true);
});
test("cargo bloqueado esconde menu", () => {
  assert.equal(menuPermitido("/workflow", "u", {}, [{ coordenacao_id: "A", cargo: "advogado" }], [r({ cargo: "advogado" })]), false);
});
test("regra do membro vale acima do cargo", () => {
  const regras = [r({ cargo: "advogado" }), r({ user_id: "u", permitido: true })];
  assert.equal(menuPermitido("/workflow", "u", {}, [{ coordenacao_id: "A", cargo: "advogado" }], regras), true);
});
test("basta uma coordenação liberar", () => {
  const v = [{ coordenacao_id: "A", cargo: "advogado" }, { coordenacao_id: "B", cargo: "advogado" }];
  assert.equal(menuPermitido("/workflow", "u", {}, v, [r({ cargo: "advogado" })]), true);
});
test("regra global do usuário tem prioridade", () => {
  assert.equal(menuPermitido("/workflow", "u", { "/workflow": false }, [{ coordenacao_id: "A", cargo: "advogado" }], []), false);
});
