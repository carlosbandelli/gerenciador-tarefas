import { Descricao } from "./descricao";
import { DadoInconsistenteError, RegraDeNegocioError, type CampoDeErro } from "./erros";
import { MENSAGENS } from "./regras";
import { TarefaId } from "./tarefa-id";
import { Titulo } from "./titulo";

// Forma plana (primitivos) da entidade: usada por `toSnapshot`/`reconstituir` e pelo mapper da
// aplicação. Opcionais ausentes são `undefined`, como no modelo do enunciado.
export type TarefaSnapshot = {
  id: string;
  titulo: string;
  descricao?: string;
  dataCriacao: Date;
  dataAtualizacao?: Date;
};

export type NovaTarefa = { titulo: string; descricao?: string | null };

// A entidade é PURA: não conhece relógio nem gerador de id. Quem orquestra (o service) resolve
// `id` e `agora` pelas portas e os passa aqui, o que deixa a entidade determinística e testável.
export type ContextoDeCriacao = { id: TarefaId; agora: Date };

export type AlteracoesDaTarefa = {
  titulo?: string;
  // undefined = não altera | null (ou vazio) = apaga | string = novo valor.
  descricao?: string | null;
};

type Estado = {
  id: TarefaId;
  titulo: Titulo;
  descricao: Descricao | null;
  dataCriacao: Date;
  dataAtualizacao: Date | null;
};

function dataValida(valor: unknown, campo: CampoDeErro): Date {
  if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) {
    throw new RegraDeNegocioError(MENSAGENS.dataInvalida, campo);
  }
  return valor;
}

function texto(valor: unknown, campo: CampoDeErro, mensagem: string): string {
  if (typeof valor !== "string") throw new RegraDeNegocioError(mensagem, campo);
  return valor;
}

function inconsistente(campo: CampoDeErro, detalhe: string): DadoInconsistenteError {
  return new DadoInconsistenteError(`Dado de tarefa inconsistente (${campo}): ${detalhe}`, campo);
}

// Aggregate root. Datas são copiadas na entrada e na saída para ninguém mutar o estado interno.
export class Tarefa {
  readonly #id: TarefaId;
  readonly #dataCriacao: Date;
  #titulo: Titulo;
  #descricao: Descricao | null;
  #dataAtualizacao: Date | null;

  private constructor(estado: Estado) {
    this.#id = estado.id;
    this.#titulo = estado.titulo;
    this.#descricao = estado.descricao;
    this.#dataCriacao = new Date(dataValida(estado.dataCriacao, "dataCriacao"));
    this.#dataAtualizacao = estado.dataAtualizacao
      ? new Date(dataValida(estado.dataAtualizacao, "dataAtualizacao"))
      : null;
  }

  static criar({ titulo, descricao }: NovaTarefa, { id, agora }: ContextoDeCriacao): Tarefa {
    return new Tarefa({
      id,
      titulo: Titulo.criar(titulo),
      descricao: Descricao.criar(descricao),
      dataCriacao: agora,
      dataAtualizacao: null,
    });
  }

  // Para o repositório. ESTRITO: o snapshot precisa já estar normalizado (trim, minúsculas,
  // sem descrição vazia) e ter os tipos certos; divergir significa dado persistido corrompido ou
  // adaptador com bug, e isso falha alto com erro de domínio em vez de ser "consertado" em silêncio.
  // Toda falha vira `DadoInconsistenteError` (dado persistido ruim não é erro de quem chamou).
  static reconstituir(snapshot: TarefaSnapshot): Tarefa {
    try {
      return Tarefa.reconstituirEstrito(snapshot);
    } catch (erro) {
      if (erro instanceof RegraDeNegocioError) {
        throw new DadoInconsistenteError(erro.message, erro.campo);
      }
      throw erro;
    }
  }

  private static reconstituirEstrito(snapshot: TarefaSnapshot): Tarefa {
    const id = TarefaId.criar(texto(snapshot.id, "id", MENSAGENS.idInvalido));
    if (id.valor !== snapshot.id) throw inconsistente("id", "id fora do formato normalizado");

    const titulo = Titulo.criar(texto(snapshot.titulo, "titulo", MENSAGENS.tituloObrigatorio));
    if (titulo.valor !== snapshot.titulo) throw inconsistente("titulo", "título não normalizado");

    let descricao: Descricao | null = null;
    if (snapshot.descricao !== undefined) {
      descricao = Descricao.criar(texto(snapshot.descricao, "descricao", MENSAGENS.descricaoTexto));
      if (descricao?.valor !== snapshot.descricao) {
        throw inconsistente("descricao", "descrição vazia ou não normalizada");
      }
    }

    const dataCriacao = dataValida(snapshot.dataCriacao, "dataCriacao");
    const dataAtualizacao =
      snapshot.dataAtualizacao === undefined
        ? null
        : dataValida(snapshot.dataAtualizacao, "dataAtualizacao");
    if (dataAtualizacao && dataAtualizacao < dataCriacao) {
      throw new RegraDeNegocioError(MENSAGENS.dataAtualizacaoAnterior, "dataAtualizacao");
    }

    return new Tarefa({ id, titulo, descricao, dataCriacao, dataAtualizacao });
  }

  get id(): TarefaId {
    return this.#id;
  }

  get titulo(): Titulo {
    return this.#titulo;
  }

  get descricao(): Descricao | null {
    return this.#descricao;
  }

  get dataCriacao(): Date {
    return new Date(this.#dataCriacao);
  }

  get dataAtualizacao(): Date | null {
    return this.#dataAtualizacao ? new Date(this.#dataAtualizacao) : null;
  }

  // Identidade, não valor: duas tarefas são a mesma se têm o mesmo id.
  equals(outra: Tarefa): boolean {
    return this.#id.equals(outra.#id);
  }

  // Atômico: todos os VOs são criados (e podem lançar) ANTES de qualquer atribuição.
  // Sem nenhum campo informado é no-op e não grava `dataAtualizacao`: nada mudou.
  // Devolve se houve alteração, para quem orquestra evitar uma escrita inútil.
  atualizar({ titulo, descricao }: AlteracoesDaTarefa, agora: Date): boolean {
    if (titulo === undefined && descricao === undefined) return false;

    const data = dataValida(agora, "dataAtualizacao");
    if (data < this.#dataCriacao) {
      throw new RegraDeNegocioError(MENSAGENS.dataAtualizacaoAnterior, "dataAtualizacao");
    }
    const novoTitulo = titulo === undefined ? this.#titulo : Titulo.criar(titulo);
    const novaDescricao = descricao === undefined ? this.#descricao : Descricao.criar(descricao);

    this.#titulo = novoTitulo;
    this.#descricao = novaDescricao;
    this.#dataAtualizacao = new Date(data);
    return true;
  }

  toSnapshot(): TarefaSnapshot {
    return {
      id: this.#id.valor,
      titulo: this.#titulo.valor,
      descricao: this.#descricao?.valor,
      dataCriacao: this.dataCriacao,
      dataAtualizacao: this.dataAtualizacao ?? undefined,
    };
  }
}
