import { describe, expect, it } from "vitest";
import { RelogioDoSistema } from "./relogio-do-sistema";

describe("RelogioDoSistema", () => {
  it("devolve a hora atual", () => {
    const antes = Date.now();
    const agora = new RelogioDoSistema().agora().getTime();
    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora).toBeLessThanOrEqual(Date.now());
  });

  it("devolve uma nova instância a cada chamada", () => {
    const relogio = new RelogioDoSistema();
    expect(relogio.agora()).not.toBe(relogio.agora());
  });
});
