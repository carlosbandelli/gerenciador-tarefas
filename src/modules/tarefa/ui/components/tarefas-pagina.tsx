"use client";

import { useCallback, useEffect, useRef } from "react";
import { ATRIBUTO_ID_DA_TAREFA, TITULO_DA_LISTA_ID } from "../constantes";
import { useExcluirTarefa } from "../hooks/use-excluir-tarefa";
import { useTarefas } from "../hooks/use-tarefas";
import { CarregarMais } from "./carregar-mais";
import { ErroAoCarregar } from "./erro-ao-carregar";
import { ListaCarregando } from "./lista-carregando";
import { ListaVazia } from "./lista-vazia";
import { TarefaLista } from "./tarefa-lista";

// CONTAINER: junta os hooks de dados e decide qual estado apresentar. Não tem markup próprio.
export function TarefasPagina() {
  const {
    tarefas,
    isPending,
    isError,
    refetch,
    hasNextPage,
    isFetching,
    isRefetchError,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useTarefas();
  const { excluir, estaExcluindo } = useExcluirTarefa();

  // Foco após excluir: o item some, então o foco iria para o <body>. Guardamos os vizinhos (ordem
  // que só o container conhece) e, quando a lista já não tem o item, focamos o botão Excluir do
  // próximo, senão do anterior, senão o título da página.
  const tarefasRef = useRef(tarefas);
  useEffect(() => {
    tarefasRef.current = tarefas;
  });
  const focoPendente = useRef<{ id: string; vizinhos: string[] } | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const botaoDe = (id: string) =>
    document.querySelector<HTMLElement>(`[${ATRIBUTO_ID_DA_TAREFA}="${CSS.escape(id)}"]`);

  // Roda depois que o item saiu da lista (efeito) e também logo após o sucesso (o cache pode já
  // ter commitado antes de `onSuccess` marcar o foco pendente).
  const focarVizinho = useCallback(() => {
    const foco = focoPendente.current;
    if (!foco || tarefasRef.current.some((t) => t.id === foco.id)) return;
    focoPendente.current = null;
    // Não rouba o foco que o usuário já moveu para outro lugar da página.
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && !raizRef.current?.contains(ativo)) return;
    // Recalcula no momento de focar: o vizinho guardado pode ter sumido também.
    const atuais = tarefasRef.current;
    const alvo =
      foco.vizinhos.map(botaoDe).find(Boolean) ?? atuais.map((t) => botaoDe(t.id)).find(Boolean);
    (alvo ?? document.getElementById(TITULO_DA_LISTA_ID))?.focus();
  }, []);

  // `useCallback` (memoização do TarefaItem): este handler vai a CADA item e o comparador do `memo`
  // o compara por identidade. Sem ele, qualquer render do container (ex.: `excluindoIds` mudou)
  // criaria uma função nova e todos os itens re-renderizariam. Deps `excluir` e `focarVizinho`
  // são estáveis. O `onConfirmar` inline dentro do item vai ao `ExcluirTarefaDialog` (não
  // memoizado) e só é recriado quando o próprio item renderiza: não precisa de `useCallback`.
  const excluirItem = useCallback(
    (id: string, aoConcluir: () => void) => {
      focoPendente.current = null;
      clearTimeout(temporizador.current);
      const lista = tarefasRef.current;
      const i = lista.findIndex((t) => t.id === id);
      const vizinhos = [lista[i + 1]?.id, lista[i - 1]?.id].filter((v): v is string => !!v);
      const marcarFoco = () => {
        focoPendente.current = { id, vizinhos };
        temporizador.current = setTimeout(focarVizinho, 0);
      };
      excluir(id, {
        onSuccess: marcarFoco,
        // "Já excluída por outro": o item vai sumir no refetch; o foco precisa ir para um vizinho.
        onError: (erro) => {
          if (erro.data?.code === "NOT_FOUND") marcarFoco();
        },
        onSettled: aoConcluir,
      });
    },
    [excluir, focarVizinho],
  );

  useEffect(focarVizinho, [focarVizinho, tarefas]);

  // Estável: o rodapé não re-renderiza por causa de um callback novo.
  const carregarMais = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  if (isPending) return <ListaCarregando />;
  // Erro SEM dados: tela de erro. Erro de refetch COM dados em cache: mantém a lista.
  if (isError && tarefas.length === 0) {
    // `refetch` devolve Promise; o botão só precisa disparar.
    return <ErroAoCarregar onTentarNovamente={() => void refetch()} />;
  }
  if (tarefas.length === 0) return <ListaVazia />;
  return (
    <div ref={raizRef}>
      {isRefetchError && !isFetchNextPageError ? (
        <p role="status" className="text-muted-foreground mb-3 text-sm">
          Não foi possível atualizar a lista.
        </p>
      ) : null}
      <TarefaLista
        tarefas={tarefas}
        onExcluir={excluirItem}
        estaExcluindo={estaExcluindo}
        rotuloId={TITULO_DA_LISTA_ID}
      />
      <CarregarMais
        temMais={hasNextPage}
        carregando={isFetchingNextPage}
        ocupado={isFetching}
        versaoDaLista={tarefas.length}
        erro={isFetchNextPageError}
        onCarregarMais={carregarMais}
      />
    </div>
  );
}
