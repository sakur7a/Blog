const { test, expect } = require("@playwright/test");

test("home page shows the blog shell and first post", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("link", { name: "Sakura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "第一篇文章：把博客先跑起来" })).toBeVisible();
  await expect(page.locator(".entry-header")).toHaveCSS("background-size", "cover");
  await expect(page.locator(".entry-header .header-title")).toBeHidden();
  await expect(page.locator(".post-card-cover").first()).toHaveCSS("background-size", "cover");
});

test("post page renders readable article content", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");

  await expect(page.getByRole("heading", { name: "第一篇文章：把博客先跑起来" })).toBeVisible();
  await expect(page.locator(".entry-header")).toHaveCSS("background-size", "cover");
  await expect(page.locator(".entry-header .header-title")).toBeHidden();
  await expect(page.locator(".post-cover")).toHaveCount(0);
  await expect(page.getByText("今天先把博客跑起来。")).toBeVisible();
});

test("about page uses its own visual header", async ({ page }) => {
  await page.goto("about.html");

  await expect(page.locator(".entry-header")).toHaveCSS("background-size", "cover");
  await expect(page.locator(".entry-header")).toHaveCSS("background-image", /about-hero\.png/);
  await expect(page.locator(".entry-header .header-title")).toBeHidden();
});

test("search finds the example post", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "搜索文章" }).click();
  await page.getByPlaceholder("搜索标题或摘要").fill("博客");

  await expect(page.locator(".search-result").filter({ hasText: "第一篇文章" })).toBeVisible();
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

test("post page supports math and heading navigation", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");

  await expect(page.locator('script[src*="mathjax"]').first()).toBeAttached();
  await expect(page.locator(".post-toc")).toBeVisible();
  await expect(page.getByRole("heading", { name: "文章目录" })).toBeVisible();
  await expect(page.locator(".post-toc a", { hasText: "写作能力检查" })).toBeVisible();
  await expect(page.locator(".post-toc a", { hasText: "表格示例" })).toBeVisible();

  await expect(page.locator('mjx-container:not([display="true"])').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('mjx-container[display="true"]').first()).toBeVisible({ timeout: 15000 });
});

test("post page renders markdown tables", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table).toContainText("行内公式");
  await expect(table).toContainText("块级公式");
});

test("ML preview post is removed from the site", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("heading", { name: "ML" })).toHaveCount(0);
  await page.goto("2026-05-06/ml.html");
  await expect(page.getByText("页面没有找到。")).toBeVisible();
});
