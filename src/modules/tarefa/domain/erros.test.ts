import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DadoInconsistenteError,
  DominioError,
  RegraDeNegocioError,
  TarefaNaoEncontradaError,
} from "./erros";
import { TarefaId } from "./tarefa-id";

describe("erros de domínio", () => {
  it("RegraDeNegocioError é DominioError e Error, com campo opcional", () => {
    const erro = new RegraDeNegocioError("O título é obrigatório", "titulo");
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect(erro).toBeInstanceOf(DominioError);
    expect(erro).toBeInstanceOf(Error);
    // `name` é literal explícito (não `constructor.name`), então resiste a minificação.
    expect(erro.name).toBe("RegraDeNegocioError");
    expect(erro.message).toBe("O título é obrigatório");
    expect(erro.campo).toBe("titulo");
    expect(new RegraDeNegocioError("x").campo).toBeUndefined();
  });

  it("TarefaNaoEncontradaError guarda o TarefaId e tem mensagem fixa", () => {
    const id = TarefaId.criar(randomUUID());
    const erro = new TarefaNaoEncontradaError(id);
    expect(erro).toBeInstanceOf(TarefaNaoEncontradaError);
    expect(erro).toBeInstanceOf(DominioError);
    expect(erro).not.toBeInstanceOf(RegraDeNegocioError);
    expect(erro.name).toBe("TarefaNaoEncontradaError");
    expect(erro.message).toBe("Tarefa não encontrada");
    expect(erro.id).toBe(id);
  });

  it("DadoInconsistenteError é DominioError distinto de RegraDeNegocioError (não é culpa do usuário)", () => {
    const erro = new DadoInconsistenteError("Dado corrompido", "titulo");
    expect(erro).toBeInstanceOf(DominioError);
    expect(erro).not.toBeInstanceOf(RegraDeNegocioError);
    expect(erro.name).toBe("DadoInconsistenteError");
    expect(erro.message).toBe("Dado corrompido");
    expect(erro.campo).toBe("titulo");
  });
});
