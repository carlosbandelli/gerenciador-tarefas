import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { criarContexto } from "@/server/trpc";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => criarContexto(),
    // Em dev loga o erro completo; em produção nada é logado aqui e o tRPC já não envia stack
    // na resposta (`isDev` falso).
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`tRPC falhou em ${path ?? "<sem-path>"}:`, error)
        : undefined,
  });
}

export { handler as GET, handler as POST };
