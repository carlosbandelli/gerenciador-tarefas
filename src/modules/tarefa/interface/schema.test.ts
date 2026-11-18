import { describe, expect, it } from "vitest";
import {
  atualizarTarefaSchema,
  criarTarefaSchema,
  descricaoSchema,
  idTarefaSchema,
  listarTarefasSchema,
  tituloSchema,
} from "./schema";

const ID = "3f2b8c1e-5d4a-4b6f-9a1e-7c2d8e9f0a1b";

type Resultado = {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
};

// Pares [campo, mensagem]: garante que o erro cai no campo certo (o formulário mapeia por path).
function mensagensPorCampo(r: Resultado) {
  return (r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]);
}

describe("tituloSchema", () => {
  it("rejeita vazio e só espaços", () => {
    for (const valor of ["", "   "]) {
      expect(mensagensPorCampo(tituloSchema.safeParse(valor))).toStrictEqual([
        ["", "O título é obrigatório"],
      ]);
    }
  });

  it("rejeita tipo errado com mensagem pt-BR", () => {
    expect(mensagensPorCampo(tituloSchema.safeParse(123))).toStrictEqual([
      ["", "O título é obrigatório"],
    ]);
  });

  it("aceita 120 caracteres e rejeita 121", () => {
    expect(tituloSchema.safeParse("a".repeat(120)).success).toBe(true);
    expect(mensagensPorCampo(tituloSchema.safeParse("a".repeat(121)))).toStrictEqual([
      ["", "O título deve ter no máximo 120 caracteres"],
    ]);
  });

  it("aplica trim antes de validar o tamanho", () => {
    expect(tituloSchema.parse("  oi  ")).toBe("oi");
    expect(tituloSchema.safeParse(`  ${"a".repeat(120)}  `).success).toBe(true);
  });
});

describe("descricaoSchema", () => {
  it("aceita ausente", () => {
    expect(descricaoSchema.parse(undefined)).toBeUndefined();
  });

  it('transforma "" e só espaços em undefined', () => {
    expect(descricaoSchema.parse("")).toBeUndefined();
    expect(descricaoSchema.parse("  ")).toBeUndefined();
  });

  it("aplica trim", () => {
    expect(descricaoSchema.parse("  texto  ")).toBe("texto");
  });

  it("aceita 1000 e rejeita 1001 com mensagem pt-BR", () => {
    expect(descricaoSchema.safeParse("a".repeat(1000)).success).toBe(true);
    expect(mensagensPorCampo(descricaoSchema.safeParse("a".repeat(1001)))).toStrictEqual([
      ["", "A descrição deve ter no máximo 1000 caracteres"],
    ]);
  });

  it("rejeita tipo errado com mensagem pt-BR", () => {
    expect(mensagensPorCampo(descricaoSchema.safeParse(42))).toStrictEqual([
      ["", "A descrição deve ser um texto"],
    ]);
  });
});

describe("criarTarefaSchema", () => {
  it("valida título e descrição opcional", () => {
    expect(criarTarefaSchema.parse({ titulo: " Estudar " })).toStrictEqual({
      titulo: "Estudar",
    });
    expect(criarTarefaSchema.parse({ titulo: "a", descricao: "" }).descricao).toBeUndefined();
  });

  it("rejeita título vazio no campo titulo", () => {
    expect(mensagensPorCampo(criarTarefaSchema.safeParse({ titulo: " " }))).toStrictEqual([
      ["titulo", "O título é obrigatório"],
    ]);
  });

  it("rejeita objeto vazio com mensagem pt-BR", () => {
    expect(mensagensPorCampo(criarTarefaSchema.safeParse({}))).toStrictEqual([
      ["titulo", "O título é obrigatório"],
    ]);
  });

  it("rejeita descrição > 1000 no campo descricao", () => {
    const r = criarTarefaSchema.safeParse({ titulo: "a", descricao: "a".repeat(1001) });
    expect(mensagensPorCampo(r)).toStrictEqual([
      ["descricao", "A descrição deve ter no máximo 1000 caracteres"],
    ]);
  });

  it("rejeita descrição numérica com mensagem pt-BR", () => {
    const r = criarTarefaSchema.safeParse({ titulo: "a", descricao: 1 });
    expect(mensagensPorCampo(r)).toStrictEqual([["descricao", "A descrição deve ser um texto"]]);
  });

  it("descarta campos extras (servidor é dono de id e datas)", () => {
    const saida = criarTarefaSchema.parse({ titulo: "a", id: ID, dataCriacao: new Date() });
    expect(saida).toStrictEqual({ titulo: "a" });
  });
});

describe("atualizarTarefaSchema", () => {
  it('descricao "" vira null (marcador de apagar)', () => {
    expect(atualizarTarefaSchema.parse({ id: ID, descricao: "" }).descricao).toBeNull();
    expect(atualizarTarefaSchema.parse({ id: ID, descricao: "   " }).descricao).toBeNull();
  });

  it("é idempotente: a saída (com null) pode ser reparseada", () => {
    // RHF + zodResolver entrega a saída transformada, e a procedure valida de novo.
    const primeira = atualizarTarefaSchema.parse({ id: ID, descricao: "" });
    expect(atualizarTarefaSchema.parse(primeira).descricao).toBeNull();
    expect(atualizarTarefaSchema.parse({ id: ID, descricao: null }).descricao).toBeNull();
  });

  it("descricao ausente fica undefined (não alterar)", () => {
    expect(atualizarTarefaSchema.parse({ id: ID, titulo: "x" })).toStrictEqual({
      id: ID,
      titulo: "x",
    });
  });

  it("descricao com texto recebe trim; 1001 é rejeitada no campo", () => {
    expect(atualizarTarefaSchema.parse({ id: ID, descricao: " a " }).descricao).toBe("a");
    const r = atualizarTarefaSchema.safeParse({ id: ID, descricao: "a".repeat(1001) });
    expect(mensagensPorCampo(r)).toStrictEqual([
      ["descricao", "A descrição deve ter no máximo 1000 caracteres"],
    ]);
  });

  it("rejeita descrição numérica com mensagem pt-BR", () => {
    const r = atualizarTarefaSchema.safeParse({ id: ID, descricao: 5 });
    expect(mensagensPorCampo(r)).toStrictEqual([["descricao", "A descrição deve ser um texto"]]);
  });

  it("rejeita título vazio quando presente", () => {
    const r = atualizarTarefaSchema.safeParse({ id: ID, titulo: "  " });
    expect(mensagensPorCampo(r)).toStrictEqual([["titulo", "O título é obrigatório"]]);
  });

  it("rejeita id inválido ou ausente", () => {
    expect(mensagensPorCampo(atualizarTarefaSchema.safeParse({ id: "nope" }))).toStrictEqual([
      ["id", "Id de tarefa inválido"],
    ]);
    expect(mensagensPorCampo(atualizarTarefaSchema.safeParse({}))).toStrictEqual([
      ["id", "Id de tarefa inválido"],
    ]);
  });

  it("aceita objeto só com id (no-op)", () => {
    expect(atualizarTarefaSchema.safeParse({ id: ID }).success).toBe(true);
  });

  it("descarta dataCriacao enviada pelo cliente", () => {
    const saida = atualizarTarefaSchema.parse({ id: ID, dataCriacao: new Date() });
    expect(saida).toStrictEqual({ id: ID });
  });
});

describe("idTarefaSchema", () => {
  it("aceita UUID", () => {
    expect(idTarefaSchema.parse({ id: ID })).toStrictEqual({ id: ID });
  });

  it("rejeita inválido, ausente e tipo errado com mensagem pt-BR", () => {
    for (const entrada of [{ id: "123" }, {}, { id: 7 }]) {
      expect(mensagensPorCampo(idTarefaSchema.safeParse(entrada))).toStrictEqual([
        ["id", "Id de tarefa inválido"],
      ]);
    }
  });
});

describe("listarTarefasSchema", () => {
  it("usa limit 10 por padrão, sem cursor", () => {
    expect(listarTarefasSchema.parse({})).toStrictEqual({ limit: 10 });
  });

  it("aceita input ausente (undefined) e usa os padrões: prefault({}), não default({})", () => {
    expect(listarTarefasSchema.parse(undefined)).toStrictEqual({ limit: 10 });
  });

  it("aceita limites 1 e 50", () => {
    expect(listarTarefasSchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(listarTarefasSchema.safeParse({ limit: 50 }).success).toBe(true);
  });

  it("rejeita 0, 51, não inteiro e string no campo limit", () => {
    const casos: [unknown, string][] = [
      [0, "O limite mínimo é 1"],
      [51, "O limite máximo é 50"],
      [2.5, "O limite deve ser um inteiro"],
      ["10", "O limite deve ser um número"],
    ];
    for (const [limit, mensagem] of casos) {
      expect(mensagensPorCampo(listarTarefasSchema.safeParse({ limit }))).toStrictEqual([
        ["limit", mensagem],
      ]);
    }
  });

  it("rejeita cursor vazio ou não-string no campo cursor", () => {
    for (const cursor of ["", 5]) {
      expect(mensagensPorCampo(listarTarefasSchema.safeParse({ cursor }))).toStrictEqual([
        ["cursor", "Cursor inválido"],
      ]);
    }
    expect(listarTarefasSchema.parse({ cursor: "abc" }).cursor).toBe("abc");
  });
});
