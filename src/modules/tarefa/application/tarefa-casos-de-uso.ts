import type { PaginaDeTarefasDTO, TarefaDTO } from "./tarefa-dto";

// Comandos de entrada: tipos planos (a aplicação não depende dos schemas Zod da interface).
export type CriarTarefaComando = { titulo: string; descricao?: string | null };
export type ListarTarefasComando = { cursor?: string; limit: number };
export type AtualizarTarefaComando = {
  titulo?: string;
  // undefined = não altera | null ou "" = apaga.
  descricao?: string | null;
};

// Porta de ENTRADA da aplicação (DIP): o router tRPC e o contexto dependem desta interface, não
// da classe concreta `TarefaService`. Trocar/decorar/fingir a implementação não toca a interface.
export interface TarefaCasosDeUso {
  criar(comando: CriarTarefaComando): Promise<TarefaDTO>;
  listar(comando: ListarTarefasComando): Promise<PaginaDeTarefasDTO>;
  buscarPorId(id: string): Promise<TarefaDTO>;
  atualizar(id: string, alteracoes: AtualizarTarefaComando): Promise<TarefaDTO>;
  // Devolve o id canônico (minúsculas).
  deletar(id: string): Promise<{ id: string }>;
}
