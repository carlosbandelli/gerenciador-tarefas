import { act } from "@testing-library/react";
import { vi } from "vitest";

// Dublê de IntersectionObserver para o jsdom (que não o implementa). `disparar` simula a
// notificação do navegador.
export class ObserverFalso {
  desconectado = false;
  rootMargin: string;
  observe: ReturnType<typeof vi.fn>;
  unobserve = vi.fn();
  takeRecords = () => [];
  disconnect = () => {
    this.desconectado = true;
  };

  constructor(
    private readonly callback: IntersectionObserverCallback,
    opcoes?: IntersectionObserverInit,
    sempreVisivel = false,
  ) {
    this.rootMargin = opcoes?.rootMargin ?? "0px";
    this.observe = vi.fn(() => {
      // Como o navegador: ao observar um elemento já visível, notifica (assíncrono).
      if (sempreVisivel) {
        queueMicrotask(() => {
          if (!this.desconectado) act(() => this.disparar(true));
        });
      }
    });
  }

  disparar(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as never);
  }
}

// Instala o falso como global e devolve a lista (viva) de instâncias criadas.
// `sempreVisivel`: todo `observe()` dispara `isIntersecting: true` (sentinela sempre à vista).
export function instalarIntersectionObserverFalso({
  sempreVisivel = false,
}: { sempreVisivel?: boolean } = {}): ObserverFalso[] {
  const instancias: ObserverFalso[] = [];
  class Registrado extends ObserverFalso {
    constructor(cb: IntersectionObserverCallback, opcoes?: IntersectionObserverInit) {
      super(cb, opcoes, sempreVisivel);
      instancias.push(this);
    }
  }
  vi.stubGlobal("IntersectionObserver", Registrado);
  return instancias;
}
