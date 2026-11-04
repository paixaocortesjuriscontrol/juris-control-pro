import { describe, test, expect } from "bun:test";
import { addDays, subDays } from "date-fns";
import { classificarStatus, itemCorrespondeFiltro } from "../src/lib/statusItemEquipe";

const amanha = addDays(new Date(), 2).toISOString();
const ontem = subDays(new Date(), 3).toISOString();

describe("filtro de situação do Painel da Equipe", () => {
  test("prazo vencido e não tratado conta como atrasada", () => {
    const prazo = { data_fatal: ontem };
    expect(classificarStatus(prazo)).toBe("atrasada");
    expect(itemCorrespondeFiltro(prazo, "atrasadas")).toBe(true);
    expect(itemCorrespondeFiltro(prazo, "pendentes")).toBe(false);
  });

  test("item com data futura conta como pendente", () => {
    const tarefa = { data_fatal: amanha };
    expect(classificarStatus(tarefa)).toBe("pendente");
    expect(itemCorrespondeFiltro(tarefa, "pendentes")).toBe(true);
    expect(itemCorrespondeFiltro(tarefa, "atrasadas")).toBe(false);
  });

  test("item tratado não aparece nas atrasadas, mesmo com data vencida", () => {
    const cumprida = { data_fatal: ontem, concluido_em: ontem };
    expect(classificarStatus(cumprida)).toBe("cumprida");
    expect(itemCorrespondeFiltro(cumprida, "cumpridas")).toBe(true);
    expect(itemCorrespondeFiltro(cumprida, "atrasadas")).toBe(false);
  });

  test("item cancelado não aparece nas atrasadas nem nas pendentes", () => {
    const cancelada = { data_fatal: ontem, status: "Cancelado" };
    expect(classificarStatus(cancelada)).toBe("cancelado");
    expect(itemCorrespondeFiltro(cancelada, "cancelados")).toBe(true);
    expect(itemCorrespondeFiltro(cancelada, "atrasadas")).toBe(false);
    expect(itemCorrespondeFiltro(cancelada, "pendentes")).toBe(false);
  });

  test("todos mostra qualquer item, inclusive sem data", () => {
    const semData = { titulo: "Audiência sem data" };
    expect(classificarStatus(semData)).toBe("pendente");
    expect(itemCorrespondeFiltro(semData, "todos")).toBe(true);
    expect(itemCorrespondeFiltro({ data_fatal: ontem }, "todos")).toBe(true);
  });
});
