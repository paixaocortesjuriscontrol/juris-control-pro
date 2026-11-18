import { describe, expect, test as it } from "bun:test";
import {
  destinatariosMarcadosInicialmente,
  montarConfigAcompanhamento,
} from "../src/lib/destinatariosAcompanhamento";

const COORD = ["c1", "c2"];

describe("quem chega marcado na tela", () => {
  it("coordenadores vêm marcados por padrão", () =>
    expect(destinatariosMarcadosInicialmente([], COORD, [])).toEqual(["c1", "c2"]));
  it("coordenador desmarcado continua desmarcado ao reabrir", () =>
    expect(destinatariosMarcadosInicialmente([], COORD, ["c2"])).toEqual(["c1"]));
  it("pessoa escolhida antes aparece marcada", () =>
    expect(destinatariosMarcadosInicialmente(["p1", "c1"], COORD, [])).toEqual(["p1", "c1"]));
  it("lista salva com gente vale mais que a exclusão antiga", () =>
    expect(destinatariosMarcadosInicialmente(["p1"], COORD, ["c1"])).toEqual(["p1"]));
});

describe("o que é salvo ao confirmar", () => {
  it("só coordenadores marcados salva vazio, mantendo os responsáveis do processo", () =>
    expect(montarConfigAcompanhamento(COORD, COORD)).toEqual({
      destinatarios_ids: [],
      coordenadores_excluidos_ids: [],
    }));
  it("coordenador desmarcado fica na lista de excluídos", () =>
    expect(montarConfigAcompanhamento(["c1"], COORD)).toEqual({
      destinatarios_ids: [],
      coordenadores_excluidos_ids: ["c2"],
    }));
  it("todos desmarcados exclui todos os coordenadores", () =>
    expect(montarConfigAcompanhamento([], COORD)).toEqual({
      destinatarios_ids: [],
      coordenadores_excluidos_ids: ["c1", "c2"],
    }));
  it("pessoa escolhida salva junto com os coordenadores marcados", () =>
    expect(montarConfigAcompanhamento(["p1", "c1"], COORD)).toEqual({
      destinatarios_ids: ["p1", "c1"],
      coordenadores_excluidos_ids: [],
    }));
});
