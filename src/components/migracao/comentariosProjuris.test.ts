import { describe, it, expect } from "vitest";
import { comentarioDentroDoCorte } from "./ImportarComentariosProjuris";
describe("corte dos comentários do Projuris", () => {
  it("aceita comentário do próprio dia 13/11/2026", () => expect(comentarioDentroDoCorte("2026-11-13 23:10:00", "2026-11-13")).toBe(true));
  it("recusa comentário de 14/11/2026", () => expect(comentarioDentroDoCorte("2026-11-14 08:00:00", "2026-11-13")).toBe(false));
});
