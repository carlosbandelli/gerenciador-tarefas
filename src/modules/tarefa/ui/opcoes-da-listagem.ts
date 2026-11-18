import { TAREFAS_POR_PAGINA } from "./constantes";

// Argumentos ÚNICOS da listagem: o prefetch do servidor e o `useTarefas` precisam ser idênticos,
// senão a hidratação não casa (a chave da query inclui `limit`). Cada chamador faz
// `t.tarefa.listar.infiniteQueryOptions(ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM)`.
//
// Por que não uma função `opcoesDaListagem(t)`: sem importar `@/server` (barrado na `ui`), o tipo
// do proxy só pode ser estrutural, e a inferência genérica perde os tipos das páginas (viram
// `unknown`). Compartilhar os ARGUMENTOS mantém a fonte única e os tipos completos.
export const ENTRADA_DA_LISTAGEM = { limit: TAREFAS_POR_PAGINA };

export const OPCOES_DA_LISTAGEM = {
  // Página vazia nunca tem "próxima": defesa contra loop se um cursor vier numa página sem itens.
  getNextPageParam: (pagina: { itens: readonly unknown[]; proximoCursor: string | null }) =>
    pagina.itens.length > 0 ? (pagina.proximoCursor ?? undefined) : undefined,
};
