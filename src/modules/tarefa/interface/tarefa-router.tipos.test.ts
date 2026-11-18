import { initTRPC } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TarefaCasosDeUso } from "../application/tarefa-casos-de-uso";
import { criarTarefaRouter } from "./tarefa-router";

// Teste de TIPO (verificado pelo `npm run typecheck`): a fábrica aceita um `t` cujo contexto é
// MAIOR que `ContextoDaTarefa` (o server pode acrescentar usuário, requisição etc.).
describe("criarTarefaRouter aceita contexto maior que ContextoDaTarefa", () => {
  it("compila e monta o router", () => {
    const t = initTRPC.context<{ tarefaService: TarefaCasosDeUso; outro: number }>().create();
    const router = criarTarefaRouter(t);
    expect(Object.keys(router._def.procedures).sort()).toEqual([
      "atualizar",
      "buscarPorId",
      "criar",
      "deletar",
      "listar",
    ]);
  });
});
