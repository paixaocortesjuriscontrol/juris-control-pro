import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  MSG_RESPONSAVEL_OU_ENVOLVIDO_OBRIGATORIO,
  mensagemPessoasObrigatorias,
  pessoasSelecionadas,
  temResponsavelOuEnvolvido,
} from "./pessoasAtividadeObrigatoria";

test("recusa atividade sem nenhuma pessoa", () => {
  assert.equal(mensagemPessoasObrigatorias([], []), MSG_RESPONSAVEL_OU_ENVOLVIDO_OBRIGATORIO);
  assert.equal(
    mensagemPessoasObrigatorias(["", null, undefined], ["  "]),
    MSG_RESPONSAVEL_OU_ENVOLVIDO_OBRIGATORIO,
  );
});

test("aceita pelo menos um responsável", () => {
  assert.equal(temResponsavelOuEnvolvido(["responsavel-1"], []), true);
});

test("aceita somente um envolvido, sem exigir responsável", () => {
  assert.equal(mensagemPessoasObrigatorias([], ["envolvido-1"]), null);
});

test("conta cada pessoa uma única vez nos dois papéis", () => {
  assert.deepEqual(pessoasSelecionadas(["pessoa-1", "pessoa-1"], ["pessoa-1", "pessoa-2"]), [
    "pessoa-1",
    "pessoa-2",
  ]);
});

for (const tipo of ["Tarefa", "Prazo", "Ata", "Evento", "Audiência", "Parcelamento"]) {
  test(`aplica a mesma validação para ${tipo}`, () => {
    assert.equal(temResponsavelOuEnvolvido([], []), false);
    assert.equal(temResponsavelOuEnvolvido([], ["pessoa-1"]), true);
  });
}
