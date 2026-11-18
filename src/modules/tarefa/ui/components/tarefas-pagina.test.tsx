import { act, screen, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import { instalarIntersectionObserverFalso } from "@/test/intersection-observer-falso";
import { TarefasPagina } from "./tarefas-pagina";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("TarefasPagina", () => {
  it("sem tarefas mostra o estado vazio", async () => {
    const { Providers } = criarAmbienteDeTeste();
    render(<TarefasPagina />, { wrapper: Providers });
    expect(await screen.findByText("Nenhuma tarefa ainda")).toBeInTheDocument();
  });

  it("enquanto carrega mostra o esqueleto", () => {
    const { Providers } = criarAmbienteDeTeste();
    render(<TarefasPagina />, { wrapper: Providers });
    expect(screen.getByRole("status", { name: "Carregando tarefas" })).toBeInTheDocument();
  });

  it("com tarefas mostra a lista", async () => {
    const { Providers, container } = criarAmbienteDeTeste();
    await container.tarefaService.criar({ titulo: "A fazer", descricao: "detalhe" });
    await container.tarefaService.criar({ titulo: "Outra" });
    render(<TarefasPagina />, { wrapper: Providers });
    expect(await screen.findByText("A fazer")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("erro do servidor mostra ErroAoCarregar e Tentar novamente refaz a consulta", async () => {
    const { Providers, container } = criarAmbienteDeTeste();
    await container.tarefaService.criar({ titulo: "Voltou" });
    const original = container.tarefaService.listar.bind(container.tarefaService);
    vi.spyOn(container.tarefaService, "listar")
      .mockRejectedValueOnce(new Error("falha interna"))
      .mockImplementation(original);

    render(<TarefasPagina />, { wrapper: Providers });
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    // detalhe interno não vaza para a tela
    expect(screen.queryByText(/falha interna/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Voltou")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("erro ao atualizar com dados em cache mantém a lista e avisa discretamente", async () => {
    const { Providers, container, queryClient } = criarAmbienteDeTeste();
    await container.tarefaService.criar({ titulo: "Continua aqui" });
    render(<TarefasPagina />, { wrapper: Providers });
    expect(await screen.findByText("Continua aqui")).toBeInTheDocument();

    vi.spyOn(container.tarefaService, "listar").mockRejectedValue(new Error("falha interna"));
    await queryClient.invalidateQueries();

    expect(await screen.findByText("Não foi possível atualizar a lista.")).toBeInTheDocument();
    expect(screen.getByText("Continua aqui")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("TarefasPagina: carregamento incremental", () => {
  async function comTarefas(n: number) {
    const ambiente = criarAmbienteDeTeste();
    for (let i = 1; i <= n; i++) {
      await ambiente.container.tarefaService.criar({ titulo: `T${i}` });
    }
    return ambiente;
  }

  afterEach(() => vi.unstubAllGlobals());

  it("interseção carrega a próxima página até o fim, sem ids repetidos", async () => {
    const observers = instalarIntersectionObserverFalso();
    const { Providers } = await comTarefas(25);
    render(<TarefasPagina />, { wrapper: Providers });
    expect(await screen.findAllByRole("listitem")).toHaveLength(10);

    act(() => observers.filter((o) => !o.desconectado).forEach((o) => o.disparar(true)));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(20));

    act(() => observers.filter((o) => !o.desconectado).forEach((o) => o.disparar(true)));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(25));
    expect(screen.getByText("Você viu todas as tarefas")).toBeInTheDocument();

    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(new Set(titulos).size).toBe(25);
  });

  it("botão Carregar mais busca a próxima página", async () => {
    instalarIntersectionObserverFalso();
    const { Providers } = await comTarefas(12);
    render(<TarefasPagina />, { wrapper: Providers });
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(12));
    expect(screen.getByText("Você viu todas as tarefas")).toBeInTheDocument();
  });

  it("erro ao buscar a próxima página mantém a lista e oferece Tentar novamente", async () => {
    instalarIntersectionObserverFalso();
    const { Providers, container } = await comTarefas(12);
    render(<TarefasPagina />, { wrapper: Providers });
    await screen.findAllByRole("listitem");
    const original = container.tarefaService.listar.bind(container.tarefaService);
    vi.spyOn(container.tarefaService, "listar")
      .mockRejectedValueOnce(new Error("falha"))
      .mockImplementation(original);

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Não foi possível carregar mais tarefas.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByText("Não foi possível atualizar a lista.")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(12));
  });
});

describe("TarefasPagina: robustez do carregamento incremental", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function comTarefas(n: number) {
    const ambiente = criarAmbienteDeTeste();
    for (let i = 1; i <= n; i++) {
      await ambiente.container.tarefaService.criar({ titulo: `T${i}` });
    }
    return ambiente;
  }

  // Segura as chamadas a `listar` até `liberar()`; delega ao original. Registra as entradas.
  function segurarListar(container: Awaited<ReturnType<typeof comTarefas>>["container"]) {
    const original = container.tarefaService.listar.bind(container.tarefaService);
    let liberar!: () => void;
    const portao = new Promise<void>((r) => (liberar = r));
    let ativo = false;
    const espiao = vi.spyOn(container.tarefaService, "listar").mockImplementation(async (e) => {
      if (ativo) await portao;
      return original(e);
    });
    return {
      espiao,
      segurar: () => (ativo = true),
      liberar: () => liberar(),
    };
  }

  it("exclusão com o sentinela visível: NÃO pagina durante a reconciliação (refetch)", async () => {
    const observers = instalarIntersectionObserverFalso();
    const { Providers, container } = await comTarefas(12);
    render(<TarefasPagina />, { wrapper: Providers });
    await screen.findAllByRole("listitem");
    const { espiao, segurar, liberar } = segurarListar(container);
    segurar();
    const antes = espiao.mock.calls.length;

    await userEvent.click(screen.getAllByRole("button", { name: /^Excluir / })[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    // o refetch da lista (reconciliação) está em andamento, preso no portão
    await waitFor(() => expect(espiao.mock.calls.length).toBeGreaterThan(antes));
    const chamadasDuranteRefetch = espiao.mock.calls.length;

    act(() => observers.filter((o) => !o.desconectado).forEach((o) => o.disparar(true)));

    await new Promise((r) => setTimeout(r, 30));

    expect(espiao.mock.calls.length).toBe(chamadasDuranteRefetch);
    expect(espiao.mock.calls.slice(antes).every(([entrada]) => !entrada?.cursor)).toBe(true);
    liberar();
    // reconciliado: 11 restantes, 1ª página com 10
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(10));
  });

  it("retry após erro: dois cliques durante o retry geram UMA só requisição", async () => {
    instalarIntersectionObserverFalso();
    const { Providers, container } = await comTarefas(12);
    render(<TarefasPagina />, { wrapper: Providers });
    await screen.findAllByRole("listitem");
    const original = container.tarefaService.listar.bind(container.tarefaService);
    let liberar!: () => void;
    const portao = new Promise<void>((r) => (liberar = r));
    const espiao = vi
      .spyOn(container.tarefaService, "listar")
      .mockRejectedValueOnce(new Error("falha"))
      .mockImplementation(async (e) => {
        await portao;
        return original(e);
      });

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(espiao).toHaveBeenCalledTimes(2);

    const botao = screen.getByRole("button", { name: "Carregar mais" });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando mais…");
    await userEvent.click(botao);
    await userEvent.click(botao);
    expect(espiao).toHaveBeenCalledTimes(2);

    liberar();
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(12));
  });

  it("sentinela sempre visível: chega a 25 sozinho com exatamente 3 chamadas a listar", async () => {
    instalarIntersectionObserverFalso({ sempreVisivel: true });
    const { Providers, container } = await comTarefas(25);
    const espiao = vi.spyOn(container.tarefaService, "listar");
    render(<TarefasPagina />, { wrapper: Providers });

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(25));
    expect(screen.getByText("Você viu todas as tarefas")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(espiao).toHaveBeenCalledTimes(3);
  });

  it("desmontar durante o fetch da próxima página não gera erro nem aviso", async () => {
    instalarIntersectionObserverFalso();
    const { Providers, container } = await comTarefas(12);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { unmount } = render(<TarefasPagina />, { wrapper: Providers });
    await screen.findAllByRole("listitem");
    const { liberar, segurar } = segurarListar(container);
    segurar();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    unmount();
    liberar();
    await new Promise((r) => setTimeout(r, 50));

    expect(erro).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
  });
});
