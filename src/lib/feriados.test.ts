import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { feriadosNacionais, definirFeriadosCache, somarDiasUteis } from "./feriados";

describe("feriados", () => {
  it("calcula Carnaval e Sexta-feira Santa de 2026", () => {
    const d = feriadosNacionais(2026).map((f) => f.data);
    expect(d).toContain("2026-02-17");
    expect(d).toContain("2026-04-03");
  });
  it("só pula feriado quando a coordenação ligou a opção", () => {
    const base = new Date(2026, 11, 24, 12); // quinta 24/12
    definirFeriadosCache("A", false, []);
    expect(somarDiasUteis(base, 1, "A").getDate()).toBe(25);
    definirFeriadosCache("B", true, []);
    expect(somarDiasUteis(base, 1, "B").getDate()).toBe(28);
  });
});
