import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

export type ValoresDaTarefa = { titulo: string; descricao?: string | null };
export type ErrosPorCampo = Record<string, string[]>;
type OpcoesDeSalvar = { onSuccess?: () => void };

// Campos que o formulário sabe exibir. Erro em outro campo (ex.: `id`) ou sem campo (formErrors,
// NOT_FOUND) não tem onde aparecer no form, então vira toast.
const CAMPOS_DO_FORM: readonly string[] = ["titulo", "descricao"];

// Formato estrutural do erro do tRPC que interessa aqui. Tipado localmente (e não com
// `TRPCClientErrorLike<AppRouter>`) porque isso exigiria a `ui` importar `AppRouter` de
// `@/server`, o que a fronteira do módulo proíbe (nem `import type` é aceito).
type ErroDoServidor = {
  message: string;
  data?: {
    zodError?: { fieldErrors: Record<string, string[] | undefined> } | null;
    campo?: string | null;
    code?: string;
  } | null;
};

const SEM_ERROS: ErrosPorCampo = {};
const MENSAGEM_EXCLUIDA = "Essa tarefa foi excluída";
const eNaoEncontrado = (erro: ErroDoServidor | null) => erro?.data?.code === "NOT_FOUND";

// `data.zodError.fieldErrors` (validação Zod) + `data.campo` (erro de domínio apontando um
// campo), só para campos do formulário.
function extrairErrosPorCampo(erro: ErroDoServidor): ErrosPorCampo {
  const resultado: ErrosPorCampo = {};
  for (const [campo, mensagens] of Object.entries(erro.data?.zodError?.fieldErrors ?? {})) {
    if (CAMPOS_DO_FORM.includes(campo) && mensagens?.length) resultado[campo] = mensagens;
  }
  const campo = erro.data?.campo;
  if (campo && CAMPOS_DO_FORM.includes(campo) && !resultado[campo]) {
    resultado[campo] = [erro.message];
  }
  return resultado;
}

// Hook de DADOS + feedback: cria (sem `id`) ou atualiza (com `id`). Expõe erros por campo para o
// formulário marcar o input certo; o resto vira toast.
//
// Invalidação e toasts ficam nas opções do HOOK (não no `mutate`): callbacks passados ao `mutate`
// são descartados se o componente desmontar antes de a mutação terminar (ex.: o form fecha e
// navega), e a lista ficaria desatualizada sem aviso. Ao `mutate` vai só o `onSuccess` do
// chamador (navegação), que só faz sentido com o componente montado.
export function useSalvarTarefa({ id }: { id?: string } = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // `dto`: o que o servidor devolveu ao atualizar. Vira o cache do detalhe (`setQueryData`) em vez
  // de invalidar: sem um refetch aguardado antes da navegação, e o detalhe já é o dado oficial.
  // A lista continua sendo invalidada (ordem/paginação são do servidor).
  const aoSucesso = async (dto?: { id: string }) => {
    await queryClient.invalidateQueries(trpc.tarefa.listar.infiniteQueryFilter());
    if (id !== undefined && dto) {
      queryClient.setQueryData(trpc.tarefa.buscarPorId.queryKey({ id }), dto as never);
    }
    toast.success(id === undefined ? "Tarefa criada" : "Tarefa atualizada");
  };
  const aoErro = (erro: ErroDoServidor) => {
    if (Object.keys(extrairErrosPorCampo(erro)).length > 0) return;
    // Atualizar uma tarefa que sumiu (excluída por outro): "Tarefa não encontrada" do servidor é
    // técnico demais; aqui, onde o contexto é conhecido, a mensagem diz o que aconteceu.
    toast.error(id !== undefined && eNaoEncontrado(erro) ? MENSAGEM_EXCLUIDA : erro.message);
  };

  // Os dois hooks sempre existem (regra dos hooks); só um é usado conforme `id`.
  const criar = useMutation(
    trpc.tarefa.criar.mutationOptions({ onSuccess: () => aoSucesso(), onError: aoErro }),
  );
  const atualizar = useMutation(
    trpc.tarefa.atualizar.mutationOptions({ onSuccess: (dto) => aoSucesso(dto), onError: aoErro }),
  );
  const mutacao = id === undefined ? criar : atualizar;
  // `mutate` é estável entre renders: dependência segura do useCallback.
  const { mutate: criarMutate } = criar;
  const { mutate: atualizarMutate } = atualizar;

  const salvar = useCallback(
    (valores: ValoresDaTarefa, opcoes: OpcoesDeSalvar = {}) => {
      if (id === undefined) {
        criarMutate(
          { titulo: valores.titulo, descricao: valores.descricao ?? undefined },
          { onSuccess: opcoes.onSuccess },
        );
      } else {
        atualizarMutate({ id, ...valores }, { onSuccess: opcoes.onSuccess });
      }
    },
    [id, criarMutate, atualizarMutate],
  );

  const erro = mutacao.error;
  const errosPorCampo = useMemo(() => (erro ? extrairErrosPorCampo(erro) : SEM_ERROS), [erro]);

  // `sucesso` permanece true depois de salvar: o container o soma a `salvando` para manter o form
  // bloqueado na janela entre o sucesso e a troca de rota (evita um segundo envio/duplicata).
  // `naoEncontrada`: a tarefa editada já não existe; o container oferece voltar para a lista.
  return {
    salvar,
    salvando: mutacao.isPending,
    sucesso: mutacao.isSuccess,
    naoEncontrada: id !== undefined && eNaoEncontrado(erro),
    errosPorCampo,
  };
}
