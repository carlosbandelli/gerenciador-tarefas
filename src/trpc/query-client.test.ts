import { TRPCError } from "@trpc/server";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { criarQueryClient, deveTentarNovamente } from "./query-client";

describe("deveTentarNovamente", () => {
  it("não tenta de novo erros determinísticos (NOT_FOUND, BAD_REQUEST)", () => {
    expect(deveTentarNovamente(0, { data: { code: "NOT_FOUND" } })).toBe(false);
    expect(deveTentarNovamente(0, { data: { code: "BAD_REQUEST" } })).toBe(false);
    // TRPCError do caller direto (servidor): `code` na raiz.
    expect(deveTentarNovamente(0, { code: "NOT_FOUND" })).toBe(false);
  });

  it("tenta até 3 vezes os demais erros", () => {
    expect(deveTentarNovamente(0, { data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(true);
    expect(deveTentarNovamente(2, new Error("rede"))).toBe(true);
    expect(deveTentarNovamente(3, new Error("rede"))).toBe(false);
  });

  it("é o retry padrão das queries", () => {
    expect(criarQueryClient().getDefaultOptions().queries?.retry).toBe(deveTentarNovamente);
  });
});

describe("criarQueryClient", () => {
  it("usa staleTime > 0 para não refazer a query logo após a hidratação", () => {
    expect(criarQueryClient().getDefaultOptions().queries?.staleTime).toBeGreaterThan(0);
  });

  it("dehydrate/hydrate preserva Date (superjson)", () => {
    const origem = criarQueryClient();
    const data = new Date("2026-01-02T03:04:05.000Z");
    origem.setQueryData(["k"], { dataCriacao: data });

    // Simula o transporte servidor -> cliente: JSON puro no meio.
    const transportado = JSON.parse(JSON.stringify(dehydrate(origem)));
    const destino = criarQueryClient();
    hydrate(destino, transportado);

    const recebido = destino.getQueryData<{ dataCriacao: Date }>(["k"]);
    expect(recebido?.dataCriacao).toBeInstanceOf(Date);
    expect(recebido?.dataCriacao.toISOString()).toBe(data.toISOString());
  });

  it("desidrata também queries pending (streaming)", () => {
    const origem = criarQueryClient();
    void origem.prefetchQuery({ queryKey: ["p"], queryFn: () => new Promise(() => {}) });
    const estado = dehydrate(origem);
    expect(estado.queries.map((q) => q.queryKey)).toEqual([["p"]]);
  });

  it("hydrate de query pending resolve no destino sem novo fetch", async () => {
    const origem = criarQueryClient();
    const queryFnDestino = vi.fn(async () => "refetch");
    const promessa = origem.prefetchQuery({
      queryKey: ["s"],
      queryFn: async () => ({ criada: new Date(0) }),
    });
    const estado = dehydrate(origem);
    // Termina o fetch no servidor; o destino recebe a promise pendente (streaming).
    await promessa;

    const destino = criarQueryClient();
    hydrate(destino, estado);
    // Registra uma queryFn no destino: se houvesse novo fetch, ela seria chamada.
    const dados = await destino.fetchQuery({ queryKey: ["s"], queryFn: queryFnDestino });

    expect(dados).toEqual({ criada: new Date(0) });
    expect(queryFnDestino).not.toHaveBeenCalled();
  });

  async function erroDehidratado(erro: unknown) {
    const origem = criarQueryClient();
    void origem.prefetchQuery({
      queryKey: ["e"],
      retry: false,
      queryFn: async () => {
        throw erro;
      },
    });
    const { queries } = dehydrate(origem);
    return queries[0]?.promise;
  }

  it("dehydrate mantém a mensagem de erro esperado do domínio (TRPCError não-500)", async () => {
    const erro = new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
    await expect(erroDehidratado(erro)).rejects.toThrow("Tarefa não encontrada");
  });

  it("dehydrate OCULTA erro inesperado (500) — o prefetch não passa pelo errorFormatter", async () => {
    const erro = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "segredo interno" });
    await expect(erroDehidratado(erro)).rejects.not.toThrow("segredo");
  });

  it("dehydrate OCULTA erro que não é TRPCError", async () => {
    await expect(erroDehidratado(new Error("segredo interno"))).rejects.not.toThrow("segredo");
  });

  it("um QueryClient puro NÃO preserva Date (prova que o teste depende do superjson)", () => {
    const origem = new QueryClient();
    origem.setQueryData(["k"], { d: new Date(0) });
    const transportado = JSON.parse(JSON.stringify(dehydrate(origem)));
    const destino = new QueryClient();
    hydrate(destino, transportado);
    expect(destino.getQueryData<{ d: unknown }>(["k"])?.d).not.toBeInstanceOf(Date);
  });
});
