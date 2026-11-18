import { TRPCError } from "@trpc/server";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import { NovaTarefa } from "./nova-tarefa";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function montar() {
  const ambiente = criarAmbienteDeTeste();
  render(<NovaTarefa />, { wrapper: ambiente.Providers });
  return ambiente;
}

describe("NovaTarefa", () => {
  beforeEach(() => push.mockClear());

  it("cria com sucesso: tarefa no service, toast e redireciona para /tarefas", async () => {
    const { container } = montar();
    await userEvent.type(screen.getByLabelText("Título"), "  Estudar  ");
    await userEvent.type(screen.getByLabelText("Descrição"), "React");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));
    expect(toast.success).toHaveBeenCalledWith("Tarefa criada");
    const { itens } = await container.tarefaService.listar({ limit: 10 });
    expect(itens.map((t) => [t.titulo, t.descricao])).toEqual([["Estudar", "React"]]);
  });

  it("título vazio: nada vai ao servidor nem redireciona", async () => {
    const { container } = montar();
    const criar = vi.spyOn(container.tarefaService, "criar");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O título é obrigatório")).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("erro de regra do servidor (domínio, com campo) aparece no campo, sem redirect", async () => {
    const { container } = montar();
    // Simula o servidor recusando algo que o front aceitou.
    const { RegraDeNegocioError } = await import("../../domain/erros");
    vi.spyOn(container.tarefaService, "criar").mockRejectedValue(
      new RegraDeNegocioError("Título já existe", "titulo"),
    );
    await userEvent.type(screen.getByLabelText("Título"), "Duplicada");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const erro = await screen.findByText("Título já existe");
    expect(screen.getByLabelText("Título").getAttribute("aria-describedby")).toContain(erro.id);
    expect(push).not.toHaveBeenCalled();
    // erro em campo do form não vira toast
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("zodError.fieldErrors do servidor chega ao campo pela UI (valor que o front aceita)", async () => {
    const { container } = montar();
    // O front aceita "Bloqueado"; o servidor recusa com 400 + ZodError por campo (o formatter do
    // tRPC só preenche `data.zodError` quando a `cause` é um ZodError).
    const zod = z
      .object({ titulo: z.string().refine(() => false, { error: "Título recusado pela API" }) })
      .safeParse({ titulo: "Bloqueado" }).error!;
    vi.spyOn(container.tarefaService, "criar").mockRejectedValue(
      new TRPCError({ code: "BAD_REQUEST", cause: zod }),
    );
    await userEvent.type(screen.getByLabelText("Título"), "Bloqueado");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const erro = await screen.findByText("Título recusado pela API");
    expect(screen.getByLabelText("Título").getAttribute("aria-describedby")).toContain(erro.id);
    expect(push).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("novo submit válido limpa o erro do servidor e o campo corrigido o remove", async () => {
    const { container } = montar();
    const { RegraDeNegocioError } = await import("../../domain/erros");
    const original = container.tarefaService.criar.bind(container.tarefaService);
    vi.spyOn(container.tarefaService, "criar")
      .mockRejectedValueOnce(new RegraDeNegocioError("Título já existe", "titulo"))
      .mockImplementation(original);
    await userEvent.type(screen.getByLabelText("Título"), "Dup");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText("Título já existe");

    await userEvent.type(screen.getByLabelText("Título"), "2");
    await waitFor(() => expect(screen.queryByText("Título já existe")).toBeNull());
    expect(screen.getByLabelText("Título")).not.toHaveAttribute("aria-invalid");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));
  });

  it("toast e invalidação acontecem ANTES do router.push", async () => {
    const { queryClient } = montar();
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.type(screen.getByLabelText("Título"), "Ordem");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const ordemPush = push.mock.invocationCallOrder[0];
    expect(toast.success.mock.invocationCallOrder[0]).toBeLessThan(ordemPush);
    expect(invalidar.mock.invocationCallOrder[0]).toBeLessThan(ordemPush);
  });

  it("salvando: botão 'Salvando...' aria-disabled e Enter ignorado (1 só chamada)", async () => {
    const { container } = montar();
    let liberar!: () => void;
    const original = container.tarefaService.criar.bind(container.tarefaService);
    const criar = vi.spyOn(container.tarefaService, "criar").mockImplementation(async (c) => {
      await new Promise<void>((resolve) => (liberar = resolve));
      return original(c);
    });
    await userEvent.type(screen.getByLabelText("Título"), "Lenta");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const botao = await screen.findByRole("button", { name: "Salvando..." });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(screen.getByLabelText("Título"), "{Enter}");
    await userEvent.click(botao);
    expect(criar).toHaveBeenCalledTimes(1);
    await act(async () => liberar());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));
  });

  it("depois do sucesso o form continua bloqueado (até a rota mudar): Enter não duplica", async () => {
    const { container } = montar();
    const criar = vi.spyOn(container.tarefaService, "criar");
    await userEvent.type(screen.getByLabelText("Título"), "Uma vez");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/tarefas"));

    // `push` (mock) não desmonta nada: o form segue na tela, como na janela real antes da navegação.
    expect(screen.getByRole("button", { name: "Salvando..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.type(screen.getByLabelText("Título"), "{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Salvando..." }));
    expect(criar).toHaveBeenCalledTimes(1);
    expect((await container.tarefaService.listar({ limit: 10 })).itens).toHaveLength(1);
  });

  it("erro sem campo vira toast e não redireciona", async () => {
    const { container } = montar();
    vi.spyOn(container.tarefaService, "criar").mockRejectedValue(new Error("boom"));
    await userEvent.type(screen.getByLabelText("Título"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro interno. Tente novamente."));
    expect(push).not.toHaveBeenCalled();
  });
});
