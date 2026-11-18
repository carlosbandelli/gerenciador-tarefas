import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TarefaItem } from "./tarefa-item";
import type { TarefaView } from "./tarefa-view";

const tarefa: TarefaView = {
  id: "abc-1",
  titulo: "Pagar contas",
  descricao: "Luz e internet",
  // 15:30 UTC = 12:30 em São Paulo (fuso fixo da apresentação)
  dataCriacao: new Date("2026-11-17T15:30:00Z"),
};

describe("TarefaItem", () => {
  it("mostra título, descrição e data formatada", () => {
    render(<TarefaItem tarefa={tarefa} onExcluir={vi.fn()} excluindo={false} />);
    expect(screen.getByRole("heading", { name: "Pagar contas" })).toBeInTheDocument();
    expect(screen.getByText("Luz e internet")).toBeInTheDocument();
    expect(screen.getByText(/^Criada em/)).toBeInTheDocument();
  });

  it("data em <time> com dateTime ISO", () => {
    render(<TarefaItem tarefa={tarefa} onExcluir={vi.fn()} excluindo={false} />);
    expect(screen.getByText("17/11/2026 12:30")).toHaveAttribute(
      "datetime",
      "2026-11-17T15:30:00.000Z",
    );
  });

  it("sem descrição não renderiza parágrafo de descrição", () => {
    render(
      <TarefaItem
        tarefa={{ ...tarefa, descricao: undefined }}
        onExcluir={vi.fn()}
        excluindo={false}
      />,
    );
    expect(screen.queryByText("Luz e internet")).toBeNull();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("link Editar aponta para /tarefas/[id]/editar", () => {
    render(<TarefaItem tarefa={tarefa} onExcluir={vi.fn()} excluindo={false} />);
    expect(screen.getByRole("link", { name: "Editar Pagar contas" })).toHaveAttribute(
      "href",
      "/tarefas/abc-1/editar",
    );
  });

  it("Excluir abre o diálogo e confirmar chama onExcluir(id, aoConcluir)", async () => {
    const onExcluir = vi.fn();
    render(<TarefaItem tarefa={tarefa} onExcluir={onExcluir} excluindo={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir Pagar contas" }));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(onExcluir).toHaveBeenCalledWith("abc-1", expect.any(Function));
  });
});
