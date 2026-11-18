import { TarefaService } from "./application/tarefa-service";
import type { TarefaCasosDeUso } from "./application/tarefa-casos-de-uso";
import type { GeradorDeId } from "./domain/gerador-de-id";
import type { Relogio } from "./domain/relogio";
import type { TarefaRepository } from "./domain/tarefa-repository";
import { GeradorDeIdUuid } from "./infrastructure/gerador-de-id-uuid";
import { InMemoryTarefaRepository } from "./infrastructure/in-memory-tarefa-repository";
import { RelogioDoSistema } from "./infrastructure/relogio-do-sistema";
import { criarTarefasDeExemplo } from "./infrastructure/seed";

// Composition root do módulo: único lugar que conhece application E infrastructure e liga as
// implementações às portas. Código de servidor; quem o protege do bundle do cliente é o
// `import "server-only"` do `index.ts` (único ponto de entrada de fora) e a fronteira ESLint
// (nenhuma camada, nem a `ui`, importa este arquivo). Aqui não há `server-only` porque os
// testes de integração importam este arquivo direto.

export type ContainerDaTarefa = { tarefaService: TarefaCasosDeUso };

// União discriminada: ou o repositório vem de fora (e então `seed` não faz sentido, pois quem o
// injeta cuida dos próprios dados), ou usa-se o repositório em memória padrão, com `seed` opcional.
export type DependenciasDaTarefa = { relogio?: Relogio; geradorDeId?: GeradorDeId } & (
  { repositorio: TarefaRepository; seed?: never } | { repositorio?: undefined; seed?: boolean }
);

function criarRepositorioEmMemoria(
  relogio: Relogio,
  geradorDeId: GeradorDeId,
  comSeed: boolean,
): TarefaRepository {
  return new InMemoryTarefaRepository(
    comSeed
      ? criarTarefasDeExemplo({ agora: relogio.agora(), geradorDeId }).map((t) => t.toSnapshot())
      : [],
  );
}

// Fábrica pura: sem estado global, a cada chamada um grafo novo. Usada nos testes com fakes.
export function criarContainerDaTarefa(deps: DependenciasDaTarefa = {}): ContainerDaTarefa {
  const relogio = deps.relogio ?? new RelogioDoSistema();
  const geradorDeId = deps.geradorDeId ?? new GeradorDeIdUuid();
  const repositorio =
    deps.repositorio ?? criarRepositorioEmMemoria(relogio, geradorDeId, deps.seed ?? true);
  return { tarefaService: new TarefaService(repositorio, relogio, geradorDeId) };
}

// Só o REPOSITÓRIO (a parte com estado) fica em `globalThis`, sob `Symbol.for` (mesma chave entre
// cópias do módulo). Em dev o Next reavalia módulos (HMR); com variável de módulo o repositório
// seria recriado e as tarefas "sumiriam". Service, relógio e gerador NÃO ficam no global: são
// recriados a cada avaliação do módulo, para não sobrar service/classes de erro "velhos" (de uma
// versão anterior do código) depois do HMR.
const CHAVE_DO_REPOSITORIO = Symbol.for("gerenciador-tarefas.container.tarefa");
type ComRepositorio = typeof globalThis & { [CHAVE_DO_REPOSITORIO]?: TarefaRepository };

let container: ContainerDaTarefa | undefined;

export function obterContainerDaTarefa(): ContainerDaTarefa {
  if (container) return container;
  const global = globalThis as ComRepositorio;
  const relogio = new RelogioDoSistema();
  const geradorDeId = new GeradorDeIdUuid();
  const repositorio = (global[CHAVE_DO_REPOSITORIO] ??= criarRepositorioEmMemoria(
    relogio,
    geradorDeId,
    true,
  ));
  container = { tarefaService: new TarefaService(repositorio, relogio, geradorDeId) };
  return container;
}
