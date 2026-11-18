import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { criarContainerDaTarefa } from "@/modules/tarefa";
import { criarContexto, createCallerFactory } from "../trpc";
import { appRouter } from "./_app";

// Testes de integração do router `tarefa` (camada interface), montado no `appRouter`.
// Ficam em `src/server` e não em `modules/tarefa/interface/` porque precisam do contexto
// (`criarContexto`) e do container, e nenhuma camada do módulo pode importá-los. Cada teste usa um
// container isolado e vazio (`seed: false`), nunca o singleton.

const ID_INEXISTENTE = "11111111-1111-4111-8111-111111111111";

function novoCaller() {
  const container = criarContainerDaTarefa({ seed: false });
  return createCallerFactory(appRouter)(criarContexto({ container }));
}

describe("router tarefa: caminho feliz", () => {
  it("criar devolve o DTO com datas Date", async () => {
    const tarefa = await novoCaller().tarefa.criar({ titulo: "  Estudar  ", descricao: "tRPC" });
    expect(tarefa).toMatchObject({ titulo: "Estudar", descricao: "tRPC" });
    expect(tarefa.dataCriacao).toBeInstanceOf(Date);
    expect(tarefa.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("buscarPorId devolve a tarefa criada", async () => {
    const caller = novoCaller();
    const criada = await caller.tarefa.criar({ titulo: "A" });
    const achada = await caller.tarefa.buscarPorId({ id: criada.id });
    expect(achada).toEqual(criada);
    expect(achada.dataCriacao).toBeInstanceOf(Date);
  });

  it("atualizar muda o título, mantém a descrição e devolve Date", async () => {
    const caller = novoCaller();
    const criada = await caller.tarefa.criar({ titulo: "A", descricao: "d" });
    const nova = await caller.tarefa.atualizar({ id: criada.id, titulo: "B" });
    expect(nova.titulo).toBe("B");
    expect(nova.descricao).toBe("d");
    expect(nova.dataCriacao).toBeInstanceOf(Date);
  });

  it("deletar devolve { id } e a tarefa some", async () => {
    const caller = novoCaller();
    const criada = await caller.tarefa.criar({ titulo: "A" });
    expect(await caller.tarefa.deletar({ id: criada.id })).toEqual({ id: criada.id });
    await expect(caller.tarefa.buscarPorId({ id: criada.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("listar pagina com cursor", async () => {
    const caller = novoCaller();
    for (const titulo of ["1", "2", "3"]) await caller.tarefa.criar({ titulo });
    const p1 = await caller.tarefa.listar({ limit: 2 });
    expect(p1.itens).toHaveLength(2);
    expect(p1.proximoCursor).not.toBeNull();
    const p2 = await caller.tarefa.listar({ limit: 2, cursor: p1.proximoCursor! });
    expect(p2.itens).toHaveLength(1);
    expect(p2.proximoCursor).toBeNull();
    expect(p2.itens[0].dataCriacao).toBeInstanceOf(Date);
    const ids = [...p1.itens, ...p2.itens].map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("listar sem limite usa o padrão", async () => {
    const caller = novoCaller();
    await caller.tarefa.criar({ titulo: "A" });
    expect((await caller.tarefa.listar({})).itens).toHaveLength(1);
  });

  it("listar() sem input usa limit 10 (prefault)", async () => {
    const caller = novoCaller();
    for (let i = 0; i < 11; i++) await caller.tarefa.criar({ titulo: `T${i}` });
    const pagina = await caller.tarefa.listar();
    expect(pagina.itens).toHaveLength(10);
    expect(pagina.proximoCursor).not.toBeNull();
  });

  it("deletar com UUID em maiúsculas devolve o id canônico (minúsculo)", async () => {
    const caller = novoCaller();
    const criada = await caller.tarefa.criar({ titulo: "A" });
    expect(await caller.tarefa.deletar({ id: criada.id.toUpperCase() })).toEqual({
      id: criada.id,
    });
  });

  it("criar ignora id e dataCriacao enviados pelo cliente", async () => {
    const idDoCliente = "22222222-2222-4222-8222-222222222222";
    const dataDoCliente = new Date("2000-01-01T00:00:00.000Z");
    const entrada = { titulo: "A", id: idDoCliente, dataCriacao: dataDoCliente };
    const criada = await novoCaller().tarefa.criar(entrada);
    expect(criada.id).not.toBe(idDoCliente);
    expect(criada.dataCriacao.getTime()).toBeGreaterThan(dataDoCliente.getTime());
  });

  it("saude continua disponível", async () => {
    expect(await novoCaller().saude()).toEqual({ ok: true });
  });
});

describe("router tarefa: atualizar a descrição (3 estados)", () => {
  async function comDescricao() {
    const caller = novoCaller();
    const criada = await caller.tarefa.criar({ titulo: "A", descricao: "texto" });
    return { caller, id: criada.id };
  }

  it('"" apaga', async () => {
    const { caller, id } = await comDescricao();
    expect((await caller.tarefa.atualizar({ id, descricao: "" })).descricao).toBeUndefined();
  });

  it("null apaga", async () => {
    const { caller, id } = await comDescricao();
    expect((await caller.tarefa.atualizar({ id, descricao: null })).descricao).toBeUndefined();
  });

  it("ausente não altera", async () => {
    const { caller, id } = await comDescricao();
    expect((await caller.tarefa.atualizar({ id, titulo: "B" })).descricao).toBe("texto");
  });
});

describe("router tarefa: validação (BAD_REQUEST)", () => {
  it("criar sem título", async () => {
    const entrada = {} as { titulo: string };
    await expect(novoCaller().tarefa.criar(entrada)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("criar com título só de espaços", async () => {
    await expect(novoCaller().tarefa.criar({ titulo: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("id malformado em buscarPorId, atualizar e deletar", async () => {
    const caller = novoCaller();
    const id = "nao-e-uuid";
    await expect(caller.tarefa.buscarPorId({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.tarefa.atualizar({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.tarefa.deletar({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cursor inválido em listar", async () => {
    await expect(novoCaller().tarefa.listar({ cursor: "lixo", limit: 2 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("router tarefa: NOT_FOUND", () => {
  it.each(["buscarPorId", "atualizar", "deletar"] as const)(
    "%s com id inexistente",
    async (procedure) => {
      const caller = novoCaller();
      await expect(caller.tarefa[procedure]({ id: ID_INEXISTENTE })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Tarefa não encontrada",
      });
    },
  );
});

// Via fetchRequestHandler com Request real: só assim o shape formatado (o que vai ao cliente)
// passa pelo `errorFormatter`.
describe("router tarefa via HTTP", () => {
  function get(
    caminho: string,
    entrada: unknown,
    container = criarContainerDaTarefa({ seed: false }),
  ) {
    const query = encodeURIComponent(JSON.stringify({ json: entrada }));
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request(`http://localhost/api/trpc/${caminho}?input=${query}`),
      router: appRouter,
      createContext: () => criarContexto({ container }),
    });
  }

  it("erro inesperado vira INTERNAL_SERVER_ERROR genérico, sem vazar a mensagem", async () => {
    const container = criarContainerDaTarefa({ seed: false });
    container.tarefaService.listar = () => Promise.reject(new Error("segredo interno"));
    const resposta = await get("tarefa.listar", {}, container);
    expect(resposta.status).toBe(500);
    const texto = await resposta.text();
    expect(texto).not.toContain("segredo");
    const corpo = JSON.parse(texto);
    expect(corpo.error.json.message).toBe("Erro interno. Tente novamente.");
    expect(corpo.error.json.data.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("NOT_FOUND chega com status 404 e mensagem pt-BR", async () => {
    const resposta = await get("tarefa.buscarPorId", { id: ID_INEXISTENTE });
    expect(resposta.status).toBe(404);
    const corpo = await resposta.json();
    expect(corpo.error.json.message).toBe("Tarefa não encontrada");
  });

  it("DadoInconsistenteError (dado corrompido) vira 500 genérico, sem vazar a mensagem", async () => {
    const container = criarContainerDaTarefa({ seed: false });
    container.tarefaService.buscarPorId = () =>
      Promise.reject(new DadoInconsistenteDeOutroLugar("titulo corrompido no banco", "titulo"));
    const resposta = await get("tarefa.buscarPorId", { id: ID_INEXISTENTE }, container);
    expect(resposta.status).toBe(500);
    const texto = await resposta.text();
    expect(texto).not.toContain("corrompido");
    const corpo = JSON.parse(texto);
    expect(corpo.error.json.message).toBe("Erro interno. Tente novamente.");
    expect(corpo.error.json.data.campo).toBeNull();
  });

  it("erro que não é de domínio, mesmo com `campo`, não expõe data.campo", async () => {
    const container = criarContainerDaTarefa({ seed: false });
    container.tarefaService.buscarPorId = () =>
      Promise.reject(Object.assign(new Error("qualquer"), { campo: "titulo" }));
    const resposta = await get("tarefa.buscarPorId", { id: ID_INEXISTENTE }, container);
    expect((await resposta.json()).error.json.data.campo).toBeNull();
  });

  it("TRPCError lançado pelo service passa intacto (FORBIDDEN)", async () => {
    const container = criarContainerDaTarefa({ seed: false });
    container.tarefaService.buscarPorId = () =>
      Promise.reject(new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" }));
    const resposta = await get("tarefa.buscarPorId", { id: ID_INEXISTENTE }, container);
    expect(resposta.status).toBe(403);
    const corpo = await resposta.json();
    expect(corpo.error.json.message).toBe("Sem permissão");
    expect(corpo.error.json.data.code).toBe("FORBIDDEN");
  });

  it("BAD_REQUEST do Zod traz a mensagem pt-BR do primeiro issue e data.zodError", async () => {
    const resposta = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("http://localhost/api/trpc/tarefa.criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      }),
      router: appRouter,
      createContext: () => criarContexto({ container: criarContainerDaTarefa({ seed: false }) }),
    });
    expect(resposta.status).toBe(400);
    const { error } = await resposta.json();
    expect(error.json.message).toBe("O título é obrigatório");
    expect(error.json.data.zodError.fieldErrors.titulo).toContain("O título é obrigatório");
    expect(error.json.data.campo).toBeNull();
  });

  it("RegraDeNegocioError expõe a mensagem e data.campo", async () => {
    const container = criarContainerDaTarefa({ seed: false });
    container.tarefaService.buscarPorId = () =>
      Promise.reject(new RegraDeOutroLugar("Regra X", "titulo"));
    const resposta = await get("tarefa.buscarPorId", { id: ID_INEXISTENTE }, container);
    expect(resposta.status).toBe(400);
    const corpo = await resposta.json();
    expect(corpo.error.json.message).toBe("Regra X");
    expect(corpo.error.json.data.campo).toBe("titulo");
  });
});

// Réplica estrutural do erro de domínio (o mapper reconhece pelo `name` literal): a fronteira
// de módulo impede importar `domain/erros` daqui.
class RegraDeOutroLugar extends Error {
  override readonly name = "RegraDeNegocioError";
  constructor(
    mensagem: string,
    readonly campo: string,
  ) {
    super(mensagem);
  }
}

// Réplica de um erro de dado corrompido (name distinto: o mapper NÃO o reconhece).
class DadoInconsistenteDeOutroLugar extends Error {
  override readonly name = "DadoInconsistenteError";
  constructor(
    mensagem: string,
    readonly campo: string,
  ) {
    super(mensagem);
  }
}
