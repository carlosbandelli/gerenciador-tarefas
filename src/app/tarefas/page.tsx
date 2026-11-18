import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  ENTRADA_DA_LISTAGEM,
  OPCOES_DA_LISTAGEM,
  TarefasPagina,
  TITULO_DA_LISTA_ID,
} from "@/modules/tarefa/ui";
import { HydrateClient, prefetchInfinita, trpc } from "@/trpc/server";

// Os dados vivem em memória e mudam a cada mutação: nada de pré-renderizar estático no build
// (congelaria o seed no HTML). Renderiza a cada request.
export const dynamic = "force-dynamic";

export default async function PaginaDeTarefas() {
  // AGUARDA o prefetch: sem isso a query vai `pending` ao cliente e o SSR renderiza só o
  // esqueleto (em `next dev`). Dados em memória: custo desprezível. `prefetchInfiniteQuery` não
  // lança: se falhar, nada é hidratado e o cliente refaz (e mostra "Tentar novamente" se persistir).
  await prefetchInfinita(
    trpc.tarefa.listar.infiniteQueryOptions(ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM),
  );

  return (
    <main className="mx-auto w-full max-w-2xl p-4">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 id={TITULO_DA_LISTA_ID} tabIndex={-1} className="text-2xl font-semibold">
          Tarefas
        </h1>
        <Link href="/tarefas/nova" className={buttonVariants()}>
          Nova tarefa
        </Link>
      </header>
      <HydrateClient>
        <TarefasPagina />
      </HydrateClient>
    </main>
  );
}
