import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DESCRICAO_MAX, TITULO_MAX, tamanho } from "./regras";

describe("tamanho", () => {
  it("conta texto ASCII e acentuado por caractere", () => {
    expect(tamanho("")).toBe(0);
    expect(tamanho("ação")).toBe(4);
  });

  it("conta emoji (par substituto) como 1", () => {
    expect(tamanho("😀")).toBe(1);
    expect(tamanho("😀".repeat(61))).toBe(61);
  });

  // Garante que o domínio e o Zod (borda) aceitam/recusam exatamente os mesmos textos.
  it.each([
    ["ascii", "a"],
    ["emoji", "😀"],
    ["misto", "a😀"],
  ])("concorda com o Zod no limite (%s)", (_nome, unidade) => {
    const zod = z.string().max(TITULO_MAX);
    for (const n of [TITULO_MAX - 1, TITULO_MAX, TITULO_MAX + 1, TITULO_MAX * 2]) {
      const texto = unidade.repeat(n);
      expect(tamanho(texto) <= TITULO_MAX, `n=${n}`).toBe(zod.safeParse(texto).success);
    }
  });

  it("concorda com o Zod para a descrição", () => {
    const zod = z.string().max(DESCRICAO_MAX);
    for (const n of [DESCRICAO_MAX, DESCRICAO_MAX + 1]) {
      const texto = "😀".repeat(n);
      expect(tamanho(texto) <= DESCRICAO_MAX).toBe(zod.safeParse(texto).success);
    }
  });
});
