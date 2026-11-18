import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `.mts` porque o package.json não é "type": "module"; como `.ts` o Vite carregaria
// este arquivo como CommonJS e avisa que isso vai quebrar no loader nativo.
export default defineConfig({
  plugins: [react()],
  // Resolução nativa do alias `@/*` a partir do tsconfig (Vite 8+): uma única fonte da verdade,
  // sem plugin extra.
  resolve: {
    tsconfigPaths: true,
    // `server-only` lança ao ser importado fora do build do Next (condição `react-server`), o que
    // quebraria qualquer teste que passe pelo `index.ts` do módulo. No Vitest ele vira um módulo
    // vazio; a proteção real continua valendo no build.
    alias: {
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Imports explícitos de `vitest`; sem globais implícitos.
    globals: false,
    // Cada teste começa com mocks/spies restaurados: isola os testes de servidor.
    restoreMocks: true,
    // Dois ambientes, separados pela extensão:
    // - `.ts`  → lógica de servidor (schema, repositório, router tRPC) em Node puro, igual ao runtime real;
    // - `.tsx` → componentes React em jsdom.
    // E2E (Playwright) fica em `e2e/`, fora dos dois.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
          // CSS não influencia as asserções.
          css: false,
        },
      },
    ],
  },
});
