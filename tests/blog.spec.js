const { test, expect } = require("@playwright/test");

const ML_POST = "2026-05-07/ml.html";

test("home page shows the current blog shell and posts", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("link", { name: "Sakura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "随便写写" })).toBeVisible();
  await expect(page.locator('.header-href[href$="2026-07-16/freely.html"]')).toBeVisible();
  await expect(page.locator(".entry-header")).toHaveCSS("background-size", "cover");
  await expect(page.locator(".entry-header")).toHaveCSS("background-image", /home-hero\.png/);
  await expect(page.locator(".entry-header")).toHaveCSS("background-position", "50% 10%");
});

test("theme toggle switches and persists the color mode", async ({ page }) => {
  await page.goto("./");

  const toggle = page.locator("#J_theme_toggle");
  await expect(toggle).toHaveAttribute("aria-label", "切换深色模式");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-label", "切换浅色模式");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "切换浅色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("a current post renders its cover and article content", async ({ page }) => {
  await page.goto("2026-07-16/freely.html");

  await expect(page.getByRole("heading", { name: "随便写写" })).toBeVisible();
  await expect(page.locator(".post-cover")).toHaveCSS("background-image", /2026-07-16-freely\/cover\.webp/);
  await expect(page.getByText("刚考完期末考，有点心烦，来审判下自己吧。图片是文山湖。")).toBeVisible();
  await expect(page.locator('#post-content img[src*="791350730a0e9bb6beac365f247886df.webp"]')).toBeVisible();
});

test("about page uses its configured visual header", async ({ page }) => {
  await page.goto("about.html");

  await expect(page.locator(".entry-header")).toHaveCSS("background-size", "cover");
  await expect(page.locator(".entry-header")).toHaveCSS("background-image", /wallhaven-k8kdqm-1778501257207\.png/);
  await expect(page.locator(".entry-header")).toHaveCSS("background-position", "50% 10%");
});

test("search finds a current post", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "搜索文章" }).click();
  await page.getByPlaceholder("搜索标题或摘要").fill("图层分解");

  await expect(page.locator(".search-result").filter({ hasText: "图层分解" })).toBeVisible();
});

test("archive groups current posts by writing categories", async ({ page }) => {
  await page.goto("archive.html");

  await expect(page.locator("#essays")).toContainText("随便写写");
  await expect(page.locator("#study")).toContainText("ML");
  await expect(page.locator("#study")).toContainText("图层分解");
});

test("ML post supports math and heading navigation", async ({ page }) => {
  await page.goto(ML_POST);

  await expect(page.locator('script[src*="mathjax"]').first()).toBeAttached();
  await expect(page.locator(".post-toc")).toBeAttached();
  await expect(page.locator("#post-toc-title")).toBeAttached();
  await expect(page.locator(".post-toc a", { hasText: "PCA 的核心目的" })).toBeAttached();
  await expect(page.locator('mjx-container[display="true"]').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('mjx-container:not([display="true"])').first()).toBeVisible({ timeout: 15000 });
});

test("post formulas expose copy buttons for latex source", async ({ page }) => {
  await page.goto(ML_POST);
  await page.waitForSelector(".math-copy-button", { timeout: 15000 });

  const copyButtons = page.locator(".math-copy-button");
  expect(await copyButtons.count()).toBeGreaterThan(10);
  await expect(copyButtons.first()).toHaveAttribute("data-latex", /^\$\$[\s\S]+\$\$$/);

  await page.evaluate(() => {
    window.__copiedLatex = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__copiedLatex = value; } }
    });
  });
  await copyButtons.first().click();
  await expect.poll(() => page.evaluate(() => window.__copiedLatex)).toContain("$$");
});

test("post toc highlights the section currently being read", async ({ page, isMobile }) => {
  await page.goto(ML_POST);
  const toc = page.locator(".post-toc");
  await expect(toc).toBeAttached();

  if (isMobile) {
    await expect(page.locator(".post-toc a.is-active").first()).toBeAttached();
    return;
  }

  const section = page.getByRole("heading", { name: "2.1 总体知识结构" });
  await section.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80));
  await expect(page.locator(".post-toc a.is-active", { hasText: "2.1 总体知识结构" })).toBeAttached();
});

test("post toc sits to the right of the article body on wide screens", async ({ page, isMobile }) => {
  test.skip(isMobile, "mobile keeps the toc above the article for narrow screens");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(ML_POST);

  const tocBox = await page.locator(".post-toc").boundingBox();
  const contentBox = await page.locator("#post-content").boundingBox();
  expect(tocBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(tocBox.x).toBeGreaterThan(contentBox.x);
});

test("ML post renders markdown tables", async ({ page }) => {
  await page.goto(ML_POST);

  const table = page.getByRole("table").first();
  await expect(table).toBeVisible();
  await expect(table).toContainText("是否用类别标签");
  await expect(table).toContainText("PCA / Eigenfaces");
});
