/**
 * API pública (lado cliente) do módulo `tarefa`: componentes e hooks que as rotas em
 * `src/app/` usam. Separada do `index.ts` do módulo para que código de servidor
 * (repositório, service) nunca entre no bundle do navegador.
 *
 * Exporta só os containers e hooks que as rotas usam. A apresentação (`TarefaForm`, `TarefaItem`
 * etc.) fica interna: `EditarTarefa` e `NovaTarefa` compõem o `TarefaForm` por dentro do módulo.
 */
export { TarefasPagina } from "./components/tarefas-pagina";
export { EditarTarefa } from "./components/editar-tarefa";
export { NovaTarefa } from "./components/nova-tarefa";
export { TarefaNaoEncontrada } from "./components/tarefa-nao-encontrada";
export { ATRIBUTO_ID_DA_TAREFA, TAREFAS_POR_PAGINA, TITULO_DA_LISTA_ID } from "./constantes";
export { ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM } from "./opcoes-da-listagem";
export { useExcluirTarefa } from "./hooks/use-excluir-tarefa";
export { useSalvarTarefa } from "./hooks/use-salvar-tarefa";
export type { ErrosPorCampo, ValoresDaTarefa } from "./hooks/use-salvar-tarefa";
export { useTarefas } from "./hooks/use-tarefas";
