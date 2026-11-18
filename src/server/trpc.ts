import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import {
  obterContainerDaTarefa,
  type ContainerDaTarefa,
  type TarefaCasosDeUso,
} from "@/modules/tarefa";

const MENSAGEM_ERRO_INTERNO = "Erro interno. Tente novamente.";

const MENSAGEM_DADOS_INVALIDOS = "Dados inválidos";

// Só o erro TRADUZIDO por um módulo (marca `campo` no próprio TRPCError, ver
// `mapearErroDeDominio`) expõe o campo. Leitura estrutural: o server não conhece o domínio, e um
// erro qualquer (ou a `cause`) com `campo` não vaza.
function campoDoErro(erro: object): string | null {
  const { campo } = erro as { campo?: unknown };
  return typeof campo === "string" ? campo : null;
}

// Contexto de cada requisição: só o que os routers precisam (serviços da aplicação).
export type Contexto = { tarefaService: TarefaCasosDeUso };

// O container é INJETADO (DIP): produção usa o singleton do módulo; testes passam um container
// isolado (`criarContainerDaTarefa({ seed: false })`) e não compartilham estado.
export function criarContexto({
  container = obterContainerDaTarefa(),
}: { container?: ContainerDaTarefa } = {}): Contexto {
  return { tarefaService: container.tarefaService };
}

// Exportado para a composição dos routers: cada módulo recebe `t` e monta o próprio router
// (inversão de dependência; o módulo não importa este arquivo).
export const t = initTRPC.context<Contexto>().create({
  // Date, Map etc. atravessam o transporte preservando o tipo.
  transformer: superjson,
  // Erros de validação do Zod ganham `data.zodError` (formErrors/fieldErrors) para o formulário
  // mapear a mensagem (já em pt-BR) por campo.
  errorFormatter({ shape, error }) {
    // Erro inesperado: mensagem GENÉRICA e sem stack (que repete a mensagem original). O detalhe
    // não vai ao cliente; em dev o `onError` da rota o registra no console.
    if (error.code === "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message: MENSAGEM_ERRO_INTERNO,
        data: { ...shape.data, stack: undefined, zodError: null, campo: null },
      };
    }
    const zod = error.cause instanceof ZodError ? error.cause : null;
    return {
      ...shape,
      // Validação: em vez do JSON cru dos issues, a 1ª mensagem (já em pt-BR); o detalhe por campo
      // segue em `data.zodError`.
      message: zod ? (zod.issues[0]?.message ?? MENSAGEM_DADOS_INVALIDOS) : shape.message,
      data: {
        ...shape.data,
        zodError: zod ? z.flattenError(zod) : null,
        // Campo apontado por um erro de domínio, para o formulário marcar o input certo.
        campo: campoDoErro(error),
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
