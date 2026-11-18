import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, unstable_localLink as localLink } from "@trpc/client";
import { renderHook, type RenderHookOptions } from "@testing-library/react";
import type { ReactNode } from "react";
import superjson from "superjson";
import { criarContainerDaTarefa, type ContainerDaTarefa } from "@/modules/tarefa";
import { appRouter } from "@/server/routers/_app";
import { criarContexto } from "@/server/trpc";
import { TRPCProvider } from "@/trpc/client";
import { criarQueryClient } from "@/trpc/query-client";

// Helper de teste dos hooks/componentes que usam tRPC.
//
// Sem msw: o client tRPC usa o `localLink`, que chama o `appRouter` REAL no mesmo processo (sem
// HTTP) com um container isolado. Exercita o caminho verdadeiro (validação Zod, mapeamento de
// erros, errorFormatter, superjson) com bem menos moving parts que interceptar `fetch`.
export function criarAmbienteDeTeste() {
  const container: ContainerDaTarefa = criarContainerDaTarefa({ seed: false });
  // Mesma fábrica da produção (staleTime, superjson), NOVA por teste e sem retry: um erro aparece na hora, sem esperar tentativas.
  const queryClient = criarQueryClient();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
    mutations: { retry: false },
  });
  const trpcClient = createTRPCClient<typeof appRouter>({
    links: [
      localLink({
        router: appRouter,
        createContext: async () => criarContexto({ container }),
        transformer: superjson,
      }),
    ],
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {children}
        </TRPCProvider>
      </QueryClientProvider>
    );
  }
  return { container, queryClient, trpcClient, Providers };
}

export function renderHookComProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, "wrapper">,
) {
  const ambiente = criarAmbienteDeTeste();
  const resultado = renderHook(hook, { ...options, wrapper: ambiente.Providers });
  return { ...resultado, ...ambiente };
}
