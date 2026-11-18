import type { Tarefa } from "./tarefa";
import type { TarefaId } from "./tarefa-id";

export type ListarTarefasParams = {
  // Opaco para quem chama: só a implementação sabe o que codifica e como validar. Um cursor
  // inválido deve rejeitar com `RegraDeNegocioError` (campo "cursor"). Ausente = primeira página.
  cursor?: string;
  // Inteiro >= 1 (a borda valida; a implementação pode rejeitar outro valor com RangeError).
  limit: number;
};

export type PaginaDeTarefas = {
  itens: Tarefa[];
  // null = não há próxima página. Ordem da listagem: dataCriacao decrescente, desempate por id.
  proximoCursor: string | null;
};

// Todas as operações são assíncronas (DIP): o contrato não pode vazar que a implementação de
// hoje é um Map em memória. Uma implementação futura (Redis, SQL) faz I/O, e a porta já
// comporta isso sem mudar o service nem os testes de contrato.
export interface TarefaRepository {
  // Upsert: insere ou substitui a tarefa com o mesmo id.
  salvar(tarefa: Tarefa): Promise<void>;
  buscarPorId(id: TarefaId): Promise<Tarefa | null>;
  // true se existia e foi removida; false se o id não existe (o service decide se isso é erro).
  remover(id: TarefaId): Promise<boolean>;
  listar(params: ListarTarefasParams): Promise<PaginaDeTarefas>;
}
