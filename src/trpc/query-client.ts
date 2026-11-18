import { TRPCError } from "@trpc/server";
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

// Erros determinísticos (a tarefa não existe, o id é malformado) não mudam ao tentar de novo:
// repetir só atrasa a tela de "não encontrada". Os demais (rede, 5xx) tentam até 3 vezes.
// Leitura estrutural: `data.code` (TRPCClientError, via HTTP) ou `code` (TRPCError do caller
// direto no servidor), para não acoplar este arquivo às classes.
const SEM_RETRY = ["NOT_FOUND", "BAD_REQUEST"];
export function deveTentarNovamente(falhas: number, erro: unknown): boolean {
  const { data, code } = (erro ?? {}) as { data?: { code?: string }; code?: string };
  const codigo = data?.code ?? code ?? "";
  return !SEM_RETRY.includes(codigo) && falhas < 3;
}

// Fábrica única, usada no servidor (um client por request) e no browser (singleton).
export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // > 0: os dados hidratados do SSR são "frescos" por 30s, então o client não refaz a
        // mesma query logo após a hidratação (evita fetch duplicado).
        staleTime: 30_000,
        retry: deveTentarNovamente,
      },
      dehydrate: {
        // O cache atravessa a fronteira servidor -> cliente como dados serializáveis; superjson
        // preserva `Date` (dataCriacao) em vez de virar string.
        serializeData: superjson.serialize,
        // Inclui queries ainda `pending`: um prefetch sem `await` chega ao cliente em estado de
        // carregamento, em vez de sumir do dehydrate (ver `trpc/server.tsx`).
        // O erro de uma query `pending` que falha atravessa para o cliente. O prefetch do SSR usa o
        // caller direto (sem o `errorFormatter` do HTTP), então a mensagem original chegaria crua.
        // Só erros ESPERADOS do domínio (TRPCError não-500, ex.: "Tarefa não encontrada") passam
        // sem ocultar; erro inesperado (500 ou não-tRPC) é ocultado ("redacted") para não vazar
        // detalhe interno.
        shouldRedactErrors: (erro) =>
          !(erro instanceof TRPCError && erro.code !== "INTERNAL_SERVER_ERROR"),
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
