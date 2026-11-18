import { criarTarefaRouter } from "@/modules/tarefa";
import { publicProcedure, router, t } from "../trpc";

export const appRouter = router({
  // Procedure mínima e inofensiva, só para verificar o endpoint (smoke test).
  saude: publicProcedure.query(() => ({ ok: true })),
  // O módulo monta o próprio router sobre o `t` do server (sem importar `src/server`).
  tarefa: criarTarefaRouter(t),
});

export type AppRouter = typeof appRouter;
