import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookComProviders } from "@/test/render-com-providers";
import { useExcluirTarefa } from "./use-excluir-tarefa";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("useExcluirTarefa: callbacks por chamada", () => {
  it("onSuccess e onSettled no sucesso", async () => {
    const { result, container } = renderHookComProviders(() => useExcluirTarefa());
    const t = await container.tarefaService.criar({ titulo: "A" });
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    act(() => result.current.excluir(t.id, { onSuccess, onSettled }));
    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("onError recebe o erro com o código do servidor", async () => {
    const { result } = renderHookComProviders(() => useExcluirTarefa());
    const onError = vi.fn();
    act(() => result.current.excluir("3f2504e0-4f89-41d3-9a0c-0305e82c3301", { onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0][0].data?.code).toBe("NOT_FOUND");
  });

  it("só onSettled no erro", async () => {
    const { result } = renderHookComProviders(() => useExcluirTarefa());
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    act(() =>
      result.current.excluir("3f2504e0-4f89-41d3-9a0c-0305e82c3301", { onSuccess, onSettled }),
    );
    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
