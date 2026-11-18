import { DadoInconsistenteError, RegraDeNegocioError } from "../domain/erros";
import { Tarefa, type TarefaSnapshot } from "../domain/tarefa";
import { TarefaId } from "../domain/tarefa-id";
import type {
  ListarTarefasParams,
  PaginaDeTarefas,
  TarefaRepository,
} from "../domain/tarefa-repository";

// Mensagem própria da infra: o cursor é um detalhe desta implementação, não do domínio.
const MENSAGEM_CURSOR_INVALIDO = "Cursor de paginação inválido";

type Chave = { ms: number; id: string };

// Cursor opaco = base64url de `${ms}_${id}` do ÚLTIMO item devolvido (ASCII puro, então `btoa`
// basta e funciona também no edge, sem `Buffer`). Codifica a CHAVE do item, não uma posição:
// por isso inserir/excluir itens entre páginas não desloca nada (paginação keyset).
function codificar({ ms, id }: Chave): string {
  return btoa(`${ms}_${id}`).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Só dígitos com sinal "-" opcional: `Number()` sozinho aceitaria " ", "0x10", "1e3", "+5", "1.0".
const MS_CANONICO = /^-?\d+$/;

function decodificar(cursor: string): Chave {
  const invalido = () => new RegraDeNegocioError(MENSAGEM_CURSOR_INVALIDO, "cursor");
  let texto: string;
  try {
    texto = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
  } catch {
    throw invalido();
  }
  const separador = texto.indexOf("_");
  const prefixo = texto.slice(0, separador);
  if (separador < 1 || !MS_CANONICO.test(prefixo)) throw invalido();
  const ms = Number(prefixo);
  if (!Number.isSafeInteger(ms) || Number.isNaN(new Date(ms).getTime())) throw invalido();
  let id: string;
  try {
    id = TarefaId.criar(texto.slice(separador + 1)).valor;
  } catch {
    throw invalido();
  }
  const chave = { ms, id };
  // Forma única: re-codificar tem de reproduzir exatamente o recebido. Rejeita `=`, espaços,
  // id em maiúsculas, "-0" etc. (dois textos diferentes nunca representam a mesma chave).
  if (codificar(chave) !== cursor) throw invalido();
  return chave;
}

// Ordem TOTAL e estável: dataCriacao DESC, desempate por id DESC. Sem desempate, datas iguais
// (comuns: criadas no mesmo ms) deixariam a ordem indefinida e o cursor ambíguo.
// Devolve > 0 quando `a` vem DEPOIS de `b` na listagem.
function comparar(a: Chave, b: Chave): number {
  if (a.ms !== b.ms) return b.ms - a.ms;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

const chaveDe = (s: TarefaSnapshot): Chave => ({ ms: s.dataCriacao.getTime(), id: s.id });

export class InMemoryTarefaRepository implements TarefaRepository {
  // Guardamos SNAPSHOTS (primitivos + Date copiadas), nunca a entidade: quem chama jamais segura
  // referência ao estado interno. Mutar uma `Tarefa` devolvida não altera o armazenado sem `salvar`.
  readonly #porId = new Map<string, TarefaSnapshot>();

  constructor(iniciais: readonly TarefaSnapshot[] = []) {
    // Passa por `reconstituir`: valida os dados e copia as datas (o snapshot guardado é novo).
    for (const snapshot of iniciais) {
      const normalizado = Tarefa.reconstituir(snapshot).toSnapshot();
      // Id repetido na carga inicial é dado corrompido: falha alto em vez de sobrescrever calado.
      if (this.#porId.has(normalizado.id)) {
        throw new DadoInconsistenteError(
          `Id duplicado nos dados iniciais: ${normalizado.id}`,
          "id",
        );
      }
      this.#porId.set(normalizado.id, normalizado);
    }
  }

  async salvar(tarefa: Tarefa): Promise<void> {
    this.#porId.set(tarefa.id.valor, tarefa.toSnapshot());
  }

  async buscarPorId(id: TarefaId): Promise<Tarefa | null> {
    const snapshot = this.#porId.get(id.valor);
    return snapshot ? Tarefa.reconstituir(snapshot) : null;
  }

  async remover(id: TarefaId): Promise<boolean> {
    return this.#porId.delete(id.valor);
  }

  async listar({ cursor, limit }: ListarTarefasParams): Promise<PaginaDeTarefas> {
    // Erro de programação (a borda Zod já garante inteiro >= 1), não regra de negócio.
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`limit deve ser um inteiro >= 1 (recebido: ${limit})`);
    }
    // Valida antes de tudo: cursor ruim falha mesmo com a lista vazia.
    const aposChave = cursor === undefined ? null : decodificar(cursor);

    const candidatos = [...this.#porId.values()]
      .filter((s) => aposChave === null || comparar(chaveDe(s), aposChave) > 0)
      .sort((a, b) => comparar(chaveDe(a), chaveDe(b)));

    const pagina = candidatos.slice(0, limit);
    // Só há próxima página se SOBROU item além do limite (evita cursor para página vazia).
    const ultimo = pagina.at(-1);
    const proximoCursor = candidatos.length > limit && ultimo ? codificar(chaveDe(ultimo)) : null;

    return { itens: pagina.map((s) => Tarefa.reconstituir(s)), proximoCursor };
  }
}
