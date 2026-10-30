import { describe, it, expect } from "vitest";
import { normalizarRitoProcessual } from "./ritoProcessual";

describe("normalizarRitoProcessual", () => {
  it("JEC vira Juizado Especial Cível", () => expect(normalizarRitoProcessual("JEC")).toBe("Juizado Especial Cível"));
  it("vc vira Vara Cível", () => expect(normalizarRitoProcessual("vc")).toBe("Vara Cível"));
  it("vara civel sem acento vira Vara Cível", () => expect(normalizarRitoProcessual("vara civel")).toBe("Vara Cível"));
  it("vazio vira null", () => expect(normalizarRitoProcessual("  ")).toBeNull());
  it("rito novo é mantido", () => expect(normalizarRitoProcessual("Rito Sumário")).toBe("Rito Sumário"));
});
