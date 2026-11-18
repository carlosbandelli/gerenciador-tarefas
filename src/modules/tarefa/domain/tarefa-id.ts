import { RegraDeNegocioError } from "./erros";
import { MENSAGENS } from "./regras";

// A GERAÇÃO de ids não fica aqui: vem da porta `GeradorDeId`.
// Mesma regex do `z.uuid()` do Zod 4 (copiada de propósito, inclusive a peculiaridade de o UUID
// "max" só ser aceito em minúsculas), para borda e domínio aceitarem exatamente os mesmos ids.
// A paridade é testada em tarefa-id.test.ts.
const UUID =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

export class TarefaId {
  readonly #valor: string;

  private constructor(valor: string) {
    this.#valor = valor;
  }

  // `criar` (e não `de`): mesmo nome de fábrica dos demais VOs. A GERAÇÃO continua na porta.
  static criar(texto: string): TarefaId {
    // Minúsculas: UUIDs são case-insensitive; normalizar faz `equals` por valor funcionar.
    if (!UUID.test(texto)) throw new RegraDeNegocioError(MENSAGENS.idInvalido, "id");
    return new TarefaId(texto.toLowerCase());
  }

  get valor(): string {
    return this.#valor;
  }

  equals(outro: TarefaId): boolean {
    return this.#valor === outro.#valor;
  }
}
