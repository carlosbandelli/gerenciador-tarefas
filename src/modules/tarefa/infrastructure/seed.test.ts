import { describe, expect, it } from "vitest";
import { TITULO_MAX } from "../domain/regras";
import { GeradorDeIdUuid } from "./gerador-de-id-uuid";
import { criarTarefasDeExemplo } from "./seed";

const agora = new Date("2026-06-01T12:00:00Z");
const gerar = (quantidade?: number) =>
  criarTarefasDeExemplo({ quantidade, agora, geradorDeId: new GeradorDeIdUuid() });

describe("criarTarefasDeExemplo", () => {
  it("gera 25 tarefas por padrão", () => {
    expect(gerar()).toHaveLength(25);
  });

  it("respeita a quantidade pedida (inclusive maior que o banco de textos)", () => {
    expect(gerar(3)).toHaveLength(3);
    expect(gerar(60)).toHaveLength(60);
    expect(gerar(0)).toHaveLength(0);
  });

  it("a mais recente tem a data `agora`; 1 minuto entre cada, todas distintas", () => {
    const datas = gerar().map((t) => t.dataCriacao.getTime());
    expect(new Set(datas).size).toBe(25);
    datas.forEach((d, i) => expect(d).toBe(agora.getTime() - i * 60_000));
  });

  it("é determinística em títulos e datas", () => {
    const resumo = (ts: ReturnType<typeof gerar>) =>
      ts.map((t) => [t.titulo.valor, t.descricao?.valor, t.dataCriacao.getTime()]);
    expect(resumo(gerar())).toEqual(resumo(gerar()));
  });

  it("tem tarefas com e sem descrição e textos fictícios (sem @)", () => {
    const ts = gerar();
    expect(ts.some((t) => t.descricao === null)).toBe(true);
    expect(ts.some((t) => t.descricao !== null)).toBe(true);
    for (const t of ts) {
      expect(`${t.titulo.valor} ${t.descricao?.valor ?? ""}`).not.toContain("@");
    }
  });

  it("quantidade negativa ou inválida devolve lista vazia", () => {
    expect(gerar(-3)).toEqual([]);
    expect(gerar(Number.NaN)).toEqual([]);
  });

  it("todo título respeita TITULO_MAX, inclusive com sufixo", () => {
    for (const t of gerar(200))
      expect(Array.from(t.titulo.valor).length).toBeLessThanOrEqual(TITULO_MAX);
  });

  it("ids únicos", () => {
    expect(new Set(gerar().map((t) => t.id.valor)).size).toBe(25);
  });
});
