import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErroAoCarregar } from "./erro-ao-carregar";
import { ListaCarregando } from "./lista-carregando";
import { ListaVazia } from "./lista-vazia";

describe("ListaVazia", () => {
  it("convida a criar a primeira tarefa", () => {
    render(<ListaVazia />);
    expect(screen.getByText("Nenhuma tarefa ainda")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar a primeira tarefa" })).toHaveAttribute(
      "href",
      "/tarefas/nova",
    );
  });
});

describe("ErroAoCarregar", () => {
  it("mostra alerta e chama onTentarNovamente", async () => {
    const onTentarNovamente = vi.fn();
    render(<ErroAoCarregar onTentarNovamente={onTentarNovamente} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as tarefas");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onTentarNovamente).toHaveBeenCalledOnce();
  });
});

describe("ListaCarregando", () => {
  it("marca a região como ocupada", () => {
    render(<ListaCarregando />);
    expect(screen.getByText("Carregando tarefas…")).toHaveClass("sr-only");
    expect(screen.getByRole("status", { name: "Carregando tarefas" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
