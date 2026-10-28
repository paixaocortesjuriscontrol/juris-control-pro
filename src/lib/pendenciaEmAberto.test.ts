import { describe, it, expect } from "vitest";
import { situacaoEmAberto } from "./pendenciaEmAberto";

describe("situacaoEmAberto", () => {
  it("minutado_revisao continua pendência", () => expect(situacaoEmAberto("minutado_revisao")).toBe(true));
  it("cumprido não é pendência", () => expect(situacaoEmAberto("cumprido")).toBe(false));
  it("baixado não é pendência", () => expect(situacaoEmAberto("baixado")).toBe(false));
});
