import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
import { ehCoordenadorPorRoleOuCargo } from "./useUserRole";

describe("coordenador por perfil ou cargo", () => {
  it("advogado com cargo Coordenador na coordenação é coordenador", () => {
    expect(ehCoordenadorPorRoleOuCargo("advogado", ["coordenador"])).toBe(true);
  });
  it("advogado sem cargo de gestão não é coordenador", () => {
    expect(ehCoordenadorPorRoleOuCargo("advogado", ["advogado"])).toBe(false);
  });
  it("perfil geral coordenador vale sem cargo", () => {
    expect(ehCoordenadorPorRoleOuCargo("coordenador", [])).toBe(true);
  });
});
