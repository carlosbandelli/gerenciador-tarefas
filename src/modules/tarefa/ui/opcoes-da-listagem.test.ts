import { describe, expect, it } from "vitest";
import { OPCOES_DA_LISTAGEM } from "./opcoes-da-listagem";

describe("OPCOES_DA_LISTAGEM.getNextPageParam", () => {
  const { getNextPageParam } = OPCOES_DA_LISTAGEM;

  it("devolve o cursor quando a página tem itens", () => {
    expect(getNextPageParam({ itens: [{}], proximoCursor: "abc" })).toBe("abc");
  });

  it("sem cursor, não há próxima página", () => {
    expect(getNextPageParam({ itens: [{}], proximoCursor: null })).toBeUndefined();
  });

  it("página vazia com cursor não gera próxima (evita loop)", () => {
    expect(getNextPageParam({ itens: [], proximoCursor: "abc" })).toBeUndefined();
  });
});
