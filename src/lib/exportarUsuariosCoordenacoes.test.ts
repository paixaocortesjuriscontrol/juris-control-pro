import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { agregarVinculos } from "./exportarUsuariosCoordenacoes";

describe("agregarVinculos", () => {
  const a = agregarVinculos([
    { processo_id: "p1", usuario_id: "u", coordenacao_id: "c1", papel: "responsavel" },
    { processo_id: "p1", usuario_id: "u", coordenacao_id: "c1", papel: "Responsável" },
    { processo_id: "p2", usuario_id: "u", coordenacao_id: "c2", papel: "apoio" },
    { processo_id: "p1", usuario_id: "u", coordenacao_id: "c2", papel: "supervisor" },
  ]);
  it("conta processos distintos por papel", () => {
    expect(a.geral("u")).toEqual({ responsavel: 1, envolvido: 2, total: 2 });
  });
  it("separa por coordenação", () => {
    expect(a.coord("u", "c1")).toEqual({ responsavel: 1, envolvido: 0, total: 1 });
    expect(a.coord("u", "c2")).toEqual({ responsavel: 0, envolvido: 2, total: 2 });
  });
});
