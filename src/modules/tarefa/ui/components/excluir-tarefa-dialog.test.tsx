import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExcluirTarefaDialog } from "./excluir-tarefa-dialog";

function abrir() {
  return userEvent.click(screen.getByRole("button", { name: "Excluir Pagar contas" }));
}

describe("ExcluirTarefaDialog", () => {
  it("abre ao clicar no gatilho, com título e descrição acessíveis", async () => {
    render(<ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await abrir();
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir “Pagar contas”?" });
    expect(dialogo).toHaveAccessibleDescription("Essa ação não pode ser desfeita.");
  });

  it("Cancelar fecha sem chamar onConfirmar", async () => {
    const onConfirmar = vi.fn();
    render(
      <ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={onConfirmar} />,
    );
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("Confirmar chama onConfirmar e o diálogo só fecha quando o pai conclui", async () => {
    let concluir!: () => void;
    const onConfirmar = vi.fn((aoConcluir: () => void) => {
      concluir = aoConcluir;
    });
    render(
      <ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={onConfirmar} />,
    );
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(onConfirmar).toHaveBeenCalledOnce();
    // ainda aberto: a exclusão não terminou
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // clique repetido não duplica
    await userEvent.click(screen.getByRole("button", { name: "Excluindo…" }));
    expect(onConfirmar).toHaveBeenCalledOnce();

    concluir();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("não fecha enquanto exclui (Esc, Cancelar) e confirmar fica aria-disabled", async () => {
    const onConfirmar = vi.fn();
    const { rerender } = render(
      <ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={onConfirmar} />,
    );
    await abrir();
    await screen.findByRole("alertdialog");
    rerender(<ExcluirTarefaDialog titulo="Pagar contas" excluindo onConfirmar={onConfirmar} />);

    const confirmar = screen.getByRole("button", { name: "Excluindo…" });
    expect(confirmar).toHaveAttribute("aria-disabled", "true");
    expect(confirmar).not.toBeDisabled();
    await userEvent.click(confirmar);
    expect(onConfirmar).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("com excluindo=true por props, clique fora não fecha", async () => {
    render(<ExcluirTarefaDialog titulo="Pagar contas" excluindo onConfirmar={vi.fn()} />);
    await abrir();
    await screen.findByRole("alertdialog");
    await userEvent.click(document.body);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("após aoConcluir (erro), reabrir mostra confirmar habilitado", async () => {
    let concluir!: () => void;
    const onConfirmar = vi.fn((aoConcluir: () => void) => {
      concluir = aoConcluir;
    });
    render(
      <ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={onConfirmar} />,
    );
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    concluir();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await abrir();
    const confirmar = await screen.findByRole("button", { name: "Excluir" });
    expect(confirmar).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(confirmar);
    expect(onConfirmar).toHaveBeenCalledTimes(2);
  });

  it("fallback: excluindo true->false com envio ativo fecha o diálogo", async () => {
    const onConfirmar = vi.fn();
    const { rerender } = render(
      <ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={onConfirmar} />,
    );
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    rerender(<ExcluirTarefaDialog titulo="Pagar contas" excluindo onConfirmar={onConfirmar} />);
    rerender(
      <ExcluirTarefaDialog titulo="Pagar contas" excluindo={false} onConfirmar={onConfirmar} />,
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
