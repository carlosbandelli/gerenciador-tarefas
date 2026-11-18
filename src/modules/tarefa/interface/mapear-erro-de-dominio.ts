import { TRPCError } from "@trpc/server";
import { MENSAGENS } from "../domain/regras";

// Único ponto de tradução erro de domínio -> erro de transporte (tRPC). Nenhuma procedure repete
// try/catch: o middleware de `tarefa-router.ts` chama esta função uma vez só.
//
// Reconhece pelo `name` literal (ver `domain/erros.ts`), que cobre as classes reais e também
// instâncias de OUTRA avaliação do módulo: depois de um HMR do Next o service "velho" lança uma
// classe diferente da importada aqui, e `instanceof` falharia. (Uma instância da classe real
// tem o mesmo `name`, então um `instanceof` adicional seria redundante.)
//
// Campo do erro (`RegraDeNegocioError.campo`): vai na MARCA `ErroDeDominioTRPC.campo`. O
// `errorFormatter` (`src/server/trpc.ts`) lê `error.campo` (estrutural, sem importar o domínio) e
// o expõe ao cliente em `data.campo`, para o formulário marcar o input certo sem parsear a
// mensagem. Só erros traduzidos aqui carregam a marca: um erro qualquer com `campo` não vaza.
//
// `DadoInconsistenteError` (dado persistido corrompido) NÃO é reconhecido de propósito: segue
// como erro inesperado (500 genérico), pois não é culpa de quem chamou.

export class ErroDeDominioTRPC extends TRPCError {
  readonly campo?: string;

  constructor(opcoes: ConstructorParameters<typeof TRPCError>[0], campo?: string) {
    super(opcoes);
    this.campo = campo;
  }
}

type ErroReconhecido = { name: string; message: string; campo?: string };

function eErroComNome(erro: unknown, nome: string): erro is ErroReconhecido {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { name?: unknown }).name === nome &&
    typeof (erro as { message?: unknown }).message === "string"
  );
}

// Devolve o TRPCError equivalente; qualquer outro erro é RELANÇADO (nunca engolido), e o tRPC o
// converte em INTERNAL_SERVER_ERROR (mensagem genérica no `errorFormatter`).
export function mapearErroDeDominio(erro: unknown): ErroDeDominioTRPC {
  if (eErroComNome(erro, "TarefaNaoEncontradaError")) {
    return new ErroDeDominioTRPC({
      code: "NOT_FOUND",
      message: MENSAGENS.tarefaNaoEncontrada,
      cause: erro,
    });
  }
  if (eErroComNome(erro, "RegraDeNegocioError")) {
    const campo = typeof erro.campo === "string" ? erro.campo : undefined;
    return new ErroDeDominioTRPC(
      { code: "BAD_REQUEST", message: erro.message, cause: erro },
      campo,
    );
  }
  throw erro;
}
