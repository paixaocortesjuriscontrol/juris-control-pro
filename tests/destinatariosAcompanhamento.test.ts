import { describe, expect, test as it } from "bun:test";
import {
  destinatariosExtras,
  destinatariosParaSalvar,
} from "../src/lib/destinatariosAcompanhamento";

const COORD = ["c1", "c2"];

describe("destinatariosExtras (o que aparece marcado na tela)", () => {
  it("mantém marcada a pessoa que foi salva", () =>
    expect(destinatariosExtras(["p1"], COORD)).toEqual(["p1"]));
  it("não repete coordenador que já veio salvo", () =>
    expect(destinatariosExtras(["p1", "c1"], COORD)).toEqual(["p1"]));
  it("lista vazia continua vazia", () => expect(destinatariosExtras([], COORD)).toEqual([]));
});

describe("destinatariosParaSalvar (o que vai para o banco)", () => {
  it("sem escolha salva vazio, para manter responsáveis do processo recebendo", () =>
    expect(destinatariosParaSalvar([], COORD)).toEqual([]));
  it("com escolha salva a pessoa e os coordenadores", () =>
    expect(destinatariosParaSalvar(["p1"], COORD).sort()).toEqual(["c1", "c2", "p1"]));
  it("não duplica coordenador que a pessoa já incluiu", () =>
    expect(destinatariosParaSalvar(["p1", "c1"], COORD).sort()).toEqual(["c1", "c2", "p1"]));
});
