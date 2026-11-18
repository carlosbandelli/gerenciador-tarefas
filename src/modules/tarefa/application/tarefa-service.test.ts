import { beforeEach, describe, expect, it } from "vitest";
import { RegraDeNegocioError, TarefaNaoEncontradaError } from "../domain/erros";
import { Tarefa } from "../domain/tarefa";
import { TarefaService } from "./tarefa-service";
import { GeradorDeIdSequencial, RelogioFixo, RepositorioFake } from "./testing/fakes";

const T0 = new Date("2026-01-01T10:00:00Z");
const T1 = new Date("2026-01-02T10:00:00Z");
const ID1 = "00000000-0000-4000-8000-000000000001";
const INEXISTENTE = "00000000-0000-4000-8000-0000000000ff";

let repo: RepositorioFake;
let relogio: RelogioFixo;
let service: TarefaService;

beforeEach(() => {
  repo = new RepositorioFake();
  relogio = new RelogioFixo(T0);
  service = new TarefaService(repo, relogio, new GeradorDeIdSequencial());
});

async function capturar(promessa: Promise<unknown>): Promise<unknown> {
  return promessa.then(
    () => undefined,
    (erro: unknown) => erro,
  );
}

describe("criar", () => {
  it("usa id do gerador e data do relógio, e salva", async () => {
    const dto = await service.criar({ titulo: "  Estudar ", descricao: " DDD " });
    expect(dto).toEqual({ id: ID1, titulo: "Estudar", descricao: "DDD", dataCriacao: T0 });
    expect(repo.porId.get(ID1)?.dataCriacao).toEqual(T0);
  });

  it("descrição vazia vira ausente", async () => {
    const dto = await service.criar({ titulo: "a", descricao: "  " });
    expect(dto.descricao).toBeUndefined();
  });

  it("título inválido lança RegraDeNegocioError e não salva", async () => {
    await expect(service.criar({ titulo: " " })).rejects.toBeInstanceOf(RegraDeNegocioError);
    expect(repo.salvamentos).toBe(0);
  });
});

describe("listar", () => {
  it("repassa cursor e limit ao repositório e devolve DTOs com o cursor da página", async () => {
    for (const titulo of ["a", "b", "c"]) {
      await service.criar({ titulo });
      relogio.avancarPara(new Date(relogio.agora().getTime() + 60_000));
    }
    const p1 = await service.listar({ limit: 2 });
    expect(repo.ultimaListagem).toEqual({ cursor: undefined, limit: 2 });
    expect(p1.itens.map((t) => t.titulo)).toEqual(["c", "b"]);
    expect(p1.proximoCursor).not.toBeNull();
    expect(p1.itens[0]).not.toBeInstanceOf(Tarefa);

    const p2 = await service.listar({ cursor: p1.proximoCursor!, limit: 2 });
    expect(repo.ultimaListagem).toEqual({ cursor: p1.proximoCursor, limit: 2 });
    expect(p2.itens.map((t) => t.titulo)).toEqual(["a"]);
    expect(p2.proximoCursor).toBeNull();
  });

  it("cursor inválido sobe como RegraDeNegocioError no campo cursor", async () => {
    const erro = await capturar(service.listar({ cursor: "lixo", limit: 5 }));
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("cursor");
  });
});

describe("buscarPorId", () => {
  it("devolve o DTO", async () => {
    await service.criar({ titulo: "a" });
    expect((await service.buscarPorId(ID1)).titulo).toBe("a");
  });

  it("inexistente -> TarefaNaoEncontradaError", async () => {
    await expect(service.buscarPorId(INEXISTENTE)).rejects.toBeInstanceOf(TarefaNaoEncontradaError);
  });

  it("id malformado -> RegraDeNegocioError no campo id", async () => {
    const erro = await capturar(service.buscarPorId("nao-e-uuid"));
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("id");
  });
});

describe("atualizar", () => {
  beforeEach(async () => {
    await service.criar({ titulo: "Original", descricao: "desc" });
    relogio.avancarPara(T1);
  });

  it("grava dataAtualizacao do relógio e preserva dataCriacao", async () => {
    const dto = await service.atualizar(ID1, { titulo: "Novo" });
    expect(dto).toMatchObject({ titulo: "Novo", descricao: "desc", dataCriacao: T0 });
    expect(dto.dataAtualizacao).toEqual(T1);
    expect(repo.porId.get(ID1)?.titulo).toBe("Novo");
  });

  it("descricao undefined não altera", async () => {
    expect((await service.atualizar(ID1, { titulo: "N" })).descricao).toBe("desc");
  });

  it.each([null, ""])("descricao %j apaga", async (descricao) => {
    const dto = await service.atualizar(ID1, { descricao });
    expect(dto.descricao).toBeUndefined();
    expect(repo.porId.get(ID1)?.descricao).toBeUndefined();
  });

  it("título inválido -> RegraDeNegocioError e nada salvo", async () => {
    const antes = repo.salvamentos;
    await expect(service.atualizar(ID1, { titulo: "  " })).rejects.toBeInstanceOf(
      RegraDeNegocioError,
    );
    expect(repo.salvamentos).toBe(antes);
    expect(repo.porId.get(ID1)?.titulo).toBe("Original");
  });

  it("sem alterações devolve o DTO atual, sem dataAtualizacao, e não salva", async () => {
    const antes = repo.salvamentos;
    const dto = await service.atualizar(ID1, {});
    expect(dto).toEqual({ id: ID1, titulo: "Original", descricao: "desc", dataCriacao: T0 });
    expect(dto.dataAtualizacao).toBeUndefined();
    expect(repo.salvamentos).toBe(antes);
  });

  it("com alteração salva exatamente uma vez", async () => {
    const antes = repo.salvamentos;
    await service.atualizar(ID1, { titulo: "Novo" });
    expect(repo.salvamentos).toBe(antes + 1);
  });

  it("id malformado -> RegraDeNegocioError no campo id", async () => {
    const erro = await capturar(service.atualizar("x", { titulo: "a" }));
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("id");
  });

  it("inexistente -> TarefaNaoEncontradaError", async () => {
    await expect(service.atualizar(INEXISTENTE, { titulo: "x" })).rejects.toBeInstanceOf(
      TarefaNaoEncontradaError,
    );
  });
});

describe("deletar", () => {
  it("remove e depois buscar falha", async () => {
    await service.criar({ titulo: "a" });
    expect(await service.deletar(ID1)).toEqual({ id: ID1 });
    await expect(service.buscarPorId(ID1)).rejects.toBeInstanceOf(TarefaNaoEncontradaError);
  });

  it("inexistente -> TarefaNaoEncontradaError com o id pedido", async () => {
    const erro = await capturar(service.deletar(INEXISTENTE));
    expect(erro).toBeInstanceOf(TarefaNaoEncontradaError);
    expect((erro as TarefaNaoEncontradaError).id.valor).toBe(INEXISTENTE);
  });

  it("id malformado -> RegraDeNegocioError no campo id", async () => {
    const erro = await capturar(service.deletar("x"));
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("id");
  });

  it("id em maiúsculas remove e devolve o id canônico (minúsculas)", async () => {
    await service.criar({ titulo: "a" });
    expect(await service.deletar(ID1.toUpperCase())).toEqual({ id: ID1 });
  });
});

describe("DTO não expõe a entidade", () => {
  it("é objeto plano e mutar suas datas não altera o armazenado", async () => {
    const dto = await service.criar({ titulo: "a" });
    expect(dto).not.toBeInstanceOf(Tarefa);
    expect(Object.getPrototypeOf(dto)).toBe(Object.prototype);
    dto.dataCriacao.setUTCFullYear(1999);
    expect((await service.buscarPorId(ID1)).dataCriacao).toEqual(T0);
  });
});
