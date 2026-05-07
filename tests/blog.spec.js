const { test, expect } = require("@playwright/test");

test("home page shows the blog shell and first post", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("link", { name: "Sakura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "第一篇文章：把博客先跑起来" })).toBeVisible();
  await expect(page.locator(".entry-header")).toHaveCSS("background-size", "cover");
  await expect(page.locator(".entry-header")).toHaveCSS("background-image", /home-hero\.png/);
  await expect(page.locator(".entry-header")).toHaveCSS("background-position", "50% 42%");
  await expect.poll(() => page.locator(".entry-header").evaluate((header) => header.getAttribute("style") || "")).toContain("background-position: 50% 42%");
  await expect(page.locator(".entry-header .header-title")).toBeHidden();
  await expect(page.locator(".post-card-cover").first()).toHaveCSS("background-size", "cover");
});

test("theme toggle switches and persists the color mode", async ({ page }) => {
  await page.goto("./");

  const toggle = page.locator("#J_theme_toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-label", "切换深色模式");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-label", "切换浅色模式");
  await expect(page.locator(".header-menu")).toHaveCSS("background-color", "rgb(21, 20, 26)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "切换浅色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
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
  await expect(page.locator("#study")).toContainText("ML");
});

test("post page supports math and heading navigation", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");

  await expect(page.locator('script[src*="mathjax"]').first()).toBeAttached();
  await expect(page.locator(".post-toc")).toBeVisible();
  await expect(page.getByRole("heading", { name: "文章目录" })).toBeVisible();
  await expect(page.locator(".post-toc a", { hasText: "写作能力检查" })).toBeVisible();
  await expect(page.locator(".post-toc a", { hasText: "表格示例" })).toBeVisible();

  await expect(page.locator('mjx-container:not([display="true"])').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('mjx-container[display="true"]')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('mjx-container[display="true"]').first()).toHaveCSS("scrollbar-width", "none");
  await page.locator('mjx-container').first().click({ button: "right" });
  await expect(page.locator("#MathJax_Menu")).toHaveCount(0);
});

test("post formulas expose copy buttons for latex source", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");
  await page.waitForSelector('mjx-container[display="true"]', { timeout: 15000 });

  const copyButtons = page.locator(".math-copy-button");
  await expect(copyButtons).toHaveCount(2);
  await expect(copyButtons.first()).toHaveAttribute("data-latex", /^\$\$[\s\S]*\\sum[\s\S]*\$\$$/);
  await expect(copyButtons.first().locator("svg")).toBeVisible();
  await expect.poll(() => copyButtons.first().evaluate((button) => button.textContent.trim())).toBe("");

  await page.evaluate(() => {
    window.__copiedLatex = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__copiedLatex = value;
        }
      }
    });
  });

  await copyButtons.first().click();
  await expect.poll(() => page.evaluate(() => window.__copiedLatex)).toContain("$$");
  await expect.poll(() => page.evaluate(() => window.__copiedLatex)).toContain("\\sum");
  await expect(copyButtons.first()).toHaveAttribute("data-copied", "true");
});

test("copying article text preserves latex formulas", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");
  await page.waitForSelector(".math-copy-button", { timeout: 15000 });

  const copied = await page.locator("#post-content").evaluate((content) => {
    const range = document.createRange();
    range.selectNodeContents(content);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
      clipboardData: data
    });
    content.dispatchEvent(event);
    return data.getData("text/plain");
  });

  expect(copied).toContain("$n$");
  expect(copied).toContain("$$\nS = \\sum");
  expect(copied).toContain("$$\nE = mc^2\n$$");
});

test("copying a whole-page selection preserves article latex formulas", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");
  await page.waitForSelector(".math-copy-button", { timeout: 15000 });

  const copied = await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.body);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
      clipboardData: data
    });
    document.dispatchEvent(event);
    return data.getData("text/plain");
  });

  expect(copied).toContain("$n$");
  expect(copied).toContain("$$\nS = \\sum");
  expect(copied).toContain("$$\nE = mc^2\n$$");
});

test("post toc highlights the section currently being read", async ({ page, isMobile }) => {
  await page.goto("2026-04-28/hello-blog.html");

  const toc = page.locator(".post-toc");
  await expect(toc).toBeVisible();
  await expect(toc).toHaveCSS("overflow-y", "auto");

  if (isMobile) {
    await expect(page.locator(".post-toc a.is-active").first()).toBeVisible();
    return;
  }

  await page.locator("#表格示例").evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80));
  await expect(page.locator(".post-toc a.is-active", { hasText: "表格示例" })).toBeVisible();
});

test("post toc sits to the left of the article body on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "mobile keeps the toc above the article for narrow screens");

  await page.goto("2026-04-28/hello-blog.html");

  const tocBox = await page.locator(".post-toc").boundingBox();
  const contentBox = await page.locator("#post-content").boundingBox();
  expect(tocBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(tocBox.x).toBeLessThan(contentBox.x);
});

test("post page renders markdown tables", async ({ page }) => {
  await page.goto("2026-04-28/hello-blog.html");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table).toContainText("行内公式");
  await expect(table).toContainText("块级公式");
});

test("ML post remains published in the study section", async ({ page }) => {
  await page.goto("./");

  await expect(page.locator('a.post-card[href$="2026-05-06/ml.html"]').getByRole("heading", { name: "ML" })).toBeVisible();
  await page.goto("2026-05-06/ml.html");
  await expect(page.getByRole("heading", { name: "ML" })).toBeVisible();
});
