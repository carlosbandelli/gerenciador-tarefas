import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  instalarIntersectionObserverFalso,
  type ObserverFalso,
} from "@/test/intersection-observer-falso";
import { CarregarMais } from "./carregar-mais";

let observers: ObserverFalso[];
beforeEach(() => {
  observers = instalarIntersectionObserverFalso();
});
afterEach(() => vi.unstubAllGlobals());

const base = { temMais: true, carregando: false, ocupado: false, erro: false };

function interseccionar() {
  act(() => observers.filter((o) => !o.desconectado).forEach((o) => o.disparar(true)));
}

describe("CarregarMais", () => {
  it("interseção do sentinela chama onCarregarMais", () => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} onCarregarMais={onCarregarMais} />);
    expect(observers[0].rootMargin).toBe("200px");
    interseccionar();
    expect(onCarregarMais).toHaveBeenCalledOnce();
  });

  it("sair da viewport não chama", () => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} onCarregarMais={onCarregarMais} />);
    act(() => observers[0].disparar(false));
    expect(onCarregarMais).not.toHaveBeenCalled();
  });

  it.each([
    ["carregando", { carregando: true, ocupado: true }],
    ["ocupado (outro fetch, ex.: reconciliação)", { ocupado: true }],
    ["com erro", { erro: true }],
  ])("não chama a interseção quando %s", (_nome, parcial) => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} {...parcial} onCarregarMais={onCarregarMais} />);
    interseccionar();
    expect(onCarregarMais).not.toHaveBeenCalled();
  });

  it("botão Carregar mais chama o callback", async () => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} onCarregarMais={onCarregarMais} />);
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(onCarregarMais).toHaveBeenCalledOnce();
  });

  it("durante o carregamento: aria-disabled (não disabled), texto de status e clique ignorado", async () => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} carregando ocupado onCarregarMais={onCarregarMais} />);
    const botao = screen.getByRole("button", { name: "Carregar mais" });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando mais…");
    await userEvent.click(botao);
    expect(onCarregarMais).not.toHaveBeenCalled();
  });

  it("retry com erro: carregando tem prioridade (sem alerta, clique ignorado)", async () => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} erro carregando ocupado onCarregarMais={onCarregarMais} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando mais…");
    const botao = screen.getByRole("button");
    expect(botao).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(botao);
    expect(onCarregarMais).not.toHaveBeenCalled();
  });

  it("região viva sempre montada; só o texto muda", () => {
    const { rerender } = render(<CarregarMais {...base} onCarregarMais={vi.fn()} />);
    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();
    rerender(<CarregarMais {...base} carregando ocupado onCarregarMais={vi.fn()} />);
    expect(screen.getByRole("status")).toBe(regiao);
    expect(regiao).toHaveTextContent("Carregando mais…");
    rerender(<CarregarMais {...base} temMais={false} onCarregarMais={vi.fn()} />);
    expect(screen.getByRole("status")).toBe(regiao);
    expect(regiao).toHaveTextContent("Você viu todas as tarefas");
  });

  it("sem mais páginas: mensagem de fim, nenhum botão e nenhum sentinela observado", () => {
    render(<CarregarMais {...base} temMais={false} onCarregarMais={vi.fn()} />);
    expect(screen.getByText("Você viu todas as tarefas")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(observers.filter((o) => !o.desconectado)).toHaveLength(0);
  });

  it("última página: o foco vai para a mensagem de fim se estava no botão", () => {
    const { rerender } = render(<CarregarMais {...base} onCarregarMais={vi.fn()} />);
    screen.getByRole("button", { name: "Carregar mais" }).focus();
    rerender(<CarregarMais {...base} temMais={false} onCarregarMais={vi.fn()} />);
    expect(screen.getByText("Você viu todas as tarefas")).toHaveFocus();
  });

  it("última página: não rouba o foco se ele estava em outro lugar", () => {
    const tela = (temMais: boolean) => (
      <>
        <button>outro</button>
        <CarregarMais {...base} temMais={temMais} onCarregarMais={vi.fn()} />
      </>
    );
    const { rerender } = render(tela(true));
    screen.getByRole("button", { name: "outro" }).focus();
    rerender(tela(false));
    expect(screen.getByRole("button", { name: "outro" })).toHaveFocus();
  });

  it("erro mostra mensagem e Tentar novamente chama o callback", async () => {
    const onCarregarMais = vi.fn();
    render(<CarregarMais {...base} erro onCarregarMais={onCarregarMais} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar mais tarefas");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onCarregarMais).toHaveBeenCalledOnce();
  });

  it("versaoDaLista muda: re-observa o sentinela (continua visível após carregar)", () => {
    const { rerender } = render(
      <CarregarMais {...base} versaoDaLista={10} onCarregarMais={vi.fn()} />,
    );
    rerender(<CarregarMais {...base} versaoDaLista={20} onCarregarMais={vi.fn()} />);
    expect(observers).toHaveLength(2);
    expect(observers[0].desconectado).toBe(true);
  });

  it("desconecta o observer ao desmontar", () => {
    const { unmount } = render(<CarregarMais {...base} onCarregarMais={vi.fn()} />);
    unmount();
    expect(observers.every((o) => o.desconectado)).toBe(true);
  });

  it("trocar a identidade do callback não recria o observer e usa o mais recente", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(<CarregarMais {...base} onCarregarMais={a} />);
    rerender(<CarregarMais {...base} onCarregarMais={b} />);
    expect(observers).toHaveLength(1);
    interseccionar();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
