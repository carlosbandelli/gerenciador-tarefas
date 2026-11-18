import { describe, expect, it } from "vitest";
import { formatarDataHora } from "./formatar-data";

describe("formatarDataHora", () => {
  it("formata dd/MM/yyyy HH:mm no fuso de São Paulo", () => {
    expect(formatarDataHora(new Date("2026-11-17T15:30:00Z"))).toBe("17/11/2026 12:30");
  });

  it("meia-noite local é 00:00 (ciclo h23, nunca 24:00)", () => {
    expect(formatarDataHora(new Date("2026-11-17T03:00:00Z"))).toBe("17/11/2026 00:00");
  });

  it("02:00Z cai no dia anterior às 23:00 em São Paulo", () => {
    expect(formatarDataHora(new Date("2026-11-17T02:00:00Z"))).toBe("16/11/2026 23:00");
  });
});
