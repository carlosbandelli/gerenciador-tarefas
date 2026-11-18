import {
  useMutation,
  useMutationState,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

type PaginaDeTarefas = { itens: { id: string }[]; proximoCursor: string | null };

// Hook de DADOS + feedback: exclui e mantém o cache coerente. Sem JSX.
export function useExcluirTarefa() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate } = useMutation(
    trpc.tarefa.deletar.mutationOptions({
      onSuccess: ({ id }) => {
        // Atualização imediata do cache (sem esperar o refetch): tira o item de todas as
        // páginas da lista.
        queryClient.setQueriesData<InfiniteData<PaginaDeTarefas>>(
          trpc.tarefa.listar.infiniteQueryFilter(),
          (dados) =>
            dados && {
              ...dados,
              pages: dados.pages.map((pagina) => ({
                ...pagina,
                itens: pagina.itens.filter((tarefa) => tarefa.id !== id),
              })),
            },
        );
        // Detalhe da tarefa excluída não deve ficar em cache.
        queryClient.removeQueries(trpc.tarefa.buscarPorId.queryFilter({ id }));
        // Reconcilia com o servidor (paginação/cursor podem ter mudado).
        void queryClient.invalidateQueries(trpc.tarefa.listar.infiniteQueryFilter());
        toast.success("Tarefa excluída");
      },
      onError: (erro) => {
        // O item pode já não existir (excluído por outro): reconcilia a lista com o servidor.
        void queryClient.invalidateQueries(trpc.tarefa.listar.infiniteQueryFilter());
        toast.error(erro.message);
      },
    }),
  );

  // `useMutation` guarda UMA mutação por observer: com exclusões concorrentes, `variables` só
  // reflete a última. O estado de TODAS as pendentes vem do cache de mutações.
  const excluindoIds = useMutationState({
    filters: { mutationKey: trpc.tarefa.deletar.mutationKey(), status: "pending" },
    select: (mutacao) => (mutacao.state.variables as { id: string }).id,
  });
  const conjunto = useMemo(() => new Set(excluindoIds), [excluindoIds]);

  // `mutate` é estável: `excluir` também, então itens memoizados não re-renderizam.
  // `opcoes` são callbacks DA CHAMADA (ex.: fechar o diálogo, mover o foco); toasts e cache
  // continuam aqui no hook.
  // PREMISSA: a UI exclui uma tarefa por vez (o diálogo é modal). O TanStack só dispara os
  // callbacks por chamada da ÚLTIMA `mutate` de um observer; com exclusões concorrentes os das
  // anteriores se perderiam (o cache e os toasts, que estão no hook, seguem corretos).
  const excluir = useCallback(
    (
      id: string,
      opcoes?: {
        onSuccess?: () => void;
        onError?: (erro: { data?: { code?: string } | null }) => void;
        onSettled?: () => void;
      },
    ) => mutate({ id }, opcoes),
    [mutate],
  );
  // Estável enquanto o conjunto de ids em exclusão não muda.
  const estaExcluindo = useCallback((id: string) => conjunto.has(id), [conjunto]);

  return { excluir, estaExcluindo, excluindoIds };
}
