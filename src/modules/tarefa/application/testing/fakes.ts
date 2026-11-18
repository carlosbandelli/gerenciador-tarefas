import { RegraDeNegocioError } from "../../domain/erros";
import type { GeradorDeId } from "../../domain/gerador-de-id";
import type { Relogio } from "../../domain/relogio";
import { Tarefa, type TarefaSnapshot } from "../../domain/tarefa";
import { TarefaId } from "../../domain/tarefa-id";
import type {
  ListarTarefasParams,
  PaginaDeTarefas,
  TarefaRepository,
} from "../../domain/tarefa-repository";

// Fakes só para testar o service. `application/` não pode importar `infrastructure/` (a regra
// ESLint `import/no-restricted-paths` vale também para arquivos de teste), então estes dublês
// vivem aqui e dependem apenas do domínio.

export class RelogioFixo implements Relogio {
  constructor(private instante: Date) {}

  agora(): Date {
    return new Date(this.instante);
  }

  avancarPara(instante: Date): void {
    this.instante = instante;
  }
}

// Ids previsíveis: 00000000-0000-4000-8000-000000000001, ...02, ...
export class GeradorDeIdSequencial implements GeradorDeId {
  #n = 0;

  gerar(): TarefaId {
    this.#n += 1;
    return TarefaId.criar(`00000000-0000-4000-8000-${String(this.#n).padStart(12, "0")}`);
  }
}

// Cursor do fake: formato PRÓPRIO e simples (`c:<ms>:<id>`), diferente do real. O contrato só
// usa cursores genéricos ou os devolvidos pelo próprio repositório.
const CURSOR = /^c:(-?\d+):(.+)$/;

function decodificar(cursor: string): { ms: number; id: string } {
  const invalido = () => new RegraDeNegocioError("Cursor de paginação inválido", "cursor");
  const partes = CURSOR.exec(cursor);
  if (!partes) throw invalido();
  const ms = Number(partes[1]);
  let id: string;
  try {
    id = TarefaId.criar(partes[2]).valor;
  } catch {
    throw invalido();
  }
  if (!Number.isSafeInteger(ms)) throw invalido();
  return { ms, id };
}

// Repositório em memória que CUMPRE o contrato de `TarefaRepository` (ver
// `fakes.contrato.test.ts`): guarda snapshots, ordena por dataCriacao DESC + id DESC, pagina por
// keyset e devolve cópias via `reconstituir`. Além disso, espia: registra a última paginação
// pedida (sem alterar o resultado) e conta os `salvar`, para provar que uma operação que falha
// ou é no-op não persiste nada.
export class RepositorioFake implements TarefaRepository {
  readonly porId = new Map<string, TarefaSnapshot>();
  salvamentos = 0;
  ultimaListagem: ListarTarefasParams | undefined;

  async salvar(tarefa: Tarefa): Promise<void> {
    this.salvamentos += 1;
    this.porId.set(tarefa.id.valor, tarefa.toSnapshot());
  }

  async buscarPorId(id: TarefaId): Promise<Tarefa | null> {
    const snapshot = this.porId.get(id.valor);
    return snapshot ? Tarefa.reconstituir(snapshot) : null;
  }

  async remover(id: TarefaId): Promise<boolean> {
    return this.porId.delete(id.valor);
  }

  async listar(params: ListarTarefasParams): Promise<PaginaDeTarefas> {
    this.ultimaListagem = params;
    const { cursor, limit } = params;
    const chave = cursor === undefined ? undefined : decodificar(cursor);
    const ordenados = [...this.porId.values()]
      .map((s) => ({ s, ms: s.dataCriacao.getTime() }))
      .sort((a, b) => b.ms - a.ms || (a.s.id < b.s.id ? 1 : a.s.id > b.s.id ? -1 : 0))
      .filter(({ s, ms }) => !chave || ms < chave.ms || (ms === chave.ms && s.id < chave.id));
    const pagina = ordenados.slice(0, limit);
    const ultimo = pagina.at(-1);
    return {
      itens: pagina.map(({ s }) => Tarefa.reconstituir(s)),
      proximoCursor: ordenados.length > limit && ultimo ? `c:${ultimo.ms}:${ultimo.s.id}` : null,
    };
  }
}
