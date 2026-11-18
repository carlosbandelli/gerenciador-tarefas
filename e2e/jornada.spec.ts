import { expect, test, type Page } from "@playwright/test";

// A ordem com mesma data desempata por id aleatório e o repositório é compartilhado em memória:
// por isso os títulos levam timestamp e nada depende de posição fixa além do "mais novo no topo".
const itens = (page: Page) => page.getByRole("listitem").filter({ has: page.getByRole("heading") });

test("SSR: o HTML da listagem já traz itens, sem JavaScript", async ({ request }) => {
  const resposta = await request.get("/tarefas");
  expect(resposta.ok()).toBe(true);
  const html = await resposta.text();
  expect(html.match(/<li[\s>]/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
  expect(html).toContain("Nova tarefa");
});

test("404: tarefa inexistente na edição", async ({ page }) => {
  await page.goto("/tarefas/00000000-0000-4000-8000-000000000000/editar");
  await expect(page.getByText("Tarefa não encontrada").first()).toBeVisible();
});

test("jornada: criar, editar, excluir e rolar a lista", async ({ page }) => {
  const titulo = `E2E ${Date.now()}`;
  const tituloEditado = `${titulo} editada`;

  await test.step("/ redireciona para /tarefas com 10 itens", async () => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/tarefas$/);
    await expect(itens(page)).toHaveCount(10);
  });

  await test.step("criar: valida vazio e salva", async () => {
    await page.getByRole("link", { name: "Nova tarefa" }).click();
    await expect(page).toHaveURL(/\/tarefas\/nova$/);

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("O título é obrigatório")).toBeVisible();

    await page.getByLabel("Título").fill(titulo);
    await page.getByLabel("Descrição").fill("Criada pelo teste E2E");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/tarefas$/);
    await expect(page.getByText("Tarefa criada")).toBeVisible();
    await expect(itens(page).first().getByRole("heading")).toHaveText(titulo);
  });

  await test.step("editar: form preenchido, novo título na lista", async () => {
    await page.getByRole("link", { name: `Editar ${titulo}` }).click();
    await expect(page).toHaveURL(/\/tarefas\/.+\/editar$/);
    await expect(page.getByLabel("Título")).toHaveValue(titulo);
    await expect(page.getByLabel("Descrição")).toHaveValue("Criada pelo teste E2E");

    await page.getByLabel("Título").fill(tituloEditado);
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page).toHaveURL(/\/tarefas$/);
    await expect(page.getByText("Tarefa atualizada")).toBeVisible();
    await expect(page.getByRole("heading", { name: tituloEditado })).toBeVisible();
    await expect(page.getByRole("heading", { name: titulo, exact: true })).toHaveCount(0);
  });

  await test.step("excluir: Cancelar mantém; Excluir remove", async () => {
    const abrir = () => page.getByRole("button", { name: `Excluir ${tituloEditado}` }).click();
    const dialogo = page.getByRole("alertdialog");

    await abrir();
    await expect(dialogo.getByText(`Excluir “${tituloEditado}”?`)).toBeVisible();
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole("heading", { name: tituloEditado })).toBeVisible();

    await abrir();
    await dialogo.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText("Tarefa excluída")).toBeVisible();
    await expect(page.getByRole("heading", { name: tituloEditado })).toHaveCount(0);
  });

  await test.step("infinite scroll: rolar até o fim carrega tudo", async () => {
    await page.reload();
    await expect(itens(page)).toHaveCount(10);

    const fim = page.getByText("Você viu todas as tarefas");
    await expect(async () => {
      await page.mouse.wheel(0, 4000);
      await expect(fim).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });

    expect(await itens(page).count()).toBeGreaterThan(10);
  });

  await test.step("botão Carregar mais carrega a próxima página", async () => {
    // O botão é a alternativa ao scroll automático (teclado/leitor de tela). Desligamos o
    // IntersectionObserver neste passo: sem isso, em viewport alto o sentinela já dispara a
    // carga sozinho, o botão fica `aria-disabled` e o clique vira uma corrida (falhava no CI).
    await page.addInitScript(() => {
      class ObserverInerte {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
      Object.defineProperty(window, "IntersectionObserver", { value: ObserverInerte });
    });
    await page.reload();
    await expect(itens(page)).toHaveCount(10);
    await page.getByRole("button", { name: "Carregar mais" }).click();
    await expect.poll(() => itens(page).count()).toBeGreaterThan(10);
  });
});
