import { describe, expect, test } from "bun:test";
import { formatarDataDetalhe, mesclarPublicacoesItem } from "../src/lib/detalheItemResponsabilidade";

describe("detalhe ampliado de Minhas Responsabilidades", () => {
  test("mantém datas civis sem mudança de fuso", () => {
    expect(formatarDataDetalhe("2026-11-18")).toBe("18/11/2026");
  });

  test("apresenta horários em Brasília", () => {
    expect(formatarDataDetalhe("2026-11-18T15:00:00Z", true)).toBe("18/11/2026, 12:00");
  });

  test("publicação de origem vem primeiro e não duplica registros", () => {
    const resultado = mesclarPublicacoesItem(
      [{ id: "p1", data_publicacao: "2026-11-17" }, { id: "p2", data_publicacao: "2026-11-18" }],
      [{ id: "t1", data_publicacao: "2026-11-16" }],
      ["p1"],
      ["t1"],
    );
    expect(resultado.map((pub) => pub.id)).toEqual(["p1", "t1", "p2"]);
    expect(resultado.filter((pub) => pub.vinculada_item)).toHaveLength(2);
    expect(new Set(resultado.map((pub) => `${pub.origem_publicacao}:${pub.id}`)).size).toBe(3);
  });
});
