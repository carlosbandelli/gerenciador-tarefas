import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import { EditarTarefa } from "./editar-tarefa";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

async function montar(dados = { titulo: "Original", descricao: "Detalhe" }) {
  const ambiente = criarAmbienteDeTeste();
  const tarefa = await ambiente.container.tarefaService.criar(dados);
  render(<EditarTarefa id={tarefa.id} />, { wrapper: ambiente.Providers });
  return { ...ambiente, tarefa };
}

describe("EditarTarefa", () => {
  beforeEach(() => push.mockClear());

  it("o formulário vem preenchido com a tarefa", async () => {
    await montar();
    expect(await screen.findByLabelText("Título")).toHaveValue("Original");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Detalhe");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("edita o título: service atualizado, toast e redireciona para /tarefas", async () => {
    const { container, tarefa } = await montar();
    const campo = await screen.findByLabelText("Título");
    await userEvent.clear(campo);
    await userEvent.type(campo, "  Novo título ");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));
    expect(toast.success).toHaveBeenCalledWith("Tarefa atualizada");
    const salva = await container.tarefaService.buscarPorId(tarefa.id);
    expect(salva.titulo).toBe("Novo título");
    expect(salva.descricao).toBe("Detalhe");
  });

  it("apagar a descrição (campo vazio) remove a descrição no service", async () => {
    const { container, tarefa } = await montar();
    await userEvent.clear(await screen.findByLabelText("Descrição"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));
    expect((await container.tarefaService.buscarPorId(tarefa.id)).descricao).toBeUndefined();
  });

  it("título vazio bloqueia o envio", async () => {
    const { container } = await montar();
    const atualizar = vi.spyOn(container.tarefaService, "atualizar");
    await userEvent.clear(await screen.findByLabelText("Título"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("O título é obrigatório")).toBeInTheDocument();
    expect(atualizar).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("tarefa excluída por outro antes de salvar: toast, aviso com o form montado e texto preservado", async () => {
    const { container, tarefa } = await montar();
    const campo = await screen.findByLabelText("Título");
    await container.tarefaService.deletar(tarefa.id);
    await userEvent.type(campo, " editado");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Essa tarefa foi excluída"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Voltar para a lista" })).toHaveAttribute(
      "href",
      "/tarefas",
    );
    // Aviso sem o subtítulo redundante; o form segue montado, com o texto digitado, e indisponível.
    expect(screen.queryByText("Ela pode ter sido excluída.")).toBeNull();
    expect(screen.getByLabelText("Título")).toHaveValue("Original editado");
    expect(screen.getByRole("button", { name: "Salvando..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("refetch com erro e dados presentes mantém o form e o texto digitado", async () => {
    const { container, queryClient } = await montar();
    const campo = await screen.findByLabelText("Título");
    await userEvent.type(campo, " digitado");
    vi.spyOn(container.tarefaService, "buscarPorId").mockRejectedValue(new Error("rede"));
    await act(() => queryClient.invalidateQueries());
    // O refetch falhou de fato (senão o teste não prova nada).
    await waitFor(() =>
      expect(queryClient.getQueryCache().findAll()[0].state.status).toBe("error"),
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Título")).toHaveValue("Original digitado");
  });

  it("após salvar, o detalhe vem do cache (setQueryData): sem novo fetch de buscarPorId", async () => {
    const { container } = await montar();
    const buscar = vi.spyOn(container.tarefaService, "buscarPorId");
    await userEvent.type(await screen.findByLabelText("Título"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));
    expect(buscar).toHaveBeenCalledTimes(1); // só a busca inicial
  });

  it("depois do sucesso o form fica bloqueado: Enter não envia de novo", async () => {
    const { container } = await montar();
    const atualizar = vi.spyOn(container.tarefaService, "atualizar");
    await userEvent.type(await screen.findByLabelText("Título"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Salvando..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.type(screen.getByLabelText("Título"), "{Enter}");
    expect(atualizar).toHaveBeenCalledTimes(1);
  });

  it("id inexistente no cliente (sem cache): mostra 'Tarefa não encontrada' com link", async () => {
    const ambiente = criarAmbienteDeTeste();
    render(<EditarTarefa id="00000000-0000-4000-8000-000000000000" />, {
      wrapper: ambiente.Providers,
    });
    expect(await screen.findByText("Tarefa não encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para a lista" })).toBeInTheDocument();
  });

  it("enquanto carrega mostra o estado de carregando", async () => {
    const ambiente = criarAmbienteDeTeste();
    const tarefa = await ambiente.container.tarefaService.criar({ titulo: "A" });
    render(<EditarTarefa id={tarefa.id} />, { wrapper: ambiente.Providers });
    expect(screen.getByRole("status", { name: "Carregando tarefa" })).toBeInTheDocument();
    await act(async () => {});
    await screen.findByLabelText("Título");
  });
});
