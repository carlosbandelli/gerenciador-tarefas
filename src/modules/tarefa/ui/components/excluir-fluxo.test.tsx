import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import { TITULO_DA_LISTA_ID } from "../constantes";
import { TarefasPagina } from "./tarefas-pagina";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// A page real põe o <h1>; aqui o teste o fornece (o container só o foca por id).
async function montar(titulos: string[]) {
  const ambiente = criarAmbienteDeTeste();
  const ids: string[] = [];
  for (const titulo of titulos) {
    ids.push((await ambiente.container.tarefaService.criar({ titulo })).id);
  }
  render(
    <>
      <h1 id={TITULO_DA_LISTA_ID} tabIndex={-1}>
        Tarefas
      </h1>
      <TarefasPagina />
    </>,
    { wrapper: ambiente.Providers },
  );
  await screen.findAllByRole("listitem");
  return { ...ambiente, ids };
}

// Títulos na ordem em que a lista os mostra (criações no mesmo ms desempatam por id aleatório,
// então a ordem NÃO é a de criação).
function ordem() {
  return screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent!);
}

async function excluirPeloDialogo(titulo: string) {
  await userEvent.click(screen.getByRole("button", { name: `Excluir ${titulo}` }));
  const dialogo = await screen.findByRole("alertdialog");
  await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));
}

describe("fluxo de exclusão", () => {
  it("confirma: item some, toast de sucesso e foco no Excluir do próximo item", async () => {
    await montar(["A", "B", "C"]);
    const [, segundo, terceiro] = ordem();
    await excluirPeloDialogo(segundo);

    await waitFor(() => expect(screen.queryByText(segundo)).toBeNull());
    expect(toast.success).toHaveBeenCalledWith("Tarefa excluída");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: `Excluir ${terceiro}` })).toHaveFocus(),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("excluir o último da lista manda o foco ao item anterior", async () => {
    await montar(["A", "B", "C"]);
    const [, segundo, terceiro] = ordem();
    await excluirPeloDialogo(terceiro);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: `Excluir ${segundo}` })).toHaveFocus(),
    );
  });

  it("excluir a última restante manda o foco ao título", async () => {
    await montar(["A"]);
    await excluirPeloDialogo("A");
    await screen.findByText("Nenhuma tarefa ainda");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
  });

  it("cancelar não exclui e devolve o foco ao gatilho", async () => {
    const { container } = await montar(["A", "B"]);
    await userEvent.click(screen.getByRole("button", { name: "Excluir A" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Excluir A" })).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(await container.tarefaService.listar({ limit: 10 })).toMatchObject({
      itens: expect.arrayContaining([expect.objectContaining({ titulo: "A" })]),
    });
  });

  it("já excluída por outro: toast do servidor e a lista reconcilia", async () => {
    const { container, ids } = await montar(["A", "B"]);
    await userEvent.click(screen.getByRole("button", { name: "Excluir A" }));
    const dialogo = await screen.findByRole("alertdialog");
    await container.tarefaService.deletar(ids[0]);
    await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Tarefa não encontrada"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(screen.queryByText("A")).toBeNull());
    expect(screen.getByText("B")).toBeInTheDocument();
    // o foco vai ao vizinho, não ao <body>
    await waitFor(() => expect(screen.getByRole("button", { name: "Excluir B" })).toHaveFocus());
  });

  it("erro inesperado: toast genérico, diálogo fecha e o item permanece", async () => {
    const { container } = await montar(["A", "B"]);
    vi.spyOn(container.tarefaService, "deletar").mockRejectedValue(new Error("segredo interno"));
    await excluirPeloDialogo("A");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro interno. Tente novamente."));
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("segredo"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await waitFor(() => expect(screen.getByRole("button", { name: "Excluir A" })).toHaveFocus());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("não fecha enquanto exclui", async () => {
    const { container } = await montar(["A"]);
    let liberar!: () => void;
    const portao = new Promise<void>((r) => (liberar = r));
    const original = container.tarefaService.deletar.bind(container.tarefaService);
    vi.spyOn(container.tarefaService, "deletar").mockImplementation(async (id) => {
      await portao;
      return original(id);
    });
    await excluirPeloDialogo("A");

    expect(await screen.findByRole("button", { name: "Excluindo…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    liberar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa excluída"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    // única tarefa: o foco vai ao título
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
  });
});
