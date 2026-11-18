import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obterContainerDaTarefa } from "@/modules/tarefa";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import PaginaEditarTarefa, { generateMetadata } from "./page";

const notFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Fora de uma request do servidor o `cache` do React é só repasse (cada chamada cria um
// QueryClient), e page, `generateMetadata` e `HydrateClient` não compartilhariam o cache. Este mock
// imita o escopo de UMA request: memoriza por argumentos (`Map` por `JSON.stringify(args)`, como o
// `cache` real compara por argumentos) e é zerado no `beforeEach`.
const zerarCaches = vi.hoisted(() => [] as (() => void)[]);
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => {
    const memo = new Map<string, unknown>();
    zerarCaches.push(() => memo.clear());
    return ((...args: never[]) => {
      const chave = JSON.stringify(args);
      if (!memo.has(chave)) memo.set(chave, fn(...args));
      return memo.get(chave);
    }) as T;
  },
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

// `notFound()` real lança para interromper o render; o mock faz o mesmo.
beforeEach(() => {
  zerarCaches.forEach((zerar) => zerar());
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

async function umaTarefaDoSeed() {
  const { itens } = await obterContainerDaTarefa().tarefaService.listar({ limit: 1 });
  return itens[0];
}

describe("rota /tarefas/[id]/editar", () => {
  it("a 1ª renderização do container hidratado já mostra o título no input (sem findBy)", async () => {
    const tarefa = await umaTarefaDoSeed();
    const elemento = await PaginaEditarTarefa(params(tarefa.id));
    const { Providers } = criarAmbienteDeTeste();
    render(elemento, { wrapper: Providers });
    // Síncrono, como o SSR: sem esqueleto e sem esperar fetch.
    expect(screen.getByLabelText("Título")).toHaveValue(tarefa.titulo);
    expect(screen.queryByRole("status", { name: "Carregando tarefa" })).toBeNull();
  });

  it("id inexistente chama notFound()", async () => {
    await expect(
      PaginaEditarTarefa(params("00000000-0000-4000-8000-000000000000")),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("id malformado chama notFound()", async () => {
    await expect(PaginaEditarTarefa(params("xyz"))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("erro inesperado propaga (não vira 404)", async () => {
    const container = obterContainerDaTarefa();
    vi.spyOn(container.tarefaService, "buscarPorId").mockRejectedValue(new Error("falha interna"));
    const tarefa = await umaTarefaDoSeed();
    await expect(PaginaEditarTarefa(params(tarefa.id))).rejects.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("busca única por request: generateMetadata + page chamam o service UMA vez", async () => {
    const buscar = vi.spyOn(obterContainerDaTarefa().tarefaService, "buscarPorId");
    const tarefa = await umaTarefaDoSeed();
    await generateMetadata(params(tarefa.id));
    await PaginaEditarTarefa(params(tarefa.id));
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("generateMetadata: título da tarefa, ou 'Tarefa não encontrada'", async () => {
    const tarefa = await umaTarefaDoSeed();
    expect(await generateMetadata(params(tarefa.id))).toEqual({
      title: `Editar: ${tarefa.titulo}`,
    });
    expect(await generateMetadata(params("xyz"))).toEqual({ title: "Tarefa não encontrada" });
  });
});
