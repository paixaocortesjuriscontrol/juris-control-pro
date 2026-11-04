import { expect, test } from "bun:test";
import { decidirPassoPosSalvacaoPrazo } from "../src/lib/prazoFluxoPosSalvacao";

// Regra pedida pela Bruna (04/11/2026): "Salvar e agendar outro prazo" precisa
// manter o formulário aberto em TODAS as telas, inclusive onde a janela é
// usada sem aviso de criação (Painel de Controle, ficha do processo, Prazos).
test("criar prazo clicando em 'agendar outro' mantém o formulário aberto mesmo sem onAfterCreate", () => {
  expect(
    decidirPassoPosSalvacaoPrazo({
      isNovo: true,
      clicouOutroPrazo: true,
      clicouSalvarEFechar: false,
      temAvisoDeCriacao: false,
    }),
  ).toBe("continuar-aberto");
});

test("no fluxo de publicações (com onAfterCreate) o clique em 'agendar outro' vale mais que o fluxo padrão", () => {
  expect(
    decidirPassoPosSalvacaoPrazo({
      isNovo: true,
      clicouOutroPrazo: true,
      clicouSalvarEFechar: false,
      temAvisoDeCriacao: true,
    }),
  ).toBe("continuar-aberto");
});

test("'Salvar e fechar' fecha mesmo tendo clicado antes em 'agendar outro'", () => {
  expect(
    decidirPassoPosSalvacaoPrazo({
      isNovo: true,
      clicouOutroPrazo: true,
      clicouSalvarEFechar: true,
      temAvisoDeCriacao: false,
    }),
  ).toBe("fechar");
});

test("salvar um prazo já existente fecha o formulário", () => {
  expect(
    decidirPassoPosSalvacaoPrazo({
      isNovo: false,
      clicouOutroPrazo: true,
      clicouSalvarEFechar: false,
      temAvisoDeCriacao: true,
    }),
  ).toBe("fechar");
});

test("salvar comum sem aviso de criação fecha o formulário", () => {
  expect(
    decidirPassoPosSalvacaoPrazo({
      isNovo: true,
      clicouOutroPrazo: false,
      clicouSalvarEFechar: false,
      temAvisoDeCriacao: false,
    }),
  ).toBe("fechar");
});

test("no fluxo de publicações, o salvar comum mantém a janela aberta para o próximo item", () => {
  expect(
    decidirPassoPosSalvacaoPrazo({
      isNovo: true,
      clicouOutroPrazo: false,
      clicouSalvarEFechar: false,
      temAvisoDeCriacao: true,
    }),
  ).toBe("continuar-publicacao");
});
