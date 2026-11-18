import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookComProviders } from "@/test/render-com-providers";
import { useExcluirTarefa } from "./use-excluir-tarefa";
import { useTarefas } from "./use-tarefas";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// Segura um método assíncrono do service até `liberar()`; depois delega ao original.
function segurar(servico: object, metodo: string) {
  const alvo = servico as Record<string, (...args: unknown[]) => Promise<unknown>>;
  let liberar!: () => void;
  const portao = new Promise<void>((resolve) => (liberar = resolve));
  const original = alvo[metodo].bind(servico);
  vi.spyOn(alvo, metodo).mockImplementation(async (...args) => {
    await portao;
    return original(...args);
  });
  return liberar;
}

describe("useExcluirTarefa", () => {
  it("sucesso: remove do cache ANTES do refetch e avisa com toast.success", async () => {
    const { result, container, queryClient } = renderHookComProviders(() => ({
      lista: useTarefas(),
      exclusao: useExcluirTarefa(),
    }));
    const a = await container.tarefaService.criar({ titulo: "A" });
    await container.tarefaService.criar({ titulo: "B" });
    await result.current.lista.refetch();
    await waitFor(() => expect(result.current.lista.tarefas).toHaveLength(2));

    // Segura o refetch para provar que a remoção veio da escrita direta no cache.
    const liberarListar = segurar(container.tarefaService, "listar");

    act(() => result.current.exclusao.excluir(a.id));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa excluída"));
    await waitFor(() => expect(result.current.lista.tarefas.map((t) => t.titulo)).toEqual(["B"]));
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((q) => JSON.stringify(q.queryKey).includes("buscarPorId")),
    ).toBe(false);
    liberarListar();
    await waitFor(() => expect(result.current.lista.tarefas.map((t) => t.titulo)).toEqual(["B"]));
    await expect(container.tarefaService.buscarPorId(a.id)).rejects.toThrow();
  });

  it("remove item da página 2 (12 itens, fetchNextPage)", async () => {
    const { result, container } = renderHookComProviders(() => ({
      lista: useTarefas(),
      exclusao: useExcluirTarefa(),
    }));
    for (let i = 1; i <= 12; i++) await container.tarefaService.criar({ titulo: `T${i}` });
    await result.current.lista.refetch();
    await waitFor(() => expect(result.current.lista.tarefas).toHaveLength(10));
    await act(async () => {
      await result.current.lista.fetchNextPage();
    });
    await waitFor(() => expect(result.current.lista.tarefas).toHaveLength(12));
    const alvo = result.current.lista.tarefas[11];

    const liberar = segurar(container.tarefaService, "listar");

    act(() => result.current.exclusao.excluir(alvo.id));

    await waitFor(() => expect(result.current.lista.tarefas).toHaveLength(11));
    expect(result.current.lista.tarefas.some((t) => t.id === alvo.id)).toBe(false);
    liberar();
  });

  it("erro NOT_FOUND: toast.error com a mensagem do servidor", async () => {
    const { result } = renderHookComProviders(() => useExcluirTarefa());

    act(() => result.current.excluir("3f2504e0-4f89-41d3-9a0c-0305e82c3301"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Tarefa não encontrada"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("exclusões concorrentes: estaExcluindo por id, estável entre renders", async () => {
    const { result, rerender, container } = renderHookComProviders(() => useExcluirTarefa());
    const a = await container.tarefaService.criar({ titulo: "A" });
    const b = await container.tarefaService.criar({ titulo: "B" });
    const liberar = segurar(container.tarefaService, "deletar");
    expect(result.current.estaExcluindo(a.id)).toBe(false);

    act(() => {
      result.current.excluir(a.id);
      result.current.excluir(b.id);
    });
    await waitFor(() => expect(result.current.excluindoIds).toHaveLength(2));
    expect(result.current.estaExcluindo(a.id)).toBe(true);
    expect(result.current.estaExcluindo(b.id)).toBe(true);

    liberar();
    await waitFor(() => expect(result.current.excluindoIds).toHaveLength(0));
    expect(result.current.estaExcluindo(a.id)).toBe(false);
    expect(toast.success).toHaveBeenCalledTimes(2);
    await expect(container.tarefaService.listar({ limit: 10 })).resolves.toMatchObject({
      itens: [],
    });

    const excluir = result.current.excluir;
    const estaExcluindo = result.current.estaExcluindo;
    rerender();
    expect(result.current.excluir).toBe(excluir);
    expect(result.current.estaExcluindo).toBe(estaExcluindo);
  });
});
