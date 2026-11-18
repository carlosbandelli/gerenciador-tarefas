import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function ListaVazia() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">Nenhuma tarefa ainda</p>
      <p className="text-muted-foreground text-sm">Crie a primeira para começar.</p>
      <Link href="/tarefas/nova" className={buttonVariants()}>
        Criar a primeira tarefa
      </Link>
    </div>
  );
}
