import { describe, expect, it } from "vitest";
import { RegraDeNegocioError } from "./erros";
import { MENSAGENS, TITULO_MAX } from "./regras";
import { Titulo } from "./titulo";

function capturar(fn: () => unknown): unknown {
  try {
    fn();
  } catch (erro) {
    return erro;
  }
  return undefined;
}

describe("Titulo", () => {
  it("aplica trim", () => {
    expect(Titulo.criar("  Comprar pão  ").valor).toBe("Comprar pão");
  });

  it.each(["", "   ", "\n\t"])("rejeita vazio (%j)", (texto) => {
    expect(() => Titulo.criar(texto)).toThrow(RegraDeNegocioError);
    expect(() => Titulo.criar(texto)).toThrow(MENSAGENS.tituloObrigatorio);
  });

  it("aceita exatamente o máximo e rejeita máximo + 1", () => {
    expect(Titulo.criar("a".repeat(TITULO_MAX)).valor).toHaveLength(TITULO_MAX);
    const erro = capturar(() => Titulo.criar("a".repeat(TITULO_MAX + 1)));
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("titulo");
    expect((erro as Error).message).toBe(MENSAGENS.tituloMuitoLongo);
  });

  it("conta emoji como 1 caractere (mesma métrica do Zod)", () => {
    expect(() => Titulo.criar("😀".repeat(TITULO_MAX))).not.toThrow();
    expect(() => Titulo.criar("😀".repeat(TITULO_MAX + 1))).toThrow(RegraDeNegocioError);
  });

  it("trim acontece antes de medir o tamanho", () => {
    expect(() => Titulo.criar(` ${"a".repeat(TITULO_MAX)} `)).not.toThrow();
  });

  it("igualdade por valor", () => {
    expect(Titulo.criar("a").equals(Titulo.criar(" a "))).toBe(true);
    expect(Titulo.criar("a").equals(Titulo.criar("b"))).toBe(false);
  });

  it("é imutável: o valor não muda por atribuição", () => {
    const titulo = Titulo.criar("a");
    expect(() => {
      // @ts-expect-error `valor` é somente leitura (getter sem setter)
      titulo.valor = "b";
    }).toThrow(TypeError);
    expect(titulo.valor).toBe("a");
  });
});
