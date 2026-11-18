import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookComProviders } from "@/test/render-com-providers";
import { useTarefas } from "./use-tarefas";

async function criarTarefas(
  criar: (c: { titulo: string }) => Promise<unknown>,
  quantidade: number,
) {
  for (let i = 1; i <= quantidade; i++) await criar({ titulo: `Tarefa ${i}` });
}

describe("useTarefas", () => {
  it("achata as páginas e carrega a próxima pelo proximoCursor", async () => {
    const { result, container } = renderHookComProviders(() => useTarefas());
    await criarTarefas((c) => container.tarefaService.criar(c), 12);
    // O hook já disparou a query vazia; refaz com os dados criados.
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await result.current.refetch();

    await waitFor(() => expect(result.current.tarefas).toHaveLength(10));
    expect(result.current.hasNextPage).toBe(true);
    // superjson: a data chega como Date de verdade.
    expect(result.current.tarefas[0].dataCriacao).toBeInstanceOf(Date);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.tarefas).toHaveLength(12));
    expect(result.current.hasNextPage).toBe(false);
    const ids = result.current.tarefas.map((t) => t.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("mantém a mesma referência do array enquanto os dados não mudam (useMemo)", async () => {
    const { result, rerender, container } = renderHookComProviders(() => useTarefas());
    await container.tarefaService.criar({ titulo: "A" });
    await result.current.refetch();
    await waitFor(() => expect(result.current.tarefas).toHaveLength(1));
    const antes = result.current.tarefas;
    rerender();
    expect(result.current.tarefas).toBe(antes);
  });
});
