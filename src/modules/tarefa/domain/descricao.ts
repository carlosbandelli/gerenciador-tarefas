import { RegraDeNegocioError } from "./erros";
import { DESCRICAO_MAX, MENSAGENS, tamanho } from "./regras";

// "Sem descrição" é representado por `null` (e não por um VO vazio): a entidade guarda
// `Descricao | null`, então existir um `Descricao` sempre significa texto não vazio e ninguém
// precisa checar `.valor === ""`. A fábrica absorve null/undefined/vazio/só espaços.
export class Descricao {
  readonly #valor: string;

  private constructor(valor: string) {
    this.#valor = valor;
  }

  static criar(texto: string | null | undefined): Descricao | null {
    const valor = texto?.trim() ?? "";
    if (valor === "") return null;
    if (tamanho(valor) > DESCRICAO_MAX) {
      throw new RegraDeNegocioError(MENSAGENS.descricaoMuitoLonga, "descricao");
    }
    return new Descricao(valor);
  }

  get valor(): string {
    return this.#valor;
  }

  equals(outra: Descricao): boolean {
    return this.#valor === outra.#valor;
  }
}
