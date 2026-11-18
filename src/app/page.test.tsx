import { describe, expect, it, vi } from "vitest";

// `redirect` real lança uma exceção especial; o mock só registra a chamada.
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

import Home from "./page";

describe("Home", () => {
  it("redireciona para /tarefas", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/tarefas");
  });
});
