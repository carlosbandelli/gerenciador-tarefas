import { describe, expect, it } from "vitest";
import { Descricao } from "./descricao";
import { RegraDeNegocioError } from "./erros";
import { DESCRICAO_MAX, MENSAGENS } from "./regras";

describe("Descricao", () => {
  it("aplica trim", () => {
    expect(Descricao.criar("  detalhe  ")?.valor).toBe("detalhe");
  });

  it.each(["", "   ", "\n"])("'sem descrição' (%j) vira null", (texto) => {
    expect(Descricao.criar(texto)).toBeNull();
  });

  it("null e undefined também viram null", () => {
    expect(Descricao.criar(null)).toBeNull();
    expect(Descricao.criar(undefined)).toBeNull();
  });

  it("aceita exatamente o máximo e rejeita máximo + 1", () => {
    expect(Descricao.criar("a".repeat(DESCRICAO_MAX))?.valor).toHaveLength(DESCRICAO_MAX);
    expect(() => Descricao.criar("a".repeat(DESCRICAO_MAX + 1))).toThrow(RegraDeNegocioError);
    expect(() => Descricao.criar("a".repeat(DESCRICAO_MAX + 1))).toThrow(
      MENSAGENS.descricaoMuitoLonga,
    );
  });

  it("conta emoji como 1 caractere", () => {
    expect(Descricao.criar("😀".repeat(DESCRICAO_MAX))).not.toBeNull();
    expect(() => Descricao.criar("😀".repeat(DESCRICAO_MAX + 1))).toThrow(RegraDeNegocioError);
  });

  it("igualdade por valor", () => {
    const a = Descricao.criar("a")!;
    expect(a.equals(Descricao.criar(" a ")!)).toBe(true);
    expect(a.equals(Descricao.criar("b")!)).toBe(false);
  });
});
