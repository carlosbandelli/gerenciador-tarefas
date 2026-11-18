import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM } from "../opcoes-da-listagem";

// Referência ÚNICA para "sem dados": um `[]` novo a cada render quebraria a memoização dos filhos.
const SEM_TAREFAS: never[] = [];

// Hook de DADOS (SRP): lista paginada por cursor. Não conhece JSX nem toasts.
export function useTarefas() {
  const trpc = useTRPC();
  const consulta = useInfiniteQuery(
    trpc.tarefa.listar.infiniteQueryOptions(ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM),
  );

  // `useMemo`: o `flatMap` cria um array novo a cada chamada. Memoizado por `consulta.data`, o
  // array só muda de identidade quando os dados mudam; assim o efeito do foco (que depende de
  // `tarefas`) e quem recebe a lista não reagem a renders sem mudança. (Os itens em si são
  // protegidos pelo `memo` + comparador do `TarefaItem`.)
  const tarefas = useMemo(
    () => consulta.data?.pages.flatMap((pagina) => pagina.itens) ?? SEM_TAREFAS,
    [consulta.data],
  );

  return {
    tarefas,
    isPending: consulta.isPending,
    isError: consulta.isError,
    error: consulta.error,
    hasNextPage: consulta.hasNextPage,
    isFetchingNextPage: consulta.isFetchingNextPage,
    isFetching: consulta.isFetching,
    isRefetchError: consulta.isRefetchError,
    isFetchNextPageError: consulta.isFetchNextPageError,
    fetchNextPage: consulta.fetchNextPage,
    refetch: consulta.refetch,
  };
}
