import { describe, expect, it } from "vitest";
import { obterContainerDaTarefa } from "./index";

// Garante que o `index.ts` carrega no Vitest (alias de `server-only`) e expõe o container.
describe("API pública do módulo", () => {
  it("exporta o container e não vaza erros de domínio", async () => {
    expect(obterContainerDaTarefa().tarefaService).toBeDefined();
    const exportados = Object.keys(await import("./index"));
    expect(exportados.sort()).toEqual([
      "criarContainerDaTarefa",
      "criarTarefaRouter",
      "obterContainerDaTarefa",
    ]);
  });
});
