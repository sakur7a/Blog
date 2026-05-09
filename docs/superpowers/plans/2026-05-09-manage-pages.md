# 独立页面管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Sakura Blog Publisher 插件中新增"管理页面"功能，列出独立页面、打开编辑、创建新页面、一键推送。

**Architecture:** 新增 Node 脚本 `scripts/manage-pages.js` 处理页面扫描/创建/推送逻辑，插件 `main.js` 新增 `ManagePagesModal` 弹窗调用脚本，复用现有 `runNode` 机制。

**Tech Stack:** Node.js (CommonJS), Obsidian Plugin API, child_process spawn

---

### Task 1: 创建 manage-pages.js 脚本

**Files:**
- Create: `scripts/manage-pages.js`

- [ ] **Step 1: 创建 manage-pages.js，实现 list 子命令**

```js
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function splitFrontMatter(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function readYamlValue(yaml, key) {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+?)\\s*$`, "m");
  const match = String(yaml).match(pattern);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function listPages() {
  const excludeDirs = new Set(["_posts", "_layouts", "_includes", "_site", "node_modules", ".git", "obsidian", "scripts", "tests", "docs"]);
  const pages = [];

  for (const fileName of fs.readdirSync(root)) {
    if (!/\.md$/i.test(fileName)) continue;
    const fullPath = path.join(root, fileName);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const content = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "");
    const { yaml } = splitFrontMatter(content);
    const layout = readYamlValue(yaml, "layout");
    if (layout !== "page") continue;

    const title = readYamlValue(yaml, "title") || fileName.replace(/\.md$/i, "");
    pages.push({ title, path: fileName });
  }

  return pages;
}

function createPage(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-page";
  const filePath = path.join(root, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    process.stderr.write(`文件已存在：${filePath}\n`);
    process.exit(1);
  }

  const content = `---\nlayout: page\ntitle: "${title}"\n---\n\n在这里编写内容。\n`;
  fs.writeFileSync(filePath, content, "utf8");
  process.stdout.write(JSON.stringify({ path: slug + ".md", title }));
}

function pushPages() {
  try {
    execSync("git add -A", { cwd: root, stdio: "pipe" });
    execSync('git commit -m "update: 更新独立页面"', { cwd: root, stdio: "pipe" });
    execSync("git push", { cwd: root, stdio: "pipe" });
    process.stdout.write("ok");
  } catch (error) {
    process.stderr.write(error.message || "推送失败");
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const command = args[0];

if (command === "list") {
  process.stdout.write(JSON.stringify(listPages()));
} else if (command === "create") {
  const titleIndex = args.indexOf("--title");
  const title = titleIndex !== -1 ? args[titleIndex + 1] : "";
  if (!title) {
    process.stderr.write("缺少 --title 参数");
    process.exit(1);
  }
  createPage(title);
} else if (command === "push") {
  pushPages();
} else {
  process.stderr.write(`未知命令：${command}\n用法：manage-pages.js <list|create|push>`);
  process.exit(1);
}
```

- [ ] **Step 2: 测试 list 命令**

Run: `node scripts/manage-pages.js list`
Expected: JSON 数组，包含 `about.md` 对应的 `{"title":"About","path":"about.md"}`

- [ ] **Step 3: 测试 create 命令**

Run: `node scripts/manage-pages.js create --title "友链"`
Expected: 创建 `links.md`（或类似的 slug），输出 JSON `{"path":"...","title":"友链"}`

- [ ] **Step 4: 清理测试文件并提交**

```bash
git checkout -- .  # 撤销测试创建的文件（如果有）
git add scripts/manage-pages.js
git commit -m "$(cat <<'EOF'
feat: add manage-pages.js script for page list/create/push

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 在插件 main.js 中新增 ManagePagesModal

**Files:**
- Modify: `obsidian/.obsidian/plugins/sakura-blog-publisher/main.js`

- [ ] **Step 1: 在插件 onload 中新增命令和 ribbon 图标**

在 `this.addSettingTab` 之前插入：

```js
    this.addRibbonIcon("file-text", "管理页面", () => {
      this.openManagePagesModal();
    });

    this.addCommand({
      id: "manage-pages",
      name: "管理页面",
      callback: () => this.openManagePagesModal()
    });
```

- [ ] **Step 2: 在插件类中新增辅助方法**

在 `saveSettings()` 方法之前插入：

```js
  async openManagePagesModal() {
    new ManagePagesModal(this.app, this).open();
  }

  async listPages() {
    const output = await this.runNode(["scripts/manage-pages.js", "list"]);
    return JSON.parse(output || "[]");
  }

  async createPage(title) {
    const output = await this.runNode(["scripts/manage-pages.js", "create", "--title", title]);
    return JSON.parse(output);
  }

  async pushPages() {
    await this.runNode(["scripts/manage-pages.js", "push"]);
  }

  async openPageInObsidian(pagePath) {
    const file = this.app.vault.getAbstractFileByPath(pagePath);
    if (file) {
      await this.app.workspace.openFile(file);
      return;
    }
    new Notice(`无法找到文件：${pagePath}`);
  }
```

- [ ] **Step 3: 新增 CSS 样式**

在 `injectStyles()` 的 CSS 字符串末尾（`sakura-manager-danger` 规则之后）追加：

```css
      .sakura-pages-actions {
        display: flex;
        gap: 8px;
        margin: 12px 0 16px;
      }
```

- [ ] **Step 4: 新增 ManagePagesModal 类**

在 `DeletePostModal` 类之后、`SunaPublisherSettingTab` 类之前插入：

```js
class ManagePagesModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.pages = [];
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();
    contentEl.createEl("h2", { text: "管理页面" });
    contentEl.createEl("p", {
      cls: "sakura-publisher-desc",
      text: "管理博客的独立页面（如 About）。点击打开编辑，修改后可一键推送部署。"
    });

    this.listEl = contentEl.createDiv({ cls: "sakura-manager-list" });
    await this.loadPages();

    const actions = contentEl.createDiv({ cls: "sakura-pages-actions" });

    const createButton = actions.createEl("button", { text: "新建页面" });
    createButton.addEventListener("click", () => this.showCreateDialog());

    const pushButton = actions.createEl("button", { text: "保存并推送" });
    pushButton.addClass("mod-cta");
    pushButton.addEventListener("click", () => this.pushPages());
  }

  async loadPages() {
    if (!this.listEl) return;
    this.listEl.empty();

    try {
      this.pages = await this.plugin.listPages();
      if (!this.pages.length) {
        this.listEl.createEl("p", { text: "没有找到独立页面。" });
        return;
      }
      this.renderPages();
    } catch (error) {
      console.error(error);
      this.listEl.createEl("p", { text: `读取失败：${error.message}` });
    }
  }

  renderPages() {
    this.listEl.empty();
    this.pages.forEach((page) => {
      const item = this.listEl.createDiv({ cls: "sakura-manager-post" });
      item.createEl("h3", { text: page.title });
      const meta = item.createDiv({ cls: "sakura-manager-meta" });
      meta.createSpan({ text: page.path });

      const actions = item.createDiv({ cls: "sakura-manager-actions" });
      const openButton = actions.createEl("button", { text: "打开编辑" });
      openButton.addClass("mod-cta");
      openButton.addEventListener("click", () => {
        this.plugin.openPageInObsidian(page.path);
      });
    });
  }

  showCreateDialog() {
    const modal = new Modal(this.app);
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h2", { text: "新建页面" });

      let title = "";
      new Setting(modal.contentEl)
        .setName("页面标题")
        .addText((text) => {
          text.setPlaceholder("例如：友链").onChange((value) => {
            title = value.trim();
          });
        });

      const actions = modal.contentEl.createDiv({ cls: "sakura-publisher-actions" });
      actions.createEl("button", { text: "取消" }).addEventListener("click", () => modal.close());
      const confirmButton = actions.createEl("button", { text: "创建" });
      confirmButton.addClass("mod-cta");
      confirmButton.addEventListener("click", async () => {
        if (!title) {
          new Notice("请输入页面标题。");
          return;
        }
        modal.close();
        try {
          const result = await this.plugin.createPage(title);
          new Notice(`页面已创建：${result.path}`);
          await this.plugin.openPageInObsidian(result.path);
          await this.loadPages();
        } catch (error) {
          console.error(error);
          new Notice(`创建失败：${error.message}`);
        }
      });
    };
    modal.open();
  }

  async pushPages() {
    new Notice("开始推送页面...");
    try {
      await this.plugin.pushPages();
      new Notice("页面已推送部署。");
    } catch (error) {
      console.error(error);
      new Notice(`推送失败：${error.message}`);
    }
  }
}
```

- [ ] **Step 5: 手动验证**

在 Obsidian 中：
1. 点击 ribbon 的"管理页面"图标，弹窗应显示 About 页面
2. 点击"打开编辑"，应打开 about.md
3. 点击"新建页面"，输入标题，应创建新 .md 文件并打开
4. 点击"保存并推送"，应执行 git push

- [ ] **Step 6: 提交**

```bash
git add obsidian/.obsidian/plugins/sakura-blog-publisher/main.js
git commit -m "$(cat <<'EOF'
feat: add manage pages modal to Obsidian plugin

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```
