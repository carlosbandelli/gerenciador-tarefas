import { afterEach, describe, expect, it } from "vitest";
import { RegraDeNegocioError } from "../erros";
import { Tarefa } from "../tarefa";
import { TarefaId } from "../tarefa-id";
import type { TarefaRepository } from "../tarefa-repository";

// Suíte de contrato (Liskov): qualquer implementação de `TarefaRepository` (memória, Redis, SQL)
// deve passar nestes mesmos testes. Fica em `testing/` e SEM sufixo `.test.ts` para o vitest não
// coletá-la sozinha; só roda quando o `*.test.ts` de uma implementação a chama.
// Depende apenas do domínio (e do vitest).

const BASE = Date.UTC(2026, 0, 1, 10, 0, 0);
const MINUTO = 60_000;

function idN(n: number): TarefaId {
  return TarefaId.criar(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
}

function tarefa(n: number, minutos = n): Tarefa {
  return Tarefa.criar(
    { titulo: `Tarefa ${n}` },
    { id: idN(n), agora: new Date(BASE + minutos * MINUTO) },
  );
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
  } catch (erro) {
    return erro;
  }
  return undefined;
}

const ids = (itens: Tarefa[]) => itens.map((t) => t.id.valor);

/**
 * Registra a suíte de contrato.
 * - `fabrica` DEVE devolver um repositório vazio e isolado a cada chamada (cada teste chama uma vez).
 * - `limpar` (opcional) roda em `afterEach` com o repositório criado no teste; serve a
 *   implementações com I/O (banco, Redis) que precisam apagar dados ou fechar conexões.
 */
export function descreverContratoDoTarefaRepository(
  nome: string,
  fabrica: () => TarefaRepository | Promise<TarefaRepository>,
  limpar?: (repo: TarefaRepository) => Promise<void>,
): void {
  describe(`contrato de TarefaRepository: ${nome}`, () => {
    const criados: TarefaRepository[] = [];
    const criar = async (): Promise<TarefaRepository> => {
      const repo = await fabrica();
      criados.push(repo);
      return repo;
    };
    afterEach(async () => {
      const repos = criados.splice(0);
      if (limpar) for (const repo of repos) await limpar(repo);
    });

    async function paginar(repo: TarefaRepository, limit: number): Promise<string[][]> {
      const paginas: string[][] = [];
      let cursor: string | undefined;
      do {
        const pagina = await repo.listar({ cursor, limit });
        paginas.push(ids(pagina.itens));
        cursor = pagina.proximoCursor ?? undefined;
      } while (cursor !== undefined);
      return paginas;
    }

    async function povoar(repo: TarefaRepository, total: number): Promise<void> {
      for (let n = 1; n <= total; n++) await repo.salvar(tarefa(n));
    }

    it("salva e busca por id", async () => {
      const repo = await criar();
      const t = tarefa(1);
      await repo.salvar(t);
      expect((await repo.buscarPorId(t.id))?.toSnapshot()).toEqual(t.toSnapshot());
    });

    it("salvar é upsert: sobrescreve a tarefa com o mesmo id", async () => {
      const repo = await criar();
      const t = tarefa(1);
      await repo.salvar(t);
      t.atualizar({ titulo: "Novo título" }, new Date(BASE + 999 * MINUTO));
      await repo.salvar(t);
      expect((await repo.buscarPorId(t.id))?.titulo.valor).toBe("Novo título");
      expect((await repo.listar({ limit: 10 })).itens).toHaveLength(1);
    });

    it("buscar id inexistente devolve null", async () => {
      const repo = await criar();
      expect(await repo.buscarPorId(idN(42))).toBeNull();
    });

    it("remover existente devolve true e a tarefa some", async () => {
      const repo = await criar();
      const t = tarefa(1);
      await repo.salvar(t);
      expect(await repo.remover(t.id)).toBe(true);
      expect(await repo.buscarPorId(t.id)).toBeNull();
    });

    it("remover inexistente devolve false", async () => {
      const repo = await criar();
      expect(await repo.remover(idN(42))).toBe(false);
    });

    it("listar vazio devolve página vazia sem cursor", async () => {
      const repo = await criar();
      expect(await repo.listar({ limit: 10 })).toEqual({ itens: [], proximoCursor: null });
    });

    it("ordena por dataCriacao decrescente", async () => {
      const repo = await criar();
      for (const n of [2, 3, 1]) await repo.salvar(tarefa(n));
      const { itens } = await repo.listar({ limit: 10 });
      expect(itens.map((t) => t.titulo.valor)).toEqual(["Tarefa 3", "Tarefa 2", "Tarefa 1"]);
    });

    it("desempata datas iguais por id decrescente (ordem total e estável)", async () => {
      const repo = await criar();
      for (const n of [2, 1, 3]) await repo.salvar(tarefa(n, 5));
      const { itens } = await repo.listar({ limit: 10 });
      expect(ids(itens)).toEqual([idN(3).valor, idN(2).valor, idN(1).valor]);
    });

    it("pagina 25 itens com limit 10 em 10/10/5, sem repetir e cobrindo todos", async () => {
      const repo = await criar();
      await povoar(repo, 25);
      const paginas = await paginar(repo, 10);
      expect(paginas.map((p) => p.length)).toEqual([10, 10, 5]);
      const todos = paginas.flat();
      expect(new Set(todos).size).toBe(25);
      expect(todos).toEqual(Array.from({ length: 25 }, (_, i) => idN(25 - i).valor));
    });

    it("pagina corretamente quando várias tarefas têm a mesma data", async () => {
      const repo = await criar();
      for (let n = 1; n <= 7; n++) await repo.salvar(tarefa(n, 1));
      const paginas = await paginar(repo, 3);
      expect(paginas.map((p) => p.length)).toEqual([3, 3, 1]);
      expect(paginas.flat()).toEqual(Array.from({ length: 7 }, (_, i) => idN(7 - i).valor));
    });

    it("limit igual ao total devolve proximoCursor null", async () => {
      const repo = await criar();
      await povoar(repo, 10);
      const pagina = await repo.listar({ limit: 10 });
      expect(pagina.itens).toHaveLength(10);
      expect(pagina.proximoCursor).toBeNull();
    });

    it("limit menor que o total devolve cursor", async () => {
      const repo = await criar();
      await povoar(repo, 11);
      expect((await repo.listar({ limit: 10 })).proximoCursor).not.toBeNull();
    });

    it("excluir itens já vistos entre páginas não pula nem repete", async () => {
      const repo = await criar();
      await povoar(repo, 25);
      const p1 = await repo.listar({ limit: 10 });
      // Remove o próprio item do cursor (último visto) e o primeiro.
      await repo.remover(p1.itens[9].id);
      await repo.remover(p1.itens[0].id);
      const p2 = await repo.listar({ cursor: p1.proximoCursor ?? undefined, limit: 10 });
      expect(ids(p2.itens)).toEqual(Array.from({ length: 10 }, (_, i) => idN(15 - i).valor));
    });

    it("criar item mais novo entre páginas não aparece nas seguintes nem repete", async () => {
      const repo = await criar();
      await povoar(repo, 25);
      const p1 = await repo.listar({ limit: 10 });
      await repo.salvar(tarefa(100, 500));
      const p2 = await repo.listar({ cursor: p1.proximoCursor ?? undefined, limit: 10 });
      expect(ids(p2.itens)).toEqual(Array.from({ length: 10 }, (_, i) => idN(15 - i).valor));
      expect(ids(p2.itens)).not.toContain(idN(100).valor);
      // Uma listagem nova (sem cursor) já o traz no topo.
      expect(ids((await repo.listar({ limit: 1 })).itens)).toEqual([idN(100).valor]);
    });

    it.each([
      ["texto aleatório", "isso não é cursor"],
      ["string vazia", ""],
      ["texto curto", "abcde"],
    ])("cursor inválido (%s) rejeita com RegraDeNegocioError no campo cursor", async (_n, c) => {
      const repo = await criar();
      await repo.salvar(tarefa(1));
      const erro = await erroDe(repo.listar({ cursor: c, limit: 10 }));
      expect(erro).toBeInstanceOf(RegraDeNegocioError);
      expect((erro as RegraDeNegocioError).campo).toBe("cursor");
    });

    it("limit maior que o total devolve proximoCursor null", async () => {
      const repo = await criar();
      await povoar(repo, 3);
      const pagina = await repo.listar({ limit: 50 });
      expect(pagina.itens).toHaveLength(3);
      expect(pagina.proximoCursor).toBeNull();
    });

    it("cursor depois do último item devolve página vazia sem erro", async () => {
      const repo = await criar();
      await povoar(repo, 5);
      const p1 = await repo.listar({ limit: 4 });
      // Remove o último item restante: o cursor passa a apontar depois de tudo.
      await repo.remover(idN(1));
      const p2 = await repo.listar({ cursor: p1.proximoCursor ?? undefined, limit: 4 });
      expect(p2).toEqual({ itens: [], proximoCursor: null });
    });

    it("upsert (atualizar + salvar) não muda a posição na listagem", async () => {
      const repo = await criar();
      await povoar(repo, 3);
      const t = await repo.buscarPorId(idN(1));
      t?.atualizar({ titulo: "Editada" }, new Date(BASE + 999 * MINUTO));
      if (t) await repo.salvar(t);
      const { itens } = await repo.listar({ limit: 10 });
      expect(ids(itens)).toEqual([idN(3).valor, idN(2).valor, idN(1).valor]);
      expect(itens[2].titulo.valor).toBe("Editada");
    });

    it("a entidade devolvida é cópia: mutar sem salvar não altera o armazenado", async () => {
      const repo = await criar();
      const t = tarefa(1);
      await repo.salvar(t);
      const depois = new Date(BASE + 999 * MINUTO);

      (await repo.buscarPorId(t.id))?.atualizar({ titulo: "Mutada" }, depois);
      expect((await repo.buscarPorId(t.id))?.titulo.valor).toBe("Tarefa 1");

      // Mutar a original depois de salvar também não vaza para o armazenado.
      t.atualizar({ titulo: "Mutada 2" }, depois);
      expect((await repo.buscarPorId(t.id))?.titulo.valor).toBe("Tarefa 1");

      (await repo.listar({ limit: 1 })).itens[0].atualizar({ titulo: "Mutada 3" }, depois);
      expect((await repo.buscarPorId(t.id))?.titulo.valor).toBe("Tarefa 1");
    });
  });
}
