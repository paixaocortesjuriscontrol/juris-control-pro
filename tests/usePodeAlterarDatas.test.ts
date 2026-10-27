import { describe, test, expect, mock } from "bun:test";

let permitido = true;
let escopo: (string | null | undefined)[] = [];

mock.module("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ role: "assistente", loading: false }),
}));
mock.module("@/hooks/usePodeReagendar", () => ({
  usePodeReagendar: (coordenacaoId?: string | null, tipoItem?: string | null) => {
    escopo = [coordenacaoId, tipoItem];
    return { podeReagendar: permitido, loading: false };
  },
}));

const { usePodeAlterarDatas } = await import("../src/hooks/usePodeAlterarDatas");

describe("alteração de datas segue Quem pode reagendar", () => {
  test("assistente liberado na coordenação pode alterar datas do prazo", () => {
    permitido = true;
    const resultado = usePodeAlterarDatas("coordenacao-gol", "PRAZO");
    expect(resultado.podeAlterarDatas).toBe(true);
    expect(resultado.datasBloqueadas).toBe(false);
    expect(escopo).toEqual(["coordenacao-gol", "PRAZO"]);
  });

  test("assistente não liberado continua bloqueado na coordenação do item", () => {
    permitido = false;
    const resultado = usePodeAlterarDatas("outra-coordenacao", "TAREFA");
    expect(resultado.podeAlterarDatas).toBe(false);
    expect(resultado.datasBloqueadas).toBe(true);
    expect(escopo).toEqual(["outra-coordenacao", "TAREFA"]);
  });
});