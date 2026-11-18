"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState, type ReactNode } from "react";
import superjson from "superjson";
// Só TIPO: apagado no bundle, nada de servidor chega ao navegador.
import type { AppRouter } from "@/server/routers/_app";
import { criarQueryClient } from "./query-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let queryClientDoBrowser: QueryClient | undefined;

// Servidor: um QueryClient NOVO por render (cache nunca é compartilhado entre usuários).
// Browser: singleton, para que um suspend durante o render inicial não recrie o client e
// descarte o cache.
export function obterQueryClient(): QueryClient {
  if (typeof window === "undefined") return criarQueryClient();
  queryClientDoBrowser ??= criarQueryClient();
  return queryClientDoBrowser;
}

// Relativa no browser. No servidor a URL absoluta é só FALLBACK: hooks sem suspense (useQuery,
// useInfiniteQuery) não buscam durante o SSR (os dados vêm do prefetch hidratado), mas o client
// precisa de uma URL válida caso algum fetch ocorra no servidor.
function urlDoTrpc(): string {
  if (typeof window !== "undefined") return "/api/trpc";
  return `http://localhost:${process.env.PORT ?? 3000}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = obterQueryClient();
  // `useState` evita recriar o client tRPC a cada render do provider.
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        // httpBatchLink: agrupa chamadas simultâneas numa só requisição. Stream não é
        // necessário: as respostas são pequenas.
        httpBatchLink({ url: urlDoTrpc(), transformer: superjson }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
