import { test } from "node:test";
import { strict as assert } from "node:assert";
import { podeRemanejarNoPainel } from "./permissoesPainel";

test("coordenador e assistente de coordenador podem remanejar", () => {
  assert.equal(podeRemanejarNoPainel("coordenador"), true);
  assert.equal(podeRemanejarNoPainel("assistente_coordenador"), true);
});

test("administrador mantém acesso ao remanejamento", () => {
  assert.equal(podeRemanejarNoPainel("admin"), true);
});

test("advogados, assistentes e demais perfis não podem remanejar", () => {
  const roles = [
    "advogado",
    "estagiario",
    "assistente",
    "secretaria",
    "cliente",
    "advogado_temporario",
    "assistente_juridico_geral",
    null,
  ] as const;

  for (const role of roles) {
    assert.equal(podeRemanejarNoPainel(role), false, `perfil liberado indevidamente: ${role}`);
  }
});
