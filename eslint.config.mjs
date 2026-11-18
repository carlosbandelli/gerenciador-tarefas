import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Por último: desliga regras de estilo que conflitam com o Prettier.
  prettier,
  // ---------------------------------------------------------------------------------------
  // Fronteiras de arquitetura (testadas em src/modules/tarefa/arquitetura.test.ts).
  // Dependência: interface -> application -> domain <- infrastructure; `ui` fica de fora.
  //
  // Duas ferramentas com papéis distintos, para uma não sobrescrever a outra (no flat config,
  // dois blocos com a mesma regra nos mesmos arquivos NÃO se somam: o último vence):
  //  - `import/no-restricted-paths`: fronteiras entre PASTAS (todas as zonas num bloco só);
  //  - `no-restricted-imports`: só PACOTES externos proibidos por camada.
  //
  // Cross-module: hoje existe um só módulo (`tarefa`). Ao criar o segundo (ex.: `usuario`),
  // acrescente uma zona que impeça `src/modules/usuario/**` de importar internos de `tarefa`
  // (e vice-versa), liberando só `index.ts` e `ui/index.ts` via `except`, e inclua os novos
  // `index.ts` no `except` da zona "fora dos módulos".
  // ---------------------------------------------------------------------------------------
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/modules/*/domain/**",
              from: [
                "./src/modules/*/application/**",
                "./src/modules/*/infrastructure/**",
                "./src/modules/*/interface/**",
                "./src/modules/*/ui/**",
              ],
              message:
                "Regra de dependência: o domínio não importa application, infrastructure, interface nem ui.",
            },
            {
              target: "./src/modules/*/application/**",
              from: [
                "./src/modules/*/infrastructure/**",
                "./src/modules/*/interface/**",
                "./src/modules/*/ui/**",
              ],
              message:
                "Regra de dependência: application depende só de domain (portas); a infrastructure é injetada pelo container.",
            },
            {
              target: "./src/modules/*/infrastructure/**",
              from: [
                "./src/modules/*/application/**",
                "./src/modules/*/interface/**",
                "./src/modules/*/ui/**",
              ],
              message:
                "Regra de dependência: infrastructure implementa as portas do domain; não conhece application, interface nem ui.",
            },
            {
              // `ui` roda no navegador: importar service/repositório colocaria código de servidor
              // no bundle do cliente. A UI fala com o servidor só via tRPC (hooks).
              target: "./src/modules/*/ui/**",
              from: ["./src/modules/*/application/**", "./src/modules/*/infrastructure/**"],
              message:
                "A ui roda no cliente: não importa application nem infrastructure (use os hooks tRPC).",
            },
            {
              // O `index.ts` do módulo tem `server-only` e exporta o container: a ui (navegador)
              // fala com o servidor só por `@/trpc/client`. `import type { AppRouter }` de
              // `@/server` também é barrado (a zona "módulos não importam src/server" vale para
              // type-only): o tipo chega pelo `useTRPC` já tipado.
              target: "./src/modules/*/ui/**",
              // `src/trpc/server.tsx` também é `server-only` (caller direto + cache do servidor).
              from: ["./src/modules/*/index.ts", "./src/trpc/server.{ts,tsx}"],
              message:
                "A ui roda no cliente: não importe o index do módulo nem `@/trpc/server` (server-only); use `@/trpc/client`.",
            },
            {
              // Helpers de teste (`src/test`) só entram em arquivos de teste. A negação por glob
              // (`!(*.test)`) deixa passar `*.test.ts(x)` sem um bloco `no-restricted-imports`, que
              // se sobreporia ao dos módulos (mesma regra, mesmos arquivos: o último vence).
              target: ["./src/**/!(*.test).ts", "./src/**/!(*.test).tsx"],
              from: "./src/test/**",
              message: "`src/test` contém helpers de teste: só arquivos `*.test.ts(x)` o importam.",
            },
            {
              // Nenhuma camada importa o composition root: ele liga as camadas, não é usado por
              // elas. Só o `index.ts` do módulo e testes de integração na raiz o importam.
              target: ["domain", "application", "infrastructure", "interface", "ui"].map(
                (camada) => `./src/modules/*/${camada}/**`,
              ),
              from: "./src/modules/*/container.ts",
              message:
                "A dependência chega por injeção (ex.: contexto do tRPC); nunca importe o container de dentro de uma camada.",
            },
            {
              // `src/server` é a camada transversal que COMPÕE os módulos (injeta o `t` do tRPC):
              // a dependência é sempre server -> módulo, nunca o contrário (sem ciclo).
              target: "./src/modules",
              from: "./src/server",
              message:
                "Os módulos não importam `src/server`: o server injeta o que o módulo precisa (ex.: `criarTarefaRouter(t)`).",
            },
            {
              // Monólito modular: fora de `src/modules/`, só a API pública de cada módulo.
              target: ["./src/app", "./src/server", "./src/trpc", "./src/components", "./src/lib"],
              from: "./src/modules",
              except: ["./tarefa/index.ts", "./tarefa/ui/index.ts"],
              message:
                "Fronteira de módulo: importe só a API pública (`@/modules/<modulo>` ou `@/modules/<modulo>/ui`).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.{ts,tsx}"],
    // Testes não são domínio: podem comparar o VO com o Zod (ver regras.test.ts).
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["zod", "next", "react", "react-dom", "server-only"].map((name) => ({
            name,
            message: "O domínio é puro: sem frameworks, validação de borda nem server-only.",
          })),
          patterns: [
            {
              group: ["zod/*", "next/*", "react/*", "react-dom/*", "@trpc/*"],
              message: "O domínio é puro: sem frameworks, validação de borda nem server-only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/application/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["zod", "next", "react", "react-dom"].map((name) => ({
            name,
            message: "Application orquestra o domínio: sem frameworks nem validação de borda.",
          })),
          patterns: [
            {
              group: ["zod/*", "next/*", "react/*", "react-dom/*", "@trpc/*"],
              message: "Application orquestra o domínio: sem frameworks nem validação de borda.",
            },
          ],
        },
      ],
    },
  },
  // O ESLint 9 não lê o .gitignore; os ignores precisam ser explícitos.
  globalIgnores([
    // Padrões do eslint-config-next (redeclarados porque este bloco os substitui).
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Saídas de teste.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
