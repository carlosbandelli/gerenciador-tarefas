import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { criarContainerDaTarefa } from "@/modules/tarefa";
import { criarContexto, createCallerFactory, publicProcedure, router } from "./trpc";

// Router local só para os testes: exercita o `initTRPC` real (transformer + errorFormatter)
// sem depender do router de tarefas.
const routerDeTeste = router({
  criar: publicProcedure
    .input(z.object({ titulo: z.string().min(1, { error: "O título é obrigatório" }) }))
    .mutation(({ input }) => input),
  data: publicProcedure.query(() => new Date("2026-01-02T03:04:05.000Z")),
});

async function chamarPorHttp(caminho: string, init?: RequestInit) {
  const container = criarContainerDaTarefa({ seed: false });
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`http://localhost/api/trpc/${caminho}`, init),
    router: routerDeTeste,
    createContext: () => criarContexto({ container }),
  });
}

describe("criarContexto", () => {
  it("usa o container injetado", () => {
    const container = criarContainerDaTarefa({ seed: false });
    expect(criarContexto({ container }).tarefaService).toBe(container.tarefaService);
  });

  it("sem parâmetro usa o singleton do módulo", () => {
    const { tarefaService } = criarContexto();
    expect(typeof tarefaService.listar).toBe("function");
    expect(typeof tarefaService.criar).toBe("function");
  });
});

describe("errorFormatter", () => {
  it("caller lança BAD_REQUEST para input inválido", async () => {
    const caller = createCallerFactory(routerDeTeste)(
      criarContexto({ container: criarContainerDaTarefa({ seed: false }) }),
    );
    await expect(caller.criar({ titulo: "" })).rejects.toMatchObject({
      constructor: TRPCError,
      code: "BAD_REQUEST",
    });
  });

  // Via HTTP real: só assim o shape formatado (que vai ao cliente) é exercitado de ponta a ponta.
  it("expõe data.zodError.fieldErrors por campo, com mensagem pt-BR", async () => {
    const resposta = await chamarPorHttp("criar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { titulo: "" } }),
    });
    expect(resposta.status).toBe(400);
    const corpo = await resposta.json();
    expect(corpo.error.json.data.zodError.fieldErrors.titulo).toContain("O título é obrigatório");
  });
});

describe("superjson", () => {
  it("Date chega como Date pelo caller", async () => {
    const caller = createCallerFactory(routerDeTeste)(
      criarContexto({ container: criarContainerDaTarefa({ seed: false }) }),
    );
    const data = await caller.data();
    expect(data).toBeInstanceOf(Date);
  });

  it("transporte HTTP traz o meta do superjson", async () => {
    const resposta = await chamarPorHttp("data");
    const corpo = await resposta.json();
    expect(corpo.result.data.json).toBe("2026-01-02T03:04:05.000Z");
    expect(corpo.result.data.meta.values).toEqual(["Date"]);
  });
});
