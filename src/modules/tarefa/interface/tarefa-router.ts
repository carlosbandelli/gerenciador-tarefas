import type { TRPCRootObject, TRPCRuntimeConfigOptions } from "@trpc/server";
import type { TarefaCasosDeUso } from "../application/tarefa-casos-de-uso";
import { mapearErroDeDominio } from "./mapear-erro-de-dominio";
import {
  atualizarTarefaSchema,
  criarTarefaSchema,
  idTarefaSchema,
  listarTarefasSchema,
} from "./schema";

// O que o módulo exige do contexto do tRPC (o server monta um Contexto compatível).
export type ContextoDaTarefa = { tarefaService: TarefaCasosDeUso };

// Inversão de dependência: o módulo NÃO importa `src/server` (evita o ciclo módulo <-> server).
// O server injeta o seu `initTRPC` (`t`); o módulo só constrói o router em cima dele.
// `TOptions` é inferido do `t` recebido, então transformer/errorFormatter do server valem aqui.
export function criarTarefaRouter<
  TCtx extends ContextoDaTarefa,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TCtx, TMeta>,
>(t: TRPCRootObject<TCtx, TMeta, TOptions>) {
  // Tradução de erros de domínio num middleware só, aplicado a TODAS as procedures. O tRPC não
  // deixa a exceção escapar de `next()`: devolve `{ ok: false, error }`, com o erro original em
  // `error.cause` quando a procedure lançou algo que não é TRPCError. Erros de validação (Zod) já
  // são TRPCError com causa ZodError e passam direto.
  const procedure = t.procedure.use(async ({ next }) => {
    const resultado = await next();
    if (resultado.ok) return resultado;
    const { error } = resultado;
    if (error.code !== "INTERNAL_SERVER_ERROR" || error.cause === undefined) return resultado;
    // Domínio -> TRPCError; qualquer outra coisa é relançada e segue como INTERNAL_SERVER_ERROR.
    throw mapearErroDeDominio(error.cause);
  });

  return t.router({
    criar: procedure
      .input(criarTarefaSchema)
      .mutation(({ ctx, input }) => ctx.tarefaService.criar(input)),

    listar: procedure
      .input(listarTarefasSchema)
      .query(({ ctx, input }) => ctx.tarefaService.listar(input)),

    buscarPorId: procedure
      .input(idTarefaSchema)
      .query(({ ctx, input }) => ctx.tarefaService.buscarPorId(input.id)),

    atualizar: procedure.input(atualizarTarefaSchema).mutation(({ ctx, input }) => {
      const { id, ...alteracoes } = input;
      return ctx.tarefaService.atualizar(id, alteracoes);
    }),

    deletar: procedure
      .input(idTarefaSchema)
      .mutation(({ ctx, input }) => ctx.tarefaService.deletar(input.id)),
  });
}
