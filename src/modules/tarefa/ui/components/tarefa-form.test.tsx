import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TarefaForm } from "./tarefa-form";

function montar(props: Partial<React.ComponentProps<typeof TarefaForm>> = {}) {
  const onSalvar = vi.fn();
  const utils = render(<TarefaForm modo="criar" onSalvar={onSalvar} salvando={false} {...props} />);
  return { onSalvar, ...utils };
}

const titulo = () => screen.getByLabelText("Título");
const descricao = () => screen.getByLabelText("Descrição");
const salvar = () => screen.getByRole("button", { name: /^Salvar/ });

describe("TarefaForm", () => {
  it("SSR: o HTML do servidor já traz os valores iniciais (value/conteúdo)", () => {
    const html = renderToString(
      <TarefaForm
        modo="editar"
        onSalvar={vi.fn()}
        salvando={false}
        valoresIniciais={{ titulo: "Planejar a semana", descricao: "Segunda a sexta" }}
      />,
    );
    expect(html).toContain('value="Planejar a semana"');
    expect(html).toContain("Segunda a sexta</textarea>");
  });

  it("rótulos ligados aos campos e botão Cancelar aponta para /tarefas", () => {
    montar();
    expect(titulo()).toBeInstanceOf(HTMLInputElement);
    expect(descricao()).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/tarefas");
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "    "],
  ])("título %s bloqueia o envio e mostra o erro ligado ao input", async (_n, valor) => {
    const { onSalvar } = montar();
    if (valor) await userEvent.type(titulo(), valor);
    await userEvent.click(salvar());

    const erro = await screen.findByText("O título é obrigatório");
    expect(onSalvar).not.toHaveBeenCalled();
    expect(titulo()).toHaveAttribute("aria-invalid", "true");
    expect(titulo().getAttribute("aria-describedby")).toContain(erro.id);
    // foco vai ao primeiro campo inválido
    await waitFor(() => expect(titulo()).toHaveFocus());
  });

  it("61 emojis (61 code points, 122 unidades UTF-16) cabem no título", async () => {
    const { onSalvar } = montar();
    expect(titulo()).not.toHaveAttribute("maxlength");
    await userEvent.click(titulo());
    await userEvent.paste("😀".repeat(61));
    await userEvent.click(salvar());
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("contador de caracteres conta code points e liga ao campo por aria-describedby", async () => {
    montar();
    expect(screen.getByText("0/120")).toBeInTheDocument();
    await userEvent.click(titulo());
    await userEvent.paste("😀😀");
    const contador = screen.getByText("2/120");
    expect(titulo().getAttribute("aria-describedby")).toContain(contador.id);
    expect(screen.getByText("0/1000")).toBeInTheDocument();
  });

  it("mensagem de erro é anunciada (role=alert) e referenciada por aria-errormessage", async () => {
    montar();
    await userEvent.click(salvar());
    const erro = await screen.findByRole("alert");
    expect(erro).toHaveTextContent("O título é obrigatório");
    expect(titulo()).toHaveAttribute("aria-errormessage", erro.id);
  });

  it("título é indicado como obrigatório visualmente", () => {
    montar();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("campos ficam somente leitura durante o envio", () => {
    montar({ salvando: true });
    expect(titulo()).toHaveAttribute("readonly");
    expect(descricao()).toHaveAttribute("readonly");
  });

  it("dois submits no mesmo tick chamam onSalvar uma única vez", async () => {
    const { onSalvar } = montar({ valoresIniciais: { titulo: "Pronto" } });
    const form = titulo().closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });

  it("a trava do duplo envio é liberada no tick seguinte (reenvio legítimo funciona)", async () => {
    const onSalvar = vi.fn();
    const props = { modo: "criar" as const, onSalvar, valoresIniciais: { titulo: "Pronto" } };
    const { rerender } = render(<TarefaForm {...props} salvando={false} />);
    await userEvent.click(salvar());
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    rerender(<TarefaForm {...props} salvando={true} />);
    rerender(<TarefaForm {...props} salvando={false} />);
    await userEvent.click(salvar());
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(2));
  });

  it("erro do servidor some ao corrigir o campo", async () => {
    const props = { modo: "criar" as const, onSalvar: vi.fn(), salvando: false };
    const { rerender } = render(<TarefaForm {...props} valoresIniciais={{ titulo: "X" }} />);
    await userEvent.click(salvar()); // 1º submit: o form passa a revalidar a cada mudança
    rerender(
      <TarefaForm
        {...props}
        valoresIniciais={{ titulo: "X" }}
        errosDoServidor={{ titulo: ["Rejeitado"] }}
      />,
    );
    await screen.findByText("Rejeitado");
    await userEvent.type(titulo(), "y");
    await waitFor(() => expect(screen.queryByText("Rejeitado")).toBeNull());
    expect(titulo()).not.toHaveAttribute("aria-invalid");
  });

  it("novo erro do servidor com o MESMO texto (objeto novo) é reaplicado", async () => {
    const props = { modo: "criar" as const, onSalvar: vi.fn(), salvando: false };
    const { rerender } = render(<TarefaForm {...props} valoresIniciais={{ titulo: "X" }} />);
    await userEvent.click(salvar());
    rerender(<TarefaForm {...props} errosDoServidor={{ titulo: ["Rejeitado"] }} />);
    await screen.findByText("Rejeitado");
    await userEvent.type(titulo(), "y");
    await waitFor(() => expect(screen.queryByText("Rejeitado")).toBeNull());
    rerender(<TarefaForm {...props} errosDoServidor={{ titulo: ["Rejeitado"] }} />);
    expect(await screen.findByText("Rejeitado")).toBeInTheDocument();
  });

  it("título com 121 caracteres mostra a mensagem do limite", async () => {
    const { onSalvar } = montar();
    // Sem `maxLength` HTML: o excesso é aceito na digitação e o Zod avisa.
    await userEvent.click(titulo());
    await userEvent.paste("a".repeat(121));
    await userEvent.click(salvar());
    expect(await screen.findByText("O título deve ter no máximo 120 caracteres")).toBeVisible();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("descrição com 1001 caracteres mostra a mensagem do limite e foca a descrição", async () => {
    const { onSalvar } = montar();
    await userEvent.type(titulo(), "Ok");
    await userEvent.click(descricao());
    await userEvent.paste("a".repeat(1001));
    await userEvent.click(salvar());
    const erro = await screen.findByText("A descrição deve ter no máximo 1000 caracteres");
    expect(descricao().getAttribute("aria-describedby")).toContain(erro.id);
    expect(onSalvar).not.toHaveBeenCalled();
    await waitFor(() => expect(descricao()).toHaveFocus());
  });

  it("envio válido chama onSalvar com os valores trimados (saída do schema)", async () => {
    const { onSalvar } = montar();
    await userEvent.type(titulo(), "  Comprar pão  ");
    await userEvent.type(descricao(), "  integral ");
    await userEvent.click(salvar());
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(onSalvar.mock.calls[0][0]).toEqual({ titulo: "Comprar pão", descricao: "integral" });
  });

  it("descrição vazia na criação vira undefined", async () => {
    const { onSalvar } = montar();
    await userEvent.type(titulo(), "Só título");
    await userEvent.click(salvar());
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar.mock.calls[0][0]).toEqual({ titulo: "Só título", descricao: undefined });
  });

  it("modo editar: parte dos valores iniciais e descrição vazia vira null (apagar)", async () => {
    const { onSalvar } = montar({
      modo: "editar",
      valoresIniciais: { titulo: "Velho", descricao: "algo" },
    });
    expect(titulo()).toHaveValue("Velho");
    await userEvent.clear(descricao());
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar.mock.calls[0][0]).toEqual({ titulo: "Velho", descricao: null });
  });

  it("salvando: mostra 'Salvando...', aria-disabled e ignora o envio", async () => {
    const { onSalvar } = montar({
      salvando: true,
      valoresIniciais: { titulo: "Pronto" },
    });
    const botao = screen.getByRole("button", { name: "Salvando..." });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(titulo(), "{Enter}");
    await userEvent.click(botao);
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("erro do servidor por campo aparece no campo, ligado ao input, com foco", async () => {
    montar({ errosDoServidor: { titulo: ["Título rejeitado pelo servidor"] } });
    const erro = await screen.findByText("Título rejeitado pelo servidor");
    expect(titulo()).toHaveAttribute("aria-invalid", "true");
    expect(titulo().getAttribute("aria-describedby")).toContain(erro.id);
    await waitFor(() => expect(titulo()).toHaveFocus());
  });
});
