import type { Tarefa } from "../domain/tarefa";

// DTO declarado à parte (e não um alias de `TarefaSnapshot`): o snapshot é detalhe de persistência
// do domínio e pode mudar com ele; o DTO é o contrato que sai da aplicação (vai ao tRPC e ao
// cliente via superjson, que preserva `Date`). Hoje os formatos coincidem, e o mapper garante
// a ligação. A entidade NUNCA sai da camada de aplicação.
export type TarefaDTO = {
  id: string;
  titulo: string;
  descricao?: string;
  dataCriacao: Date;
  dataAtualizacao?: Date;
};

export type PaginaDeTarefasDTO = {
  itens: TarefaDTO[];
  proximoCursor: string | null;
};

export const TarefaMapper = {
  // `toSnapshot` já copia as datas; sem referência ao estado interno da entidade. Montamos o
  // objeto campo a campo para não vazar chaves extras caso o snapshot ganhe campos internos, e
  // omitimos opcionais ausentes (nada de `descricao: undefined` explícito).
  paraDTO(tarefa: Tarefa): TarefaDTO {
    const { id, titulo, descricao, dataCriacao, dataAtualizacao } = tarefa.toSnapshot();
    return {
      id,
      titulo,
      ...(descricao !== undefined && { descricao }),
      dataCriacao,
      ...(dataAtualizacao !== undefined && { dataAtualizacao }),
    };
  },
} as const;
