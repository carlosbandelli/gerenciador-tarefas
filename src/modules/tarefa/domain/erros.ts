import { MENSAGENS } from "./regras";
import type { TarefaId } from "./tarefa-id";

// Base abstrata: a camada de interface mapeia a hierarquia inteira num único lugar.
// Cada subclasse fixa `name` com um LITERAL (não `constructor.name`/`new.target.name`): em
// bundles minificados o nome da classe vira "a"/"t" e `name` quebraria logs e checagens.
export abstract class DominioError extends Error {
  abstract override readonly name: string;
}

// Campos que uma regra de negócio pode apontar (a borda os usa para marcar o input certo).
export type CampoDeErro =
  "titulo" | "descricao" | "id" | "cursor" | "dataCriacao" | "dataAtualizacao";

export class RegraDeNegocioError extends DominioError {
  override readonly name = "RegraDeNegocioError";

  // `campo` deixa a borda apontar o input do formulário sem parsear a mensagem.
  constructor(
    mensagem: string,
    readonly campo?: CampoDeErro,
  ) {
    super(mensagem);
  }
}

// Dado JÁ PERSISTIDO fora do formato esperado (corrompido) ou adaptador com bug: não é erro do
// usuário. A interface NÃO o traduz em 4xx; ele segue como erro inesperado (500 genérico).
export class DadoInconsistenteError extends DominioError {
  override readonly name = "DadoInconsistenteError";

  constructor(
    mensagem: string,
    readonly campo?: CampoDeErro,
  ) {
    super(mensagem);
  }
}

export class TarefaNaoEncontradaError extends DominioError {
  override readonly name = "TarefaNaoEncontradaError";

  constructor(readonly id: TarefaId) {
    super(MENSAGENS.tarefaNaoEncontrada);
  }
}
