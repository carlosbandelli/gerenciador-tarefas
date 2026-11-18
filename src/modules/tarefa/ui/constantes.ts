// Fonte única do tamanho da página da listagem. O prefetch do servidor (src/app/tarefas) e o
// `useTarefas` precisam da MESMA entrada: a chave da query inclui o `limit`, e se divergirem a
// hidratação não casa e o cliente refaz a busca.
export const TAREFAS_POR_PAGINA = 10;

// Id do <h1> da rota /tarefas: a page o põe no título e a lista o usa em aria-labelledby.
export const TITULO_DA_LISTA_ID = "titulo-da-lista-de-tarefas";

// Atributo que liga o botão Excluir ao id da tarefa (o container o usa para devolver o foco).
export const ATRIBUTO_ID_DA_TAREFA = "data-tarefa-id";
