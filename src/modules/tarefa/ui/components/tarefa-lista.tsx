import { TarefaItem } from "./tarefa-item";
import type { TarefaView } from "./tarefa-view";

type Props = {
  tarefas: readonly TarefaView[];
  onExcluir: (id: string, aoConcluir: () => void) => void;
  estaExcluindo: (id: string) => boolean;
  // id do título que nomeia a lista (aria-labelledby): evita rótulo repetido/solto.
  rotuloId: string;
};

export function TarefaLista({ tarefas, onExcluir, estaExcluindo, rotuloId }: Props) {
  return (
    <ul aria-labelledby={rotuloId} className="flex flex-col gap-3">
      {tarefas.map((tarefa) => (
        <TarefaItem
          key={tarefa.id}
          tarefa={tarefa}
          onExcluir={onExcluir}
          excluindo={estaExcluindo(tarefa.id)}
        />
      ))}
    </ul>
  );
}
