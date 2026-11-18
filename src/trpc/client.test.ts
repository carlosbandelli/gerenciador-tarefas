import { afterEach, describe, expect, it, vi } from "vitest";
import { obterQueryClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("obterQueryClient", () => {
  it("no servidor (sem window) devolve um QueryClient NOVO a cada chamada", () => {
    expect(typeof window).toBe("undefined");
    expect(obterQueryClient()).not.toBe(obterQueryClient());
  });

  it("no browser devolve sempre o mesmo QueryClient (singleton)", () => {
    vi.stubGlobal("window", {});
    expect(obterQueryClient()).toBe(obterQueryClient());
  });
});
