import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookComProviders } from "@/test/render-com-providers";
import { useSalvarTarefa } from "./use-salvar-tarefa";
import { useTarefas } from "./use-tarefas";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ID_INEXISTENTE = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("useSalvarTarefa", () => {
  it("cria: invalida a lista, avisa e chama onSuccess", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHookComProviders(() => ({
      lista: useTarefas(),
      form: useSalvarTarefa(),
    }));
    await waitFor(() => expect(result.current.lista.isPending).toBe(false));
    expect(result.current.lista.tarefas).toHaveLength(0);

    act(() => result.current.form.salvar({ titulo: "Nova" }, { onSuccess }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa criada"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.lista.tarefas.map((t) => t.titulo)).toEqual(["Nova"]),
    );
  });

  it("desmontar antes de a mutação terminar ainda invalida a lista e mostra o toast", async () => {
    const { result, unmount, queryClient } = renderHookComProviders(() => useSalvarTarefa());
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");
    const onSuccess = vi.fn();

    act(() => result.current.salvar({ titulo: "Nova" }, { onSuccess }));
    unmount();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa criada"));
    expect(invalidar).toHaveBeenCalled();
    // O callback do chamador pertence ao observer desmontado: não roda (comportamento esperado).
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("atualiza quando recebe id, apaga a descrição com null e invalida lista e detalhe", async () => {
    const { result, rerender, container, queryClient } = renderHookComProviders(
      ({ id }: { id?: string }) => useSalvarTarefa({ id }),
      { initialProps: {} },
    );
    const t = await container.tarefaService.criar({ titulo: "A", descricao: "d" });
    rerender({ id: t.id });
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");

    act(() => result.current.salvar({ titulo: "A2", descricao: null }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa atualizada"));
    // só a lista é invalidada; o detalhe é gravado direto no cache com o DTO devolvido
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueriesData({ predicate: (q) => JSON.stringify(q.queryKey).includes(t.id) }),
    ).toHaveLength(1);
    const salva = await container.tarefaService.buscarPorId(t.id);
    expect(salva.titulo).toBe("A2");
    expect(salva.descricao).toBeUndefined();
  });

  it("erro de validação expõe fieldErrors.titulo e não dispara toast", async () => {
    const { result } = renderHookComProviders(() => useSalvarTarefa());
    expect(result.current.errosPorCampo).toEqual({});

    act(() => result.current.salvar({ titulo: "" }));

    await waitFor(() =>
      expect(result.current.errosPorCampo.titulo).toEqual(["O título é obrigatório"]),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro de domínio com data.campo vira erro do campo, sem toast", async () => {
    const { result, container } = renderHookComProviders(() => useSalvarTarefa());
    vi.spyOn(container.tarefaService, "criar").mockRejectedValue({
      name: "RegraDeNegocioError",
      message: "Título duplicado",
      campo: "titulo",
    });

    act(() => result.current.salvar({ titulo: "X" }));

    await waitFor(() =>
      expect(result.current.errosPorCampo).toEqual({ titulo: ["Título duplicado"] }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("erro de domínio com campo desconhecido do form vira toast", async () => {
    const { result, container } = renderHookComProviders(() => useSalvarTarefa());
    vi.spyOn(container.tarefaService, "criar").mockRejectedValue({
      name: "RegraDeNegocioError",
      message: "Regra qualquer",
      campo: "outro",
    });

    act(() => result.current.salvar({ titulo: "X" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Regra qualquer"));
    expect(result.current.errosPorCampo).toEqual({});
  });

  it("id inválido no atualizar (erro no campo id, fora do form) vira toast.error", async () => {
    const { result } = renderHookComProviders(() => useSalvarTarefa({ id: "nao-e-uuid" }));

    act(() => result.current.salvar({ titulo: "X" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(result.current.errosPorCampo).toEqual({});
  });

  it("NOT_FOUND ao atualizar vira o toast de tarefa excluída e marca naoEncontrada", async () => {
    const { result } = renderHookComProviders(() => useSalvarTarefa({ id: ID_INEXISTENTE }));

    act(() => result.current.salvar({ titulo: "X" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Essa tarefa foi excluída"));
    expect(result.current.naoEncontrada).toBe(true);
    expect(result.current.errosPorCampo).toEqual({});
  });

  it("limpa os erros por campo após um sucesso numa nova tentativa", async () => {
    const { result } = renderHookComProviders(() => useSalvarTarefa());
    act(() => result.current.salvar({ titulo: "" }));
    await waitFor(() => expect(result.current.errosPorCampo.titulo).toBeDefined());

    act(() => result.current.salvar({ titulo: "Ok" }));

    await waitFor(() => expect(result.current.errosPorCampo).toEqual({}));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa criada"));
  });

  it("dois salvar seguidos: ambos persistem e avisam", async () => {
    const { result, container } = renderHookComProviders(() => useSalvarTarefa());

    act(() => {
      result.current.salvar({ titulo: "Um" });
      result.current.salvar({ titulo: "Dois" });
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));
    const { itens } = await container.tarefaService.listar({ limit: 10 });
    expect(itens.map((t) => t.titulo).sort()).toEqual(["Dois", "Um"]);
  });

  it("errosPorCampo mantém a mesma referência entre renders sem mudança (useMemo)", async () => {
    const { result, rerender } = renderHookComProviders(() => useSalvarTarefa());
    act(() => result.current.salvar({ titulo: "" }));
    await waitFor(() => expect(result.current.errosPorCampo.titulo).toBeDefined());
    const antes = result.current.errosPorCampo;
    rerender();
    expect(result.current.errosPorCampo).toBe(antes);
  });
});
