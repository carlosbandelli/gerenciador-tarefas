import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Apresentação compartilhada: a rota (not-found.tsx, via 404) e o container (quando a tarefa some
// no cliente) mostram a mesma tela amigável.
export function TarefaNaoEncontrada({
  mensagem = "Tarefa não encontrada",
  // `null` omite o subtítulo (quando a mensagem já diz que foi excluída).
  detalhe = "Ela pode ter sido excluída.",
}: {
  mensagem?: string;
  detalhe?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <p className="font-medium">{mensagem}</p>
      {detalhe ? <p className="text-muted-foreground text-sm">{detalhe}</p> : null}
      <Link href="/tarefas" className={buttonVariants({ variant: "outline" })}>
        Voltar para a lista
      </Link>
    </div>
  );
}
