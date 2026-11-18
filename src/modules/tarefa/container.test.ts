import { describe, expect, it, vi } from "vitest";
import { TarefaNaoEncontradaError } from "./domain/erros";
import { InMemoryTarefaRepository } from "./infrastructure/in-memory-tarefa-repository";
import { criarContainerDaTarefa, obterContainerDaTarefa } from "./container";

const LIMITE = 100;

describe("obterContainerDaTarefa", () => {
  it("devolve a mesma instância em chamadas sucessivas", () => {
    expect(obterContainerDaTarefa()).toBe(obterContainerDaTarefa());
    expect(obterContainerDaTarefa().tarefaService).toBe(obterContainerDaTarefa().tarefaService);
  });

  it("vem populado com as 25 tarefas do seed", async () => {
    const pagina = await obterContainerDaTarefa().tarefaService.listar({ limit: LIMITE });
    expect(pagina.itens).toHaveLength(25);
    expect(pagina.proximoCursor).toBeNull();
  });
});

describe("obterContainerDaTarefa e o HMR", () => {
  it("compartilha o MESMO repositório: dados persistem entre chamadas", async () => {
    const criada = await obterContainerDaTarefa().tarefaService.criar({ titulo: "Persiste" });
    const lida = await obterContainerDaTarefa().tarefaService.buscarPorId(criada.id);
    expect(lida.titulo).toBe("Persiste");
  });

  it("reavaliar o módulo (como o HMR) recria o service, mas mantém o repositório", async () => {
    const antes = obterContainerDaTarefa();
    const criada = await antes.tarefaService.criar({ titulo: "Sobrevive ao HMR" });

    vi.resetModules();
    const recarregado = await import("./container");

    const depois = recarregado.obterContainerDaTarefa();
    expect(depois).not.toBe(antes);
    expect(depois.tarefaService).not.toBe(antes.tarefaService);
    expect((await depois.tarefaService.buscarPorId(criada.id)).titulo).toBe("Sobrevive ao HMR");
  });
});

describe("criarContainerDaTarefa", () => {
  it("o seed é ignorado quando um repositório é injetado", async () => {
    const { tarefaService } = criarContainerDaTarefa({
      repositorio: new InMemoryTarefaRepository(),
    });
    expect((await tarefaService.listar({ limit: LIMITE })).itens).toEqual([]);
  });

  it("repositorio + seed juntos não compilam", () => {
    // @ts-expect-error `seed` só existe quando o repositório padrão é usado.
    criarContainerDaTarefa({ repositorio: new InMemoryTarefaRepository(), seed: true });
  });

  it("seed: false vem vazio e cada chamada é uma instância nova", async () => {
    const a = criarContainerDaTarefa({ seed: false });
    const b = criarContainerDaTarefa({ seed: false });
    expect(a).not.toBe(b);
    expect((await a.tarefaService.listar({ limit: LIMITE })).itens).toEqual([]);
  });

  it("por padrão (sem argumentos) já traz o seed", async () => {
    const pagina = await criarContainerDaTarefa().tarefaService.listar({ limit: LIMITE });
    expect(pagina.itens).toHaveLength(25);
  });

  it("integração service + repositório em memória: criar, listar, atualizar, deletar", async () => {
    const { tarefaService } = criarContainerDaTarefa({ seed: false });

    const criada = await tarefaService.criar({ titulo: "Integrar", descricao: "ponta a ponta" });
    expect((await tarefaService.listar({ limit: 10 })).itens.map((t) => t.id)).toEqual([criada.id]);

    const atualizada = await tarefaService.atualizar(criada.id, { titulo: "Integrado" });
    expect(atualizada.titulo).toBe("Integrado");
    expect(atualizada.dataAtualizacao).toBeInstanceOf(Date);
    expect((await tarefaService.buscarPorId(criada.id)).titulo).toBe("Integrado");

    expect(await tarefaService.deletar(criada.id)).toEqual({ id: criada.id });
    await expect(tarefaService.buscarPorId(criada.id)).rejects.toBeInstanceOf(
      TarefaNaoEncontradaError,
    );
    expect((await tarefaService.listar({ limit: 10 })).itens).toEqual([]);
  });

  it("pagina o seed até o fim: páginas 10/10/5 e 25 ids distintos", async () => {
    const { tarefaService } = criarContainerDaTarefa();
    const tamanhos: number[] = [];
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const pagina = await tarefaService.listar({ limit: 10, cursor });
      tamanhos.push(pagina.itens.length);
      ids.push(...pagina.itens.map((t) => t.id));
      cursor = pagina.proximoCursor ?? undefined;
    } while (cursor !== undefined);
    expect(tamanhos).toEqual([10, 10, 5]);
    expect(new Set(ids).size).toBe(25);
  });
});
