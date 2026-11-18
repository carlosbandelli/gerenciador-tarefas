import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RegraDeNegocioError } from "./erros";
import { MENSAGENS } from "./regras";
import { TarefaId } from "./tarefa-id";

describe("TarefaId", () => {
  it("aceita UUID v4 gerado pelo runtime", () => {
    const uuid = randomUUID();
    expect(TarefaId.criar(uuid).valor).toBe(uuid);
  });

  it("normaliza para minúsculas", () => {
    const uuid = randomUUID();
    expect(TarefaId.criar(uuid.toUpperCase()).valor).toBe(uuid);
  });

  it.each(["", "abc", "123", "zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz", `${randomUUID()}x`])(
    "rejeita id inválido (%j)",
    (texto) => {
      expect(() => TarefaId.criar(texto)).toThrow(RegraDeNegocioError);
      expect(() => TarefaId.criar(texto)).toThrow(MENSAGENS.idInvalido);
    },
  );

  it("igualdade por valor", () => {
    const uuid = randomUUID();
    expect(TarefaId.criar(uuid).equals(TarefaId.criar(uuid.toUpperCase()))).toBe(true);
    expect(TarefaId.criar(uuid).equals(TarefaId.criar(randomUUID()))).toBe(false);
  });
});

// Borda (z.uuid) e domínio devem aceitar exatamente os mesmos ids.
describe("TarefaId × z.uuid()", () => {
  it.each([
    ["v4 minúsculo", "123e4567-e89b-42d3-a456-426614174000"],
    ["v7", "01890a5d-ac96-774b-bcce-b302099a8057"],
    ["maiúsculas", "123E4567-E89B-42D3-A456-426614174000"],
    ["nil", "00000000-0000-0000-0000-000000000000"],
    ["max", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
    ["max maiúsculo", "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"],
    ["versão 0", "123e4567-e89b-02d3-a456-426614174000"],
    ["versão 9", "123e4567-e89b-92d3-a456-426614174000"],
    ["variante c", "123e4567-e89b-42d3-c456-426614174000"],
    ["variante 7", "123e4567-e89b-42d3-7456-426614174000"],
    ["sem hífens", "123e4567e89b42d3a456426614174000"],
    ["com chaves", "{123e4567-e89b-42d3-a456-426614174000}"],
    ["com espaço", " 123e4567-e89b-42d3-a456-426614174000"],
  ])("concordam em: %s", (_nome, texto) => {
    const zod = z.uuid().safeParse(texto).success;
    const dominio = (() => {
      try {
        TarefaId.criar(texto);
        return true;
      } catch {
        return false;
      }
    })();
    expect(dominio).toBe(zod);
  });
});
