import { describe, expect, it } from "vitest";
import { DadoInconsistenteError, RegraDeNegocioError } from "../domain/erros";
import { Tarefa } from "../domain/tarefa";
import { TarefaId } from "../domain/tarefa-id";
import { InMemoryTarefaRepository } from "./in-memory-tarefa-repository";
import { descreverContratoDoTarefaRepository } from "../domain/testing/tarefa-repository.contract";

descreverContratoDoTarefaRepository(
  "InMemoryTarefaRepository",
  () => new InMemoryTarefaRepository(),
);

describe("InMemoryTarefaRepository (específico)", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const snap = { id, titulo: "Inicial", dataCriacao: new Date("2026-01-01T10:00:00Z") };

  it("aceita snapshots iniciais", async () => {
    const repo = new InMemoryTarefaRepository([snap]);
    expect((await repo.buscarPorId(TarefaId.criar(id)))?.titulo.valor).toBe("Inicial");
  });

  it("snapshots iniciais não ficam presos à referência do chamador", async () => {
    const dataCriacao = new Date("2026-01-01T10:00:00Z");
    const repo = new InMemoryTarefaRepository([{ ...snap, dataCriacao }]);
    dataCriacao.setUTCFullYear(2000);
    const lida = await repo.buscarPorId(TarefaId.criar(id));
    expect(lida?.dataCriacao.getUTCFullYear()).toBe(2026);
  });

  it("snapshot inicial inconsistente falha alto", () => {
    expect(() => new InMemoryTarefaRepository([{ ...snap, titulo: "  sujo " }])).toThrow(
      DadoInconsistenteError,
    );
  });

  it("devolve instâncias distintas a cada leitura", async () => {
    const repo = new InMemoryTarefaRepository([snap]);
    const a = await repo.buscarPorId(TarefaId.criar(id));
    const b = await repo.buscarPorId(TarefaId.criar(id));
    expect(a).not.toBe(b);
    expect(a).toBeInstanceOf(Tarefa);
    expect(a?.equals(b as Tarefa)).toBe(true);
  });

  it("ids duplicados nos snapshots iniciais falham alto", () => {
    expect(() => new InMemoryTarefaRepository([snap, { ...snap, titulo: "Outro" }])).toThrow(
      DadoInconsistenteError,
    );
  });

  describe("limit inválido (erro de programação)", () => {
    it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])("rejeita %s", async (limit) => {
      await expect(new InMemoryTarefaRepository().listar({ limit })).rejects.toBeInstanceOf(
        RangeError,
      );
    });
  });

  // Estes casos conhecem o formato `base64url(`${ms}_${id}`)` desta implementação; por isso não
  // ficam no contrato genérico.
  describe("cursor inválido (formato desta implementação)", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    const b64 = (texto: string) =>
      btoa(texto).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const valido = b64(`1000_${uuid}`);

    it.each([
      ["base64 válido com JSON errado", b64('{"a":1}')],
      ["base64 válido sem separador", b64("lixo")],
      ["separador na posição 0", b64(`_${uuid}`)],
      ["data inválida", b64(`abc_${uuid}`)],
      ["ms acima do limite de Date", b64(`8640000000000001_${uuid}`)],
      ["id inválido", b64("1000_nao-e-uuid")],
      ["espaço no ms", b64(` _${uuid}`)],
      ["ms hexadecimal", b64(`0x10_${uuid}`)],
      ["ms em notação científica", b64(`1e3_${uuid}`)],
      ["ms com sinal +", b64(`+5_${uuid}`)],
      ["ms decimal", b64(`1.0_${uuid}`)],
      ["com padding '='", `${valido}=`],
      ["com espaço", ` ${valido}`],
      ["id em maiúsculas (forma não canônica)", b64("1000_ABCDEF01-0000-4000-8000-00000000000A")],
    ])("rejeita %s", async (_n, cursor) => {
      const repo = new InMemoryTarefaRepository();
      const erro = await repo.listar({ cursor, limit: 10 }).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(RegraDeNegocioError);
      expect((erro as RegraDeNegocioError).campo).toBe("cursor");
    });

    it("aceita o cursor canônico, inclusive ms negativo", async () => {
      const repo = new InMemoryTarefaRepository();
      await expect(repo.listar({ cursor: valido, limit: 10 })).resolves.toBeDefined();
      await expect(repo.listar({ cursor: b64(`-5_${uuid}`), limit: 10 })).resolves.toBeDefined();
    });
  });
});
