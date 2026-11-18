import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import {
  DadoInconsistenteError,
  RegraDeNegocioError,
  TarefaNaoEncontradaError,
} from "../domain/erros";
import { TarefaId } from "../domain/tarefa-id";
import { mapearErroDeDominio } from "./mapear-erro-de-dominio";

const ID = TarefaId.criar("11111111-1111-4111-8111-111111111111");

describe("mapearErroDeDominio", () => {
  it("TarefaNaoEncontradaError -> NOT_FOUND", () => {
    const erro = mapearErroDeDominio(new TarefaNaoEncontradaError(ID));
    expect(erro).toBeInstanceOf(TRPCError);
    expect(erro).toMatchObject({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
  });

  it("TarefaNaoEncontradaError preserva o erro original em cause", () => {
    const origem = new TarefaNaoEncontradaError(ID);
    expect(mapearErroDeDominio(origem).cause).toBe(origem);
  });

  it("RegraDeNegocioError sem campo -> campo undefined", () => {
    const erro = mapearErroDeDominio(new RegraDeNegocioError("Regra sem campo"));
    expect(erro).toMatchObject({ code: "BAD_REQUEST", message: "Regra sem campo" });
    expect(erro.campo).toBeUndefined();
  });

  it("DadoInconsistenteError NÃO é reconhecido: é relançado (vira 500)", () => {
    const origem = new DadoInconsistenteError("dado corrompido", "titulo");
    expect(() => mapearErroDeDominio(origem)).toThrow(origem);
  });

  it("RegraDeNegocioError -> BAD_REQUEST com a mensagem e a causa (campo)", () => {
    const origem = new RegraDeNegocioError("Título inválido", "titulo");
    const erro = mapearErroDeDominio(origem);
    expect(erro).toMatchObject({ code: "BAD_REQUEST", message: "Título inválido", cause: origem });
    // O campo vai na própria marca do erro (o errorFormatter lê `error.campo`).
    expect(erro.campo).toBe("titulo");
  });

  it("reconhece só pelo name (classe de outra avaliação do módulo, ex.: HMR)", () => {
    class TarefaNaoEncontradaDeOutraAvaliacao {
      readonly name = "TarefaNaoEncontradaError";
      readonly message = "outra mensagem";
    }
    class RegraDeOutraAvaliacao {
      readonly name = "RegraDeNegocioError";
      constructor(readonly message: string) {}
    }
    expect(mapearErroDeDominio(new TarefaNaoEncontradaDeOutraAvaliacao()).code).toBe("NOT_FOUND");
    expect(mapearErroDeDominio(new RegraDeOutraAvaliacao("Regra"))).toMatchObject({
      code: "BAD_REQUEST",
      message: "Regra",
    });
  });

  it.each([
    ["Error comum", new Error("boom")],
    ["string", "boom"],
    ["null", null],
    ["objeto com name parecido mas sem message", { name: "RegraDeNegocioError" }],
  ])("relança erro não reconhecido (%s)", (_nome, erro) => {
    let capturado: unknown;
    try {
      mapearErroDeDominio(erro);
    } catch (e) {
      capturado = e;
    }
    expect(capturado).toBe(erro);
  });
});
