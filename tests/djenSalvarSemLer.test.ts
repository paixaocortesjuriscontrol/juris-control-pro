import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Executa os handlers reais, sem renderizar ou validar texto/estilo do formulário.
// Uma validação que impede o submit mantém os refs; o próximo clique deve
// substituir a intenção anterior, não somar duas ações de salvamento.
const formularios = [
  "src/components/delegacao/NovaTarefaDialog.tsx",
  "src/components/prazos/PrazoDialog.tsx",
  "src/components/agenda/EventoDialog.tsx",
  "src/components/audiencias/AudienciaFormSimplificado.tsx",
];

function handlersDeAcao(path: string, ref: string) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isArrowFunction(node)) {
      const selecionaAcao = node.body.getText(source).includes(`${ref}.current = true;`);
      if (selecionaAcao) handlers.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (handlers.length === 0) throw new Error(`Nenhum handler encontrado em ${path}`);
  return handlers;
}

function executar(handler: string, leitura: { current: boolean }, fechamento: { current: boolean }, outro: { current: boolean }) {
  const code = ts.transpile(`const handler = ${handler}; handler({});`, { target: ts.ScriptTarget.ES2022 });
  new Function("secondaryClickedRef", "tertiaryClickedRef", "outroPrazoClickedRef", "handleSubmit", code)(leitura, fechamento, outro, () => {});
}

for (const path of formularios) {
  test(`${path}: Salvar e fechar não lê após uma tentativa anterior de Salvar e ler`, () => {
    for (const handler of handlersDeAcao(path, "tertiaryClickedRef")) {
      const leitura = { current: true };
      const fechamento = { current: false };
      const outro = { current: true };
      executar(handler, leitura, fechamento, outro);
      let lida = false;
      if (leitura.current) lida = true;
      expect(lida).toBe(false);
      expect(fechamento.current).toBe(true);
      if (path.includes("PrazoDialog")) expect(outro.current).toBe(false);
    }
  });

  test(`${path}: Salvar e ler registra somente a intenção de leitura após tentativa de fechar`, () => {
    for (const handler of handlersDeAcao(path, "secondaryClickedRef")) {
      const leitura = { current: false };
      const fechamento = { current: true };
      executar(handler, leitura, fechamento, { current: true });
      expect(leitura.current).toBe(true);
      expect(fechamento.current).toBe(false);
    }
  });
}