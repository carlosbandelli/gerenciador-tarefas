import Link from "next/link";
import { memo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ExcluirTarefaDialog } from "./excluir-tarefa-dialog";
import { formatarDataHora } from "./formatar-data";
import type { TarefaView } from "./tarefa-view";

type Props = {
  tarefa: TarefaView;
  onExcluir: (id: string, aoConcluir: () => void) => void;
  excluindo: boolean;
};

// COMPARADOR do `memo` (exportado para ser testado). Decide se o item pode PULAR o render.
//
// Por que não o `memo` raso (comparação por referência de `tarefa`): depois de qualquer refetch
// (invalidação pós-exclusão, foco da janela) o superjson recria os `Date` e o structural sharing
// do TanStack Query (`replaceEqualDeep`) não compartilha objetos que contêm `Date`. Resultado:
// todo item chega com referência NOVA mesmo sem mudança, e o `memo` raso não seguraria nada.
// Então comparamos o CONTEÚDO que importa:
// - `id`: identidade da tarefa;
// - `dataAtualizacao?.getTime()`: toda edição a grava (a criação não), e comparamos o número,
//   não o `Date`, que é um objeto novo a cada refetch;
// - `titulo` e `descricao`: o que o item exibe. Redundantes com `dataAtualizacao` em condições
//   normais, mas duas edições no MESMO milissegundo deixariam o item velho na tela; comparar
//   strings (por valor) é barato e fecha essa brecha;
// - `excluindo`: sem ele o botão nunca refletiria "excluindo";
// - `onExcluir` (identidade): handler velho no item seria um bug; o container o mantém estável.
// NÃO comparamos `dataCriacao`: é imutável para o mesmo `id` (uma tarefa nunca muda de criação).
export function tarefaItemPropsIguais(anterior: Props, proximo: Props): boolean {
  return (
    anterior.tarefa.id === proximo.tarefa.id &&
    anterior.tarefa.titulo === proximo.tarefa.titulo &&
    anterior.tarefa.descricao === proximo.tarefa.descricao &&
    anterior.tarefa.dataAtualizacao?.getTime() === proximo.tarefa.dataAtualizacao?.getTime() &&
    anterior.excluindo === proximo.excluindo &&
    anterior.onExcluir === proximo.onExcluir
  );
}

// Apresentação pura, memoizada com o comparador acima: com a lista longa, excluir/editar um item
// não re-renderiza os demais.
export const TarefaItem = memo(function TarefaItem({ tarefa, onExcluir, excluindo }: Props) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0">
        <h2 className="font-medium break-words">{tarefa.titulo}</h2>
        {tarefa.descricao ? (
          <p data-slot="descricao" className="text-muted-foreground mt-1 text-sm break-words">
            {tarefa.descricao}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-2 text-xs">
          Criada em{" "}
          <time dateTime={tarefa.dataCriacao.toISOString()}>
            {formatarDataHora(tarefa.dataCriacao)}
          </time>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/tarefas/${tarefa.id}/editar`}
          aria-label={`Editar ${tarefa.titulo}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Editar
        </Link>
        <ExcluirTarefaDialog
          id={tarefa.id}
          titulo={tarefa.titulo}
          excluindo={excluindo}
          onConfirmar={(aoConcluir) => onExcluir(tarefa.id, aoConcluir)}
        />
      </div>
    </li>
  );
}, tarefaItemPropsIguais);
