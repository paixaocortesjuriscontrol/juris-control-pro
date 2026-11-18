import { describe, expect, test } from "bun:test";
import {
  idProcessoDoItem,
  idsProcessosDosItens,
  itemEmAcompanhamentoEspecial,
} from "../src/lib/acompanhamentoEspecialItem";

describe("marca de Acompanhamento Especial nas atividades", () => {
  test("lê o processo tanto do vínculo quanto do objeto aninhado", () => {
    expect(idProcessoDoItem({ processo_id: "p1" })).toBe("p1");
    expect(idProcessoDoItem({ processo: { id: "p2" }, processo_id: "p1" })).toBe("p2");
    expect(idProcessoDoItem({ titulo: "sem processo" })).toBeNull();
  });

  test("só marca quando o processo está na lista de monitorados", () => {
    const monitorados = new Set(["p1"]);
    expect(itemEmAcompanhamentoEspecial({ processo_id: "p1" }, monitorados)).toBe(true);
    expect(itemEmAcompanhamentoEspecial({ processo_id: "p9" }, monitorados)).toBe(false);
    expect(itemEmAcompanhamentoEspecial({ processo_id: "p1" }, new Set())).toBe(false);
    expect(itemEmAcompanhamentoEspecial({ processo_id: "p1" }, undefined)).toBe(false);
  });

  test("reúne cada processo uma única vez para a consulta", () => {
    const ids = idsProcessosDosItens([
      { processo_id: "b" },
      { processo: { id: "a" } },
      { processo_id: "b" },
      { titulo: "sem processo" },
    ]);
    expect(ids).toEqual(["a", "b"]);
  });
});
