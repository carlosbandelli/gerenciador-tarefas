import "server-only";

/**
 * API pública (lado servidor) do módulo `tarefa`.
 *
 * Monólito modular: fora de `src/modules/tarefa/` só se importa este `index.ts` ou o
 * `ui/index.ts`; o ESLint barra domain, application, infrastructure e interface. Expõe o
 * composition root (container) e os tipos de saída da aplicação (DTOs). Entidades, portas,
 * infraestrutura e erros de domínio continuam internos: o mapeamento de erros para tRPC fica em
 * `interface/`, que importa `domain/erros` diretamente.
 *
 * `server-only` faz o build falhar se algum componente de cliente importar este arquivo
 * (ex.: `src/components/**`), mantendo repositório e service fora do bundle do navegador.
 *
 * O router tRPC é exposto como fábrica (`criarTarefaRouter`): o server injeta o seu `initTRPC`,
 * assim o módulo não importa `src/server` (sem ciclo).
 */
export { criarContainerDaTarefa, obterContainerDaTarefa } from "./container";
export type { ContainerDaTarefa, DependenciasDaTarefa } from "./container";
export type { TarefaCasosDeUso } from "./application/tarefa-casos-de-uso";
export type { PaginaDeTarefasDTO, TarefaDTO } from "./application/tarefa-dto";
export { criarTarefaRouter } from "./interface/tarefa-router";
