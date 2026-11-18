import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppRouter } from "@/server/routers/_app";
import { criarAmbienteDeTeste } from "@/test/render-com-providers";
import { ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM, TarefasPagina } from "@/modules/tarefa/ui";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Reproduz a page: prefetch no "servidor" -> dehydrate -> cliente hidrata e renderiza.
// A 1ª renderização (síncrona, como no SSR) já precisa ter a lista: sem esqueleto.
async function renderComoSsr({ aguardar }: { aguardar: boolean }) {
  const servidor = criarAmbienteDeTeste();
  await servidor.container.tarefaService.criar({ titulo: "Mais recente do seed" });
  const proxy = createTRPCOptionsProxy<AppRouter>({
    client: servidor.trpcClient,
    queryClient: servidor.queryClient,
  });
  const promessa = servidor.queryClient.prefetchInfiniteQuery(
    proxy.tarefa.listar.infiniteQueryOptions(ENTRADA_DA_LISTAGEM, OPCOES_DA_LISTAGEM),
  );
  if (aguardar) await promessa;
  const estado = dehydrate(servidor.queryClient);

  const cliente = criarAmbienteDeTeste();
  return render(
    <HydrationBoundary state={estado}>
      <TarefasPagina />
    </HydrationBoundary>,
    { wrapper: cliente.Providers },
  );
}

describe("SSR da listagem", () => {
  it("prefetch aguardado: a lista aparece na PRIMEIRA renderização", async () => {
    await renderComoSsr({ aguardar: true });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Mais recente do seed")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Carregando tarefas" })).toBeNull();
  });

  it("controle: sem aguardar o prefetch, a 1ª renderização é o esqueleto", async () => {
    await renderComoSsr({ aguardar: false });
    expect(screen.getByRole("status", { name: "Carregando tarefas" })).toBeInTheDocument();
  });
});
