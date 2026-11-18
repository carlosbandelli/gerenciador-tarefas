import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  instalarIntersectionObserverFalso,
  type ObserverFalso,
} from "@/test/intersection-observer-falso";
import { useVisivel } from "./use-visivel";

let observers: ObserverFalso[];
beforeEach(() => {
  observers = instalarIntersectionObserverFalso();
});
afterEach(() => vi.unstubAllGlobals());

function Alvo({ aoEntrar, chave }: { aoEntrar: () => void; chave: boolean }) {
  const ref = useVisivel<HTMLDivElement>(aoEntrar, {
    rootMargin: "200px",
    reobservarQuando: chave,
  });
  return <div ref={ref} data-testid="alvo" />;
}

describe("useVisivel", () => {
  it("observa o elemento e chama o callback ao entrar", () => {
    const aoEntrar = vi.fn();
    const { getByTestId } = render(<Alvo aoEntrar={aoEntrar} chave />);
    expect(observers[0].observe).toHaveBeenCalledWith(getByTestId("alvo"));
    act(() => observers[0].disparar(true));
    expect(aoEntrar).toHaveBeenCalledOnce();
  });

  it("reobservarQuando muda: o observer antigo é desconectado e um novo observa", () => {
    const aoEntrar = vi.fn();
    const { rerender, getByTestId } = render(<Alvo aoEntrar={aoEntrar} chave />);
    rerender(<Alvo aoEntrar={aoEntrar} chave={false} />);
    expect(observers).toHaveLength(2);
    expect(observers[0].desconectado).toBe(true);
    expect(observers[1].observe).toHaveBeenCalledWith(getByTestId("alvo"));
    act(() => observers[1].disparar(true));
    expect(aoEntrar).toHaveBeenCalledOnce();
  });
});
