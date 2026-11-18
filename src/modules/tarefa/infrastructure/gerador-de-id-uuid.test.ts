import { describe, expect, it } from "vitest";
import { TarefaId } from "../domain/tarefa-id";
import { GeradorDeIdUuid } from "./gerador-de-id-uuid";

describe("GeradorDeIdUuid", () => {
  it("gera TarefaId válidos", () => {
    expect(new GeradorDeIdUuid().gerar()).toBeInstanceOf(TarefaId);
  });

  it("gera ids distintos", () => {
    const gerador = new GeradorDeIdUuid();
    const ids = new Set(Array.from({ length: 200 }, () => gerador.gerar().valor));
    expect(ids.size).toBe(200);
  });
});
