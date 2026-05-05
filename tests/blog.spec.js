const { test, expect } = require("@playwright/test");

test("home page shows the blog shell and first post", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("link", { name: "Sakura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "第一篇文章：把博客先跑起来" })).toBeVisible();
});

test("post page renders readable article content", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");

  await expect(page.getByRole("heading", { name: "第一篇文章：把博客先跑起来" })).toBeVisible();
  await expect(page.getByText("今天先把博客跑起来。")).toBeVisible();
});

test("search finds the example post", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "搜索文章" }).click();
  await page.getByPlaceholder("搜索标题或摘要").fill("博客");

  await expect(page.locator(".search-result")).toContainText("第一篇文章");
});

test("archive groups posts by writing categories", async ({ page }) => {
  await page.goto("archive.html");

  await expect(page.getByRole("link", { name: /随笔/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /学习/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "随笔" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "学习" })).toBeVisible();
  await expect(page.locator("#essays")).toContainText("第一篇文章：把博客先跑起来");
  await expect(page.locator("#study")).toContainText("这一类还在等第一篇文章");
});
