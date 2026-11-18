"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useSalvarTarefa, type ValoresDaTarefa } from "../hooks/use-salvar-tarefa";
import { TarefaForm } from "./tarefa-form";
import { TarefaNaoEncontrada } from "./tarefa-nao-encontrada";

// CONTAINER da edição: busca a tarefa (cache hidratado pelo SSR, então sem fetch nem esqueleto na
// 1ª renderização) e liga o formulário ao hook de dados e à navegação.
export function EditarTarefa({ id }: { id: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const consulta = useQuery(trpc.tarefa.buscarPorId.queryOptions({ id }));
  const { salvar, salvando, sucesso, naoEncontrada, errosPorCampo } = useSalvarTarefa({ id });
  const tarefa = consulta.data;

  // Valores iniciais estáveis por conteúdo da tarefa carregada (o RHF só os lê na montagem).
  const valoresIniciais = useMemo(
    () => (tarefa ? { titulo: tarefa.titulo, descricao: tarefa.descricao ?? "" } : undefined),
    [tarefa],
  );

  // Envia o estado COMPLETO do form (não só `dirtyFields`): o service não grava nem atualiza
  // `dataAtualizacao` quando nada mudou, então mandar tudo é seguro e mantém o código simples.
  const aoSalvar = (valores: ValoresDaTarefa) =>
    salvar(valores, { onSuccess: () => router.push("/tarefas") });

  // Estado de erro SÓ sem dados: um refetch que falha (ex.: foco da janela) com a tarefa em cache
  // não pode desmontar o form nem perder o que o usuário digitou.
  if (consulta.isPending) {
    return (
      <div
        role="status"
        aria-label="Carregando tarefa"
        aria-busy="true"
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (consulta.isError && !tarefa) {
    if (consulta.error.data?.code === "NOT_FOUND") return <TarefaNaoEncontrada />;
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
      >
        <p className="font-medium">Não foi possível carregar a tarefa</p>
        <Button variant="outline" onClick={() => void consulta.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {naoEncontrada ? (
        <TarefaNaoEncontrada mensagem="Essa tarefa foi excluída" detalhe={null} />
      ) : null}
      <TarefaForm
        // `key`: outra tarefa (id novo) remonta o form com os valores dela.
        key={id}
        modo="editar"
        valoresIniciais={valoresIniciais}
        onSalvar={aoSalvar}
        // `sucesso` mantém o form bloqueado até a rota mudar (mesmo padrão da criação);
        // `naoEncontrada`: salvar não tem mais sentido, o texto digitado fica visível.
        salvando={salvando || sucesso || naoEncontrada}
        errosDoServidor={errosPorCampo}
      />
    </div>
  );
}
