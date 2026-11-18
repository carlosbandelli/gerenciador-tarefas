import { existsSync, mkdirSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

// Teste das fronteiras de arquitetura: roda o ESLint de verdade (com a config do repositório)
// sobre trechos de código e confere que imports permitidos passam e proibidos falham.
// `import/no-restricted-paths` só avalia imports que RESOLVEM para um arquivo; por isso os
// alvos que não existem no momento do teste ganham um stub vazio durante o teste,
// removido no `afterAll`.

const RAIZ = resolve(import.meta.dirname, "../../..");
const mod = (...p: string[]) => resolve(RAIZ, "src/modules/tarefa", ...p);

const STUBS = [
  mod("application/x.ts"),
  mod("infrastructure/x.ts"),
  mod("interface/x.ts"),
  mod("ui/hooks/x.ts"),
  mod("ui/index.ts"),
];

const criados: string[] = [];

beforeAll(() => {
  for (const arquivo of STUBS) {
    if (existsSync(arquivo)) continue;
    mkdirSync(dirname(arquivo), { recursive: true });
    writeFileSync(arquivo, "export const x = 1;\n");
    criados.push(arquivo);
  }
});

afterAll(() => {
  for (const arquivo of criados) {
    rmSync(arquivo, { force: true });
    // Remove as pastas que o stub deixou vazias (rmdir falha em pasta não vazia: é o desejado).
    for (let dir = dirname(arquivo); dir !== mod(); dir = dirname(dir)) {
      try {
        rmdirSync(dir);
      } catch {
        break;
      }
    }
  }
});

const eslint = new ESLint({ cwd: RAIZ });

async function violacoes(arquivo: string, importDe: string): Promise<string[]> {
  const codigo = `import * as x from "${importDe}";\nexport { x };\n`;
  const [resultado] = await eslint.lintText(codigo, { filePath: resolve(RAIZ, arquivo) });
  return resultado.messages
    .filter(
      (m) => m.ruleId === "import/no-restricted-paths" || m.ruleId === "no-restricted-imports",
    )
    .map((m) => m.message);
}

type Caso = [origem: string, destino: string, permitido: boolean];

const casos: Caso[] = [
  // Fora do módulo: só a API pública (index.ts e ui/index.ts).
  ["src/app/page.tsx", "@/modules/tarefa", true],
  ["src/app/page.tsx", "@/modules/tarefa/ui", true],
  ["src/app/page.tsx", "@/modules/tarefa/ui/hooks/x", false],
  ["src/app/page.tsx", "@/modules/tarefa/domain/tarefa", false],
  ["src/app/tarefas/page.tsx", "../../modules/tarefa/domain/tarefa", false],
  ["src/server/trpc.ts", "@/modules/tarefa/interface/x", false],
  ["src/trpc/server.ts", "@/modules/tarefa/infrastructure/x", false],
  // domain
  ["src/modules/tarefa/domain/titulo.ts", "zod", false],
  ["src/modules/tarefa/domain/titulo.ts", "zod/v4", false],
  ["src/modules/tarefa/domain/titulo.ts", "next/server", false],
  ["src/modules/tarefa/domain/titulo.ts", "react", false],
  ["src/modules/tarefa/domain/titulo.ts", "@trpc/server", false],
  ["src/modules/tarefa/domain/titulo.ts", "../interface/x", false],
  ["src/modules/tarefa/domain/titulo.ts", "../ui", false],
  ["src/modules/tarefa/domain/titulo.ts", "../application/x", false],
  ["src/modules/tarefa/domain/titulo.ts", "../infrastructure/x", false],
  ["src/modules/tarefa/domain/titulo.ts", "./regras", true],
  // application
  ["src/modules/tarefa/application/s.ts", "../infrastructure/x", false],
  ["src/modules/tarefa/application/s.ts", "../interface/x", false],
  ["src/modules/tarefa/application/s.ts", "next/server", false],
  ["src/modules/tarefa/application/s.ts", "zod", false],
  ["src/modules/tarefa/application/s.ts", "@trpc/server", false],
  ["src/modules/tarefa/application/s.ts", "../domain/tarefa", true],
  // infrastructure
  ["src/modules/tarefa/infrastructure/r.ts", "../application/x", false],
  ["src/modules/tarefa/infrastructure/r.ts", "../interface/x", false],
  ["src/modules/tarefa/infrastructure/r.ts", "../ui", false],
  ["src/modules/tarefa/infrastructure/r.ts", "../domain/tarefa", true],
  // interface
  ["src/modules/tarefa/interface/router.ts", "../application/x", true],
  ["src/modules/tarefa/interface/router.ts", "zod", true],
  // composition root do módulo
  ["src/modules/tarefa/container.ts", "./infrastructure/x", true],
  ["src/modules/tarefa/container.ts", "./application/x", true],
  // O container só é alcançado pela API pública (`index.ts`) e por testes de integração na raiz;
  // nenhuma camada o importa (a dependência chega por injeção).
  ["src/modules/tarefa/index.ts", "./container", true],
  ["src/modules/tarefa/container.test.ts", "./container", true],
  ["src/modules/tarefa/interface/router.ts", "../container", false],
  // Módulos não importam a camada transversal `src/server` (evita o ciclo módulo <-> server).
  ["src/modules/tarefa/interface/tarefa-router.ts", "@/server/trpc", false],
  ["src/modules/tarefa/index.ts", "@/server/trpc", false],
  ["src/server/routers/_app.ts", "@/modules/tarefa", true],
  ["src/modules/tarefa/application/tarefa-service.ts", "../container", false],
  ["src/modules/tarefa/application/tarefa-service.test.ts", "../container", false],
  ["src/modules/tarefa/domain/titulo.ts", "../container", false],
  ["src/modules/tarefa/infrastructure/r.ts", "../container", false],
  ["src/modules/tarefa/ui/componente.tsx", "../container", false],
  // Porta e contrato são domínio: application pode usar `domain/testing`.
  [
    "src/modules/tarefa/application/testing/fakes.ts",
    "../../domain/testing/tarefa-repository.contract",
    true,
  ],
  // ui (roda no navegador): nada de código de servidor no bundle do cliente
  ["src/modules/tarefa/ui/componente.tsx", "../application/x", false],
  ["src/modules/tarefa/ui/componente.tsx", "../infrastructure/x", false],
  ["src/modules/tarefa/ui/componente.tsx", "../interface/x", true],
  // ui consome dados só via infra tRPC do cliente (`@/trpc/client`) e nunca o servidor.
  ["src/modules/tarefa/ui/hooks/h.ts", "@/trpc/client", true],
  ["src/modules/tarefa/ui/hooks/h.ts", "@/modules/tarefa", false],
  ["src/modules/tarefa/ui/hooks/h.ts", "@/server/routers/_app", false],
  ["src/modules/tarefa/ui/hooks/h.ts", "@/server/trpc", false],
  ["src/modules/tarefa/ui/hooks/h.ts", "@/trpc/server", false],
  // `src/test` (helpers de teste) só entra em arquivos de teste.
  ["src/modules/tarefa/ui/hooks/h.ts", "@/test/render-com-providers", false],
  ["src/trpc/client.tsx", "@/test/render-com-providers", false],
  ["src/modules/tarefa/ui/hooks/h.test.tsx", "@/test/render-com-providers", true],
  ["src/trpc/client.test.ts", "@/test/render-com-providers", true],
];

// O primeiro `lintText` carrega o ESLint e todos os plugins (vários segundos); com a suíte rodando
// em paralelo isso estourava o limite padrão de 5 s e deixava o teste instável.
describe("fronteiras de arquitetura (ESLint)", { timeout: 30_000 }, () => {
  it.each(casos)("%s -> %s (permitido: %s)", async (origem, destino, permitido) => {
    const msgs = await violacoes(origem, destino);
    if (permitido) expect(msgs).toEqual([]);
    else expect(msgs.length).toBeGreaterThan(0);
  });
});
