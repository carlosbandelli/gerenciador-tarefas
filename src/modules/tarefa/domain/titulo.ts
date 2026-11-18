import { RegraDeNegocioError } from "./erros";
import { MENSAGENS, TITULO_MAX, tamanho } from "./regras";

// Value Object: imutável (campo `#` privado, sem setters) e comparado por valor.
export class Titulo {
  readonly #valor: string;

  private constructor(valor: string) {
    this.#valor = valor;
  }

  static criar(texto: string): Titulo {
    const valor = texto.trim();
    if (valor === "") throw new RegraDeNegocioError(MENSAGENS.tituloObrigatorio, "titulo");
    if (tamanho(valor) > TITULO_MAX) {
      throw new RegraDeNegocioError(MENSAGENS.tituloMuitoLongo, "titulo");
    }
    return new Titulo(valor);
  }

  get valor(): string {
    return this.#valor;
  }

  equals(outro: Titulo): boolean {
    return this.#valor === outro.#valor;
  }
}
