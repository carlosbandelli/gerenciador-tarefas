import { TarefaNaoEncontrada } from "@/modules/tarefa/ui";

export default function TarefaNaoEncontradaPagina() {
  return (
    <main className="mx-auto w-full max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-semibold">Tarefa não encontrada</h1>
      <TarefaNaoEncontrada />
    </main>
  );
}
