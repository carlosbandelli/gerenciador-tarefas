import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TarefaLista } from "./tarefa-lista";

const tarefas = [1, 2, 3].map((n) => ({
  id: `id-${n}`,
  titulo: `Tarefa ${n}`,
  dataCriacao: new Date("2026-11-17T15:30:00Z"),
}));

describe("TarefaLista", () => {
  it("renderiza uma lista acessível com N itens", () => {
    render(
      <>
        <h1 id="titulo">Minhas tarefas</h1>
        <TarefaLista
          tarefas={tarefas}
          onExcluir={vi.fn()}
          estaExcluindo={() => false}
          rotuloId="titulo"
        />
      </>,
    );
    expect(screen.getByRole("list", { name: "Minhas tarefas" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("repassa estaExcluindo por id ao diálogo", async () => {
    render(
      <TarefaLista
        tarefas={tarefas}
        onExcluir={vi.fn()}
        estaExcluindo={(id) => id === "id-2"}
        rotuloId="x"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir Tarefa 2" }));
    expect(await screen.findByRole("button", { name: "Excluindo…" })).toBeInTheDocument();
  });

  it("só o item em exclusão mostra Excluindo…; os outros mostram Excluir", async () => {
    render(
      <TarefaLista
        tarefas={tarefas}
        onExcluir={vi.fn()}
        estaExcluindo={(id) => id === "id-2"}
        rotuloId="x"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir Tarefa 1" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByRole("button", { name: "Excluir" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    expect(screen.queryByRole("button", { name: "Excluindo…" })).toBeNull();
  });
});
