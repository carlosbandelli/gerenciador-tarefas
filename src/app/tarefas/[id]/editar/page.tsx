import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditarTarefa } from "@/modules/tarefa/ui";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

// Os dados vivem em memória e mudam a cada mutação: renderiza a cada request (nada de estático).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Códigos que significam "essa tarefa não existe para esta URL": id inexistente (NOT_FOUND) ou
// malformado (BAD_REQUEST do Zod). Qualquer outro erro é inesperado e NÃO vira 404.
const CODIGOS_DE_404 = ["NOT_FOUND", "BAD_REQUEST"];

function codigoDoErro(erro: unknown): string | undefined {
  const { code, data } = erro as { code?: string; data?: { code?: string } };
  return data?.code ?? code;
}

// AGUARDA a busca (lição do SSR da listagem): sem `await` a query vai `pending` ao cliente e o
// HTML sai sem a tarefa. `fetchQuery` (e não `prefetchQuery`) porque aqui precisamos saber se ela
// existe: `prefetchQuery` engole o erro. Dentro da mesma request o `generateMetadata` e a page
// compartilham o cache do `getQueryClient` (staleTime), então a tarefa é lida uma vez só.
async function buscarTarefa(id: string) {
  try {
    // `retry: false`: no servidor, repetir com backoff seguraria a resposta; erro inesperado
    // deve ir direto ao error boundary.
    return await getQueryClient().fetchQuery({
      ...trpc.tarefa.buscarPorId.queryOptions({ id }),
      retry: false,
    });
  } catch (erro) {
    if (CODIGOS_DE_404.includes(codigoDoErro(erro) ?? "")) return null;
    throw erro;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tarefa = await buscarTarefa((await params).id);
  return { title: tarefa ? `Editar: ${tarefa.titulo}` : "Tarefa não encontrada" };
}

export default async function PaginaEditarTarefa({ params }: Props) {
  const { id } = await params;
  const tarefa = await buscarTarefa(id);
  if (!tarefa) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-semibold">Editar tarefa</h1>
      <HydrateClient>
        <EditarTarefa id={id} />
      </HydrateClient>
    </main>
  );
}
