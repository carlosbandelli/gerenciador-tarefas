"use client";

import { useRouter } from "next/navigation";
import { useSalvarTarefa, type ValoresDaTarefa } from "../hooks/use-salvar-tarefa";
import { TarefaForm } from "./tarefa-form";

// CONTAINER da criação: liga o formulário ao hook de dados e à navegação.
export function NovaTarefa() {
  const router = useRouter();
  const { salvar, salvando, sucesso, errosPorCampo } = useSalvarTarefa();

  // Sem `useCallback`: o `TarefaForm` não é memoizado (as props mudam a cada transição da mutação).
  // A navegação só roda com o componente montado; toast e invalidação ficam no hook (sobrevivem à
  // desmontagem) e rodam ANTES deste `onSuccess`.
  const aoSalvar = (valores: ValoresDaTarefa) =>
    salvar(valores, { onSuccess: () => router.push("/tarefas") });

  return (
    <TarefaForm
      modo="criar"
      onSalvar={aoSalvar}
      // `sucesso` mantém o form bloqueado até a rota mudar: `isPending` já voltou a false e o
      // usuário poderia reenviar (duplicando a tarefa) na janela da navegação.
      salvando={salvando || sucesso}
      errosDoServidor={errosPorCampo}
    />
  );
}
