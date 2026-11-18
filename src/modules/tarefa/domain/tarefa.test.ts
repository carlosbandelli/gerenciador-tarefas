import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Descricao } from "./descricao";
import { DadoInconsistenteError, RegraDeNegocioError } from "./erros";
import { DESCRICAO_MAX, TITULO_MAX } from "./regras";
import { Tarefa, type TarefaSnapshot } from "./tarefa";
import { TarefaId } from "./tarefa-id";
import { Titulo } from "./titulo";

const T0 = new Date("2026-01-01T10:00:00Z");
const T1 = new Date("2026-01-02T10:00:00Z");
const ANTES = new Date("2025-12-31T10:00:00Z");
const INVALIDA = new Date("lixo");

function nova(descricao?: string | null) {
  return Tarefa.criar(
    { titulo: "  Estudar DDD ", descricao },
    { id: TarefaId.criar(randomUUID()), agora: T0 },
  );
}

function snapshot(extra: Partial<Record<keyof TarefaSnapshot, unknown>> = {}): TarefaSnapshot {
  return {
    id: randomUUID(),
    titulo: "Titulo",
    descricao: "desc",
    dataCriacao: new Date(T0),
    dataAtualizacao: new Date(T1),
    ...extra,
  } as TarefaSnapshot;
}

function capturar(fn: () => unknown): unknown {
  try {
    fn();
  } catch (erro) {
    return erro;
  }
  return undefined;
}

describe("Tarefa.criar", () => {
  it("usa o id e a data recebidos, sem dataAtualizacao", () => {
    const id = TarefaId.criar(randomUUID());
    const tarefa = Tarefa.criar({ titulo: " X ", descricao: " d " }, { id, agora: T0 });
    expect(tarefa.id.equals(id)).toBe(true);
    expect(tarefa.titulo.valor).toBe("X");
    expect(tarefa.descricao?.valor).toBe("d");
    expect(tarefa.dataCriacao).toEqual(T0);
    expect(tarefa.dataAtualizacao).toBeNull();
  });

  it("descrição vazia ou ausente vira null", () => {
    expect(nova().descricao).toBeNull();
    expect(nova("  ").descricao).toBeNull();
  });

  it("título inválido lança RegraDeNegocioError", () => {
    expect(() =>
      Tarefa.criar({ titulo: " " }, { id: TarefaId.criar(randomUUID()), agora: T0 }),
    ).toThrow(RegraDeNegocioError);
  });

  it("rejeita Invalid Date", () => {
    const erro = capturar(() =>
      Tarefa.criar({ titulo: "a" }, { id: TarefaId.criar(randomUUID()), agora: INVALIDA }),
    );
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("dataCriacao");
  });

  it("não compartilha a referência da Date recebida nem expõe a interna", () => {
    const data = new Date(T0);
    const tarefa = Tarefa.criar({ titulo: "a" }, { id: TarefaId.criar(randomUUID()), agora: data });
    data.setFullYear(1999);
    tarefa.dataCriacao.setFullYear(1999);
    expect(tarefa.dataCriacao).toEqual(T0);
  });
});

describe("Tarefa.equals", () => {
  it("compara por identidade (id), não por conteúdo", () => {
    const a = nova("d");
    const mesmoId = Tarefa.reconstituir({ ...a.toSnapshot(), titulo: "Outro" });
    expect(a.equals(mesmoId)).toBe(true);
    expect(a.equals(nova("d"))).toBe(false);
  });
});

describe("Tarefa.atualizar", () => {
  it("altera título, grava dataAtualizacao e preserva dataCriacao", () => {
    const tarefa = nova("d");
    tarefa.atualizar({ titulo: " Novo " }, T1);
    expect(tarefa.titulo.valor).toBe("Novo");
    expect(tarefa.descricao?.valor).toBe("d");
    expect(tarefa.dataAtualizacao).toEqual(T1);
    expect(tarefa.dataCriacao).toEqual(T0);
  });

  it("descricao undefined não altera", () => {
    const tarefa = nova("d");
    tarefa.atualizar({ titulo: "Outro", descricao: undefined }, T1);
    expect(tarefa.descricao?.valor).toBe("d");
  });

  it("apenas descricao undefined é no-op (nem dataAtualizacao muda)", () => {
    const tarefa = nova("d");
    const antes = tarefa.toSnapshot();
    tarefa.atualizar({ descricao: undefined }, T1);
    expect(tarefa.toSnapshot()).toStrictEqual(antes);
  });

  it("descricao null apaga", () => {
    const tarefa = nova("d");
    tarefa.atualizar({ descricao: null }, T1);
    expect(tarefa.descricao).toBeNull();
    expect(tarefa.dataAtualizacao).toEqual(T1);
  });

  it("descricao string substitui; string vazia apaga", () => {
    const tarefa = nova("d");
    tarefa.atualizar({ descricao: " nova " }, T1);
    expect(tarefa.descricao?.valor).toBe("nova");
    tarefa.atualizar({ descricao: "" }, T1);
    expect(tarefa.descricao).toBeNull();
  });

  it("título inválido lança e não altera nada (atomicidade)", () => {
    const tarefa = nova("d");
    const antes = tarefa.toSnapshot();
    expect(() => tarefa.atualizar({ titulo: "  ", descricao: "outra" }, T1)).toThrow(
      RegraDeNegocioError,
    );
    expect(tarefa.toSnapshot()).toStrictEqual(antes);
  });

  it("descrição inválida lança e não altera o título (atomicidade)", () => {
    const tarefa = nova("d");
    const antes = tarefa.toSnapshot();
    expect(() =>
      tarefa.atualizar({ titulo: "Novo", descricao: "a".repeat(DESCRICAO_MAX + 1) }, T1),
    ).toThrow(RegraDeNegocioError);
    expect(tarefa.toSnapshot()).toStrictEqual(antes);
  });

  it("devolve true quando altera algo e false no no-op", () => {
    const tarefa = nova("d");
    expect(tarefa.atualizar({}, T1)).toBe(false);
    expect(tarefa.atualizar({ descricao: undefined }, T1)).toBe(false);
    expect(tarefa.atualizar({ titulo: "Novo" }, T1)).toBe(true);
    expect(tarefa.atualizar({ descricao: null }, T1)).toBe(true);
  });

  it("sem nenhum campo é no-op: não grava dataAtualizacao", () => {
    const tarefa = nova();
    tarefa.atualizar({}, T1);
    expect(tarefa.dataAtualizacao).toBeNull();
  });

  it("agora anterior à dataCriacao lança sem alterar nada", () => {
    const tarefa = nova("d");
    const antes = tarefa.toSnapshot();
    const erro = capturar(() => tarefa.atualizar({ titulo: "Novo" }, ANTES));
    expect(erro).toBeInstanceOf(RegraDeNegocioError);
    expect((erro as RegraDeNegocioError).campo).toBe("dataAtualizacao");
    expect(tarefa.toSnapshot()).toStrictEqual(antes);
  });

  it("agora igual à dataCriacao é aceito", () => {
    const tarefa = nova();
    tarefa.atualizar({ titulo: "Novo" }, T0);
    expect(tarefa.dataAtualizacao).toEqual(T0);
  });

  it("agora Invalid Date lança sem alterar nada", () => {
    const tarefa = nova("d");
    const antes = tarefa.toSnapshot();
    expect(() => tarefa.atualizar({ titulo: "Novo" }, INVALIDA)).toThrow(RegraDeNegocioError);
    expect(tarefa.toSnapshot()).toStrictEqual(antes);
  });

  it("mutar o `agora` passado depois da chamada não afeta a entidade", () => {
    const tarefa = nova();
    const agora = new Date(T1);
    tarefa.atualizar({ titulo: "Novo" }, agora);
    agora.setFullYear(1999);
    expect(tarefa.dataAtualizacao).toEqual(T1);
  });

  it("mutar o retorno do getter dataAtualizacao não afeta a entidade", () => {
    const tarefa = nova();
    tarefa.atualizar({ titulo: "Novo" }, T1);
    tarefa.dataAtualizacao!.setFullYear(1999);
    expect(tarefa.dataAtualizacao).toEqual(T1);
  });
});

describe("Tarefa.toSnapshot", () => {
  it("é objeto plano de primitivos; opcionais ausentes ficam undefined", () => {
    const tarefa = nova();
    expect(tarefa.toSnapshot()).toStrictEqual({
      id: tarefa.id.valor,
      titulo: "Estudar DDD",
      descricao: undefined,
      dataCriacao: T0,
      dataAtualizacao: undefined,
    });
  });

  it("não expõe estado interno (mutar a Date não afeta a entidade)", () => {
    const tarefa = nova();
    tarefa.toSnapshot().dataCriacao.setFullYear(1999);
    expect(tarefa.dataCriacao).toEqual(T0);
  });
});

describe("Tarefa.reconstituir", () => {
  it("round-trip: reconstituir(toSnapshot()) preserva tudo", () => {
    const tarefa = nova("d");
    tarefa.atualizar({ titulo: "Z" }, T1);
    const copia = Tarefa.reconstituir(tarefa.toSnapshot());
    expect(copia.toSnapshot()).toStrictEqual(tarefa.toSnapshot());
    expect(copia.titulo).toBeInstanceOf(Titulo);
    expect(copia.descricao).toBeInstanceOf(Descricao);
  });

  it("aceita snapshot sem descrição e sem dataAtualizacao", () => {
    const tarefa = Tarefa.reconstituir(
      snapshot({ descricao: undefined, dataAtualizacao: undefined }),
    );
    expect(tarefa.descricao).toBeNull();
    expect(tarefa.dataAtualizacao).toBeNull();
  });

  it("faz cópia defensiva das Dates do snapshot", () => {
    const s = snapshot();
    const tarefa = Tarefa.reconstituir(s);
    s.dataCriacao.setFullYear(1999);
    s.dataAtualizacao!.setFullYear(1999);
    expect(tarefa.dataCriacao).toEqual(T0);
    expect(tarefa.dataAtualizacao).toEqual(T1);
  });

  it.each<[string, Partial<Record<keyof TarefaSnapshot, unknown>>, string]>([
    ["id inválido", { id: "abc" }, "id"],
    ["id não normalizado (maiúsculas)", { id: randomUUID().toUpperCase() }, "id"],
    ["id de tipo errado", { id: 42 }, "id"],
    ["título vazio", { titulo: "" }, "titulo"],
    ["título com espaços nas pontas", { titulo: " Titulo " }, "titulo"],
    ["título acima do máximo", { titulo: "a".repeat(TITULO_MAX + 1) }, "titulo"],
    ["título de tipo errado", { titulo: 42 }, "titulo"],
    ["descrição vazia", { descricao: "" }, "descricao"],
    ["descrição com espaços nas pontas", { descricao: " d " }, "descricao"],
    ["descrição acima do máximo", { descricao: "a".repeat(DESCRICAO_MAX + 1) }, "descricao"],
    ["descrição de tipo errado", { descricao: 42 }, "descricao"],
    ["dataCriacao inválida", { dataCriacao: INVALIDA }, "dataCriacao"],
    ["dataCriacao de tipo errado", { dataCriacao: "2026-01-01" }, "dataCriacao"],
    ["dataAtualizacao inválida", { dataAtualizacao: INVALIDA }, "dataAtualizacao"],
    ["dataAtualizacao anterior à criação", { dataAtualizacao: ANTES }, "dataAtualizacao"],
  ])("snapshot inconsistente: %s", (_nome, extra, campo) => {
    const erro = capturar(() => Tarefa.reconstituir(snapshot(extra)));
    // Dado persistido corrompido não é erro do usuário: erro próprio (vira 500, nunca 400).
    expect(erro).toBeInstanceOf(DadoInconsistenteError);
    expect(erro).not.toBeInstanceOf(RegraDeNegocioError);
    expect(erro).not.toBeInstanceOf(TypeError);
    expect((erro as DadoInconsistenteError).campo).toBe(campo);
  });
});
