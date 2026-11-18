import "server-only";

import {
  dehydrate,
  HydrationBoundary,
  type FetchInfiniteQueryOptions,
  type FetchQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache, type ReactNode } from "react";
import { appRouter } from "@/server/routers/_app";
import { criarContexto } from "@/server/trpc";
import { criarQueryClient } from "./query-client";

// `cache` do React: mesmo QueryClient em todo o render de UMA request, e novo na seguinte.
export const getQueryClient = cache(criarQueryClient);

// Caller direto no router (sem HTTP): o prefetch do servidor não faz round-trip.
export const trpc = createTRPCOptionsProxy({
  ctx: () => criarContexto(),
  router: appRouter,
  queryClient: getQueryClient,
});

// Devolve a promise: quem precisa do HTML do SSR já com dados faz `await`. Sem `await` a query
// fica `pending` no dehydrate e o `useQuery` (sem suspense) renderiza o estado de carregando no
// servidor. `prefetchQuery` nunca rejeita (o erro fica no cache e o cliente refaz).
// Genéricos (e não `any`): o tipo do que `trpc.<rota>.queryOptions()` devolve é preservado.
export function prefetch<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  opcoes: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  return getQueryClient().prefetchQuery(opcoes);
}

// Variante para `trpc.<rota>.infiniteQueryOptions()` (paginação por cursor).
export function prefetchInfinita<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
>(opcoes: FetchInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>) {
  return getQueryClient().prefetchInfiniteQuery(opcoes);
}

// Entrega o cache do servidor ao cliente (serializado via superjson).
export function HydrateClient({ children }: { children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
