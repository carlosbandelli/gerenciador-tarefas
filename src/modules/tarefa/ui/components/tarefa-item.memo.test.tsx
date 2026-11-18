import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import { tarefaItemPropsIguais } from "./tarefa-item";
import type { TarefaView } from "./tarefa-view";
import { TarefasPagina } from "./tarefas-pagina";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// INSTRUMENTAÇÃO sem tocar na produção: o `ExcluirTarefaDialog` é filho direto do `TarefaItem` e
// NÃO é memoizado, então ele renderiza exatamente quando o item renderiza. Um wrapper que conta
// por `id` e delega ao componente real mede os renders do item. Alternativas descartadas:
// `Profiler` só reporta por subárvore (não por item) e exigiria exportar o interno sem `memo`;
// um `useRenderCount` exigiria código de teste dentro do componente de produção.
const renders = vi.hoisted(() => new Map<string, number>());
vi.mock("./excluir-tarefa-dialog", async (importOriginal) => {
  const original = await importOriginal<typeof import("./excluir-tarefa-dialog")>();
  return {
    ...original,
    ExcluirTarefaDialog: (props: React.ComponentProps<typeof original.ExcluirTarefaDialog>) => {
      renders.set(props.id!, (renders.get(props.id!) ?? 0) + 1);
      return <original.ExcluirTarefaDialog {...props} />;
    },
  };
});

beforeEach(() => renders.clear());

const rendersDe = (id: string) => renders.get(id) ?? 0;
const foto = () => new Map(renders);

async function montar() {
  const ambiente = criarAmbienteDeTeste();
  const { tarefaService } = ambiente.container;
  const a = await tarefaService.criar({ titulo: "Alpha" });
  const b = await tarefaService.criar({ titulo: "Bravo" });
  const c = await tarefaService.criar({ titulo: "Charlie" });
  render(<TarefasPagina />, { wrapper: ambiente.Providers });
  await screen.findAllByRole("listitem");
  // Assenta: depois do 1º commit nada mais deve estar em voo.
  await waitFor(() => expect(ambiente.queryClient.isFetching()).toBe(0));
  return { ...ambiente, ids: { Alpha: a.id, Bravo: b.id, Charlie: c.id } };
}

// Títulos dos itens que re-renderizaram desde a foto.
function mudaram(antes: Map<string, number>, ids: Record<string, string>) {
  return Object.entries(ids)
    .filter(([, id]) => rendersDe(id) !== (antes.get(id) ?? 0))
    .map(([titulo]) => titulo);
}

describe("memoização do TarefaItem (contagem de renders)", () => {
  it("A: excluir o do meio não re-renderiza os outros dois", async () => {
    const { ids, queryClient } = await montar();
    // Cada item renderizou uma vez na montagem (sem isso a contagem não prova nada).
    expect([ids.Alpha, ids.Bravo, ids.Charlie].map(rendersDe)).toEqual([1, 1, 1]);
    const antes = foto();

    // Fluxo real: diálogo + mutation + remoção do cache + invalidação (refetch).
    await userEvent.click(screen.getByRole("button", { name: "Excluir Bravo" }));
    const dialogo = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.queryByText("Bravo")).toBeNull());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(mudaram(antes, { Alpha: ids.Alpha, Charlie: ids.Charlie })).toEqual([]);
  });

  it("B: refetch que devolve os mesmos dados (Date novos) não re-renderiza ninguém", async () => {
    const { ids, queryClient } = await montar();
    const antes = foto();
    const dataAntes = queryClient.getQueryCache().findAll()[0].state.data as {
      pages: { itens: { dataCriacao: Date }[] }[];
    };

    await act(() => queryClient.invalidateQueries());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Prova que o refetch ocorreu e que o `Date` é OUTRO objeto (premissa do comparador custom).
    const dataDepois = queryClient.getQueryCache().findAll()[0].state.data as typeof dataAntes;
    expect(dataDepois.pages[0].itens[0]).not.toBe(dataAntes.pages[0].itens[0]);
    expect(dataDepois.pages[0].itens[0].dataCriacao).not.toBe(
      dataAntes.pages[0].itens[0].dataCriacao,
    );
    expect(mudaram(antes, ids)).toEqual([]);
  });

  it("C: mudança real de título re-renderiza SÓ esse item", async () => {
    const { ids, queryClient, container } = await montar();
    const antes = foto();

    await container.tarefaService.atualizar(ids.Bravo, { titulo: "Bravo 2" });
    await act(() => queryClient.invalidateQueries());
    await screen.findByText("Bravo 2");
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(mudaram(antes, ids)).toEqual(["Bravo"]);
  });

  it("D: marcar um item como excluindo re-renderiza SÓ ele", async () => {
    const { ids, container } = await montar();
    // Exclusão controlada pelo teste: mantém a mutation pendente (`excluindo` = true).
    let liberar!: () => void;
    const original = container.tarefaService.deletar.bind(container.tarefaService);
    vi.spyOn(container.tarefaService, "deletar").mockImplementation(async (id) => {
      await new Promise<void>((resolve) => (liberar = resolve));
      return original(id);
    });
    const antes = foto();

    await userEvent.click(screen.getByRole("button", { name: "Excluir Charlie" }));
    const dialogo = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(rendersDe(ids.Charlie)).toBeGreaterThan(antes.get(ids.Charlie)!));

    expect(mudaram(antes, { Alpha: ids.Alpha, Bravo: ids.Bravo })).toEqual([]);
    await act(async () => liberar());
    await waitFor(() => expect(screen.queryByText("Charlie")).toBeNull());
  });
});

describe("tarefaItemPropsIguais", () => {
  const onExcluir = vi.fn();
  const tarefa: TarefaView = {
    id: "1",
    titulo: "T",
    descricao: "D",
    dataCriacao: new Date("2026-01-01T00:00:00Z"),
    dataAtualizacao: new Date("2026-01-02T00:00:00Z"),
  };
  const base = { tarefa, onExcluir, excluindo: false };
  const com = (t: Partial<TarefaView>, resto = {}) => ({
    ...base,
    tarefa: { ...tarefa, ...t },
    ...resto,
  });

  it("iguais mesmo com objeto tarefa e Date NOVOS de mesmo conteúdo", () => {
    const clone = com({
      dataCriacao: new Date(tarefa.dataCriacao.getTime()),
      dataAtualizacao: new Date(tarefa.dataAtualizacao!.getTime()),
    });
    expect(tarefaItemPropsIguais(base, clone)).toBe(true);
  });

  it("ignora dataCriacao (imutável)", () => {
    expect(tarefaItemPropsIguais(base, com({ dataCriacao: new Date(0) }))).toBe(true);
  });

  it.each([
    ["id", com({ id: "2" })],
    ["titulo", com({ titulo: "outro" })],
    ["descricao", com({ descricao: "outra" })],
    ["descricao removida", com({ descricao: undefined })],
    ["dataAtualizacao", com({ dataAtualizacao: new Date("2026-01-03T00:00:00Z") })],
    ["dataAtualizacao ausente", com({ dataAtualizacao: undefined })],
    ["excluindo", com({}, { excluindo: true })],
    ["onExcluir", com({}, { onExcluir: vi.fn() })],
  ])("diferente quando muda %s", (_campo, proximo) => {
    expect(tarefaItemPropsIguais(base, proximo)).toBe(false);
  });
});
