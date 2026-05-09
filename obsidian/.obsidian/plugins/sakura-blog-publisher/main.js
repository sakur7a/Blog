const { Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
let electronShell = null;
try {
  electronShell = require("electron").shell;
} catch (error) {
  electronShell = null;
}

const DEFAULT_SETTINGS = {
  blogRoot: "D:\\MyBlog",
  skipTestsForPreview: true
};

const CATEGORIES = ["随笔", "学习"];

function splitFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function readYamlValue(yaml, key) {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m");
  const match = yaml.match(pattern);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function writeYamlValue(yaml, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.+?$`, "m");
  if (pattern.test(yaml)) return yaml.replace(pattern, line);
  return yaml.trim() ? `${yaml.trimEnd()}\n${line}` : line;
}

function quoteYaml(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function firstSummary(body) {
  const plain = body
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`\[\]-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!plain) return "";
  return plain.length > 80 ? plain.slice(0, 80) : plain;
}

function fileTitle(filePath) {
  const name = String(filePath || "新文章.md").split(/[\\/]/).pop().replace(/\.md$/i, "");
  return name || "新文章";
}

function extractMetadata(content, filePath) {
  const { yaml, body } = splitFrontMatter(content);
  const title = readYamlValue(yaml, "title") || fileTitle(filePath);
  const summary = readYamlValue(yaml, "summary") || firstSummary(body);
  const categories = readYamlValue(yaml, "categories") || "[随笔]";
  const categoryMatch = categories.match(/[\[\s,]([^,\]\s]+)[,\]\s]?/);
  const category = categoryMatch ? categoryMatch[1] : "随笔";
  const coverPosition = readYamlValue(yaml, "cover_position") || "50% 50%";
  return { title, summary, category, coverPosition };
}

function applyMetadata(content, metadata) {
  const { yaml, body } = splitFrontMatter(content);
  let nextYaml = yaml;
  nextYaml = writeYamlValue(nextYaml, "title", quoteYaml(metadata.title));
  nextYaml = writeYamlValue(nextYaml, "categories", `[${metadata.category}]`);
  nextYaml = writeYamlValue(nextYaml, "summary", quoteYaml(metadata.summary));
  if (metadata.coverPosition) {
    nextYaml = writeYamlValue(nextYaml, "cover_position", quoteYaml(metadata.coverPosition));
  }
  return `---\n${nextYaml.trim()}\n---\n\n${body.trimStart()}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCoverPosition(value) {
  const parts = String(value || "").match(/-?\d+(?:\.\d+)?/g) || [];
  return {
    x: clampPercent(Number(parts[0] ?? 50)),
    y: clampPercent(Number(parts[1] ?? 50))
  };
}

function formatCoverPosition(x, y) {
  return `${clampPercent(Number(x))}% ${clampPercent(Number(y))}%`;
}

function pathToFileUrl(filePath) {
  if (!filePath) return "";
  return `file:///${String(filePath).replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

function safeFileName(fileName) {
  const extension = path.extname(fileName || "cover.png").toLowerCase() || ".png";
  const baseName = path.basename(fileName || "cover", extension).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${baseName || "cover"}-${Date.now()}${extension}`;
}

async function stageCoverFile(file, blogRoot) {
  const uploadDir = path.join(blogRoot, ".obsidian-cover-upload");
  fs.mkdirSync(uploadDir, { recursive: true });

  const targetPath = path.join(uploadDir, safeFileName(file.name));
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(targetPath, bytes);
  return targetPath;
}

module.exports = class SakuraBlogPublisher extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.injectStyles();

    this.addRibbonIcon("send", "发布当前文章", () => {
      this.openPublishModal();
    });
    this.addRibbonIcon("list", "管理文章", () => {
      this.openManageModal();
    });

    this.addCommand({
      id: "publish-current-post",
      name: "发布当前文章",
      callback: () => this.openPublishModal()
    });

    this.addCommand({
      id: "preview-current-post",
      name: "预览发布当前文章",
      callback: () => this.openPublishModal({ previewFirst: true })
    });

    this.addCommand({
      id: "cleanup-last-preview",
      name: "清理上次预览",
      callback: () => this.cleanupLastPreview()
    });

    this.addCommand({
      id: "manage-posts",
      name: "管理文章",
      callback: () => this.openManageModal()
    });

    this.addRibbonIcon("file-text", "管理页面", () => {
      this.openManagePagesModal();
    });

    this.addCommand({
      id: "manage-pages",
      name: "管理页面",
      callback: () => this.openManagePagesModal()
    });

    this.addSettingTab(new SakuraPublisherSettingTab(this.app, this));
  }

  async openPublishModal(options = {}) {
    const draft = await this.getActiveDraft();
    if (!draft) return;

    new PublishPostModal(this.app, this, draft, options).open();
  }

  async getActiveDraft() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("请先打开一篇 Markdown 草稿。");
      return null;
    }

    const adapter = this.app.vault.adapter;
    const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : "";
    const absoluteDraftPath = path.join(vaultRoot, file.path);
    const relativeDraftPath = path.relative(this.settings.blogRoot, absoluteDraftPath);
    const isInsideBlog = !relativeDraftPath.startsWith("..") && !path.isAbsolute(relativeDraftPath);
    const publishPath = isInsideBlog ? relativeDraftPath : absoluteDraftPath;
    const displayPath = isInsideBlog ? relativeDraftPath : file.path;

    const content = await this.app.vault.read(file);
    return {
      file,
      content,
      absoluteDraftPath,
      displayPath,
      publishPath,
      relativeDraftPath,
      metadata: extractMetadata(content, file.path)
    };
  }

  async publishDraft(draft, metadata, { preview }) {
    await this.app.vault.modify(draft.file, applyMetadata(draft.content, metadata));

    const args = [
      "scripts/obsidian-publish.js",
      "--draft",
      draft.publishPath
    ];

    if (metadata.coverPath) {
      args.push("--cover");
      args.push(metadata.coverPath);
      args.push("--cover-position");
      args.push(metadata.coverPosition || "50% 50%");
    }

    if (preview) {
      args.push("--no-commit");
      args.push("--no-push");
      if (this.settings.skipTestsForPreview) args.push("--skip-tests");
    }

    new Notice(preview ? "开始生成预览..." : "开始发布并推送...");

    try {
      await this.runNode(args);
      new Notice(preview ? "预览已生成，可用清理上次预览撤回。" : "文章已发布并推送。");
    } catch (error) {
      console.error(error);
      new Notice(`发布失败：${error.message}`);
    }
  }

  async cleanupLastPreview() {
    new Notice("开始清理上次预览...");

    try {
      await this.runNode(["scripts/cleanup-obsidian-preview.js"]);
      new Notice("上次预览已清理。");
    } catch (error) {
      console.error(error);
      new Notice(`清理失败：${error.message}`);
    }
  }

  async openManageModal() {
    new ManagePostsModal(this.app, this).open();
  }

  async listPublishedPosts() {
    const output = await this.runNode(["scripts/list-posts.js"]);
    return JSON.parse(output || "[]");
  }

  async copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  async openManagedPost(post) {
    const target = post.sourcePath || post.postPath;
    if (!target) {
      new Notice("没有可打开的文章路径。");
      return;
    }
    const fullPath = path.join(this.settings.blogRoot, target);
    if (electronShell && electronShell.openPath) {
      await electronShell.openPath(fullPath);
      return;
    }
    new Notice(`文章路径：${fullPath}`);
  }

  async republishManagedPost(post) {
    if (!post.sourcePath) {
      new Notice("没有找到发布源稿，无法一键重新发布。");
      return;
    }
    new Notice(`开始重新发布：${post.title}`);
    try {
      await this.runNode([
        "scripts/obsidian-publish.js",
        "--draft",
        post.sourcePath,
        "--date",
        post.dateValue || post.date,
        "--slug",
        post.slug
      ]);
      new Notice("文章已重新发布并推送。");
    } catch (error) {
      console.error(error);
      new Notice(`重新发布失败：${error.message}`);
    }
  }

  async replaceCoverForPost(post, coverPath) {
    new Notice(`开始更换封面：${post.title}`);
    try {
      await this.runNode([
        "scripts/replace-cover.js",
        "--post",
        post.postPath,
        "--cover",
        coverPath,
        "--skip-tests"
      ]);
      new Notice("封面已更换并推送。");
    } catch (error) {
      console.error(error);
      new Notice(`更换封面失败：${error.message}`);
    }
  }

  async deleteManagedPost(post, { deleteAssets }) {
    new Notice(`开始删除：${post.title}`);
    try {
      await this.runNode([
        "scripts/manage-post.js",
        "delete",
        "--post",
        post.postPath,
        "--skip-tests",
        ...(deleteAssets ? ["--assets"] : [])
      ]);
      new Notice("文章已删除并推送。");
    } catch (error) {
      console.error(error);
      new Notice(`删除失败：${error.message}`);
    }
  }

  runNode(args) {
    return new Promise((resolve, reject) => {
      const child = spawn("node", args, {
        cwd: this.settings.blogRoot,
        shell: false,
        windowsHide: true
      });

      let output = "";
      child.stdout.on("data", (data) => {
        output += data.toString();
        console.log(data.toString());
      });
      child.stderr.on("data", (data) => {
        output += data.toString();
        console.error(data.toString());
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(output.trim() || `命令退出码：${code}`));
        }
      });
    });
  }

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
    return (await this.runNode(["scripts/manage-pages.js", "push"])).trim();
  }

  async setPageHeaderImage(pagePath, imageUrl) {
    await this.runNode(["scripts/manage-pages.js", "set-header-image", "--page", pagePath, "--image", imageUrl]);
  }

  async openPageFile(pagePath) {
    const fullPath = path.join(this.settings.blogRoot, pagePath);
    if (electronShell && electronShell.openPath) {
      await electronShell.openPath(fullPath);
      return;
    }
    new Notice(`页面路径：${fullPath}`);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  injectStyles() {
    this.styleEl = document.createElement("style");
    this.styleEl.textContent = `
      .sakura-publisher-cover-input {
        max-width: 260px;
      }
      .sakura-publisher-cover-preview {
        position: relative;
        height: 190px;
        margin: 12px 0 14px;
        overflow: hidden;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background-color: var(--background-secondary);
        background-repeat: no-repeat;
        background-size: cover;
        color: rgba(255, 255, 255, 0.92);
        cursor: crosshair;
        display: grid;
        place-items: center;
        font-size: 13px;
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
        user-select: none;
      }
      .sakura-publisher-cover-preview::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 33.33% 0 / 1px 100% no-repeat,
          linear-gradient(rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 66.66% 0 / 1px 100% no-repeat,
          linear-gradient(90deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 0 33.33% / 100% 1px no-repeat,
          linear-gradient(90deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 0 66.66% / 100% 1px no-repeat;
        pointer-events: none;
      }
      .sakura-publisher-cover-frame {
        position: absolute;
        inset: 10px;
        border: 2px solid rgba(255, 255, 255, 0.88);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.22), 0 0 0 999px rgba(0, 0, 0, 0.08);
        pointer-events: none;
      }
      .sakura-publisher-cover-marker {
        position: absolute;
        width: 18px;
        height: 18px;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.36);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      .sakura-publisher-cover-controls {
        display: grid;
        gap: 10px;
        margin: 8px 0 14px;
      }
      .sakura-publisher-cover-control {
        display: grid;
        grid-template-columns: 72px minmax(120px, 1fr) 42px;
        align-items: center;
        gap: 10px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .sakura-publisher-cover-range {
        width: 100%;
      }
      .sakura-publisher-cover-value {
        color: var(--text-normal);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .sakura-manager-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 12px 0 16px;
      }
      .sakura-manager-list {
        display: grid;
        gap: 10px;
        max-height: min(62vh, 620px);
        overflow: auto;
        padding-right: 4px;
      }
      .sakura-manager-post {
        padding: 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-secondary);
      }
      .sakura-manager-post h3 {
        margin: 0 0 6px;
        font-size: 16px;
      }
      .sakura-manager-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .sakura-manager-summary {
        margin: 8px 0 0;
        color: var(--text-muted);
        font-size: 13px;
      }
      .sakura-manager-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .sakura-manager-danger {
        color: var(--text-error);
      }
      .sakura-pages-actions {
        display: flex;
        gap: 8px;
        margin: 12px 0 16px;
      }
    `;
    document.head.appendChild(this.styleEl);
    this.register(() => this.styleEl.remove());
  }
};

class PublishPostModal extends Modal {
  constructor(app, plugin, draft, options) {
    super(app);
    this.plugin = plugin;
    this.draft = draft;
    this.options = options;
    this.metadata = {
      title: draft.metadata.title || "",
      summary: draft.metadata.summary || "",
      category: CATEGORIES.includes(draft.metadata.category) ? draft.metadata.category : "随笔",
      coverPath: "",
      coverPosition: draft.metadata.coverPosition || "50% 50%"
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();

    contentEl.createEl("h2", { text: "发布到 Sakura Blog" });
    contentEl.createEl("p", {
      cls: "sakura-publisher-desc",
      text: "发布前确认标题、简介和归档板块。预览不会提交或推送，正式发布会走完整构建并推送到 GitHub。"
    });

    new Setting(contentEl)
      .setName("标题")
      .setDesc("会写入文章 front matter，并显示在首页、归档和搜索结果。")
      .addText((text) => {
        text
          .setPlaceholder("文章标题")
          .setValue(this.metadata.title)
          .onChange((value) => {
            this.metadata.title = value.trim();
            this.renderPreview();
          });
        text.inputEl.addClass("sakura-publisher-title-input");
      });

    new Setting(contentEl)
      .setName("板块")
      .setDesc("目前博客 Archive 分为随笔和学习。")
      .addDropdown((dropdown) => {
        CATEGORIES.forEach((category) => dropdown.addOption(category, category));
        dropdown
          .setValue(this.metadata.category)
          .onChange((value) => {
            this.metadata.category = value;
            this.renderPreview();
          });
      });

    new Setting(contentEl)
      .setName("简介")
      .setDesc("一句话摘要，会显示在列表、搜索和文章元信息里。")
      .addTextArea((text) => {
        text
          .setPlaceholder("用一两句话概括这篇文章。")
          .setValue(this.metadata.summary)
          .onChange((value) => {
            this.metadata.summary = value.trim();
            this.renderPreview();
          });
        text.inputEl.addClass("sakura-publisher-summary-input");
      });

    const coverSetting = new Setting(contentEl)
      .setName("选择封面图")
      .setDesc("选择后可在下方调整封面显示区域；原图不会被压缩或拉伸。");
    const coverInput = coverSetting.controlEl.createEl("input", {
      attr: {
        type: "file",
        accept: "image/png,image/jpeg,image/webp,image/gif"
      }
    });
    coverInput.addClass("sakura-publisher-cover-input");
    coverInput.addEventListener("change", async () => {
      const file = coverInput.files && coverInput.files[0];
      if (!file) return;

      try {
        this.metadata.coverPath = await stageCoverFile(file, this.plugin.settings.blogRoot);
        this.metadata.coverName = file.name || path.basename(this.metadata.coverPath);
        if (this.metadata.coverPreviewUrl) {
          URL.revokeObjectURL(this.metadata.coverPreviewUrl);
        }
        this.metadata.coverPreviewUrl = URL.createObjectURL(file);
        this.renderPreview();
      } catch (error) {
        console.error(error);
        new Notice(`无法读取封面图：${error.message}`);
      }
    });

    this.previewEl = contentEl.createDiv({ cls: "sakura-publisher-preview" });
    this.renderPreview();

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    const previewButton = actions.createEl("button", {
      cls: "mod-cta",
      text: this.options.previewFirst ? "生成预览" : "预览"
    });
    previewButton.addEventListener("click", () => this.submit({ preview: true }));

    const cleanupButton = actions.createEl("button", {
      text: "清理上次预览"
    });
    cleanupButton.addEventListener("click", () => this.cleanup());

    const publishButton = actions.createEl("button", {
      text: "发布并推送"
    });
    publishButton.addClass("sakura-publisher-primary");
    publishButton.addEventListener("click", () => this.submit({ preview: false }));
  }

  renderPreview() {
    if (!this.previewEl) return;

    this.previewEl.empty();
    this.previewEl.createDiv({ cls: "sakura-publisher-preview-label", text: "发布预览" });
    this.previewEl.createEl("h3", { text: this.metadata.title || "未填写标题" });

    if (this.metadata.coverPath) {
      const cover = this.previewEl.createDiv({
        cls: "sakura-publisher-cover-preview",
        attr: {
          "aria-label": "调整封面显示区域"
        }
      });
      cover.setText("拖动图片，调整横幅裁切区域");
      cover.style.backgroundImage = `url("${this.metadata.coverPreviewUrl || pathToFileUrl(this.metadata.coverPath)}")`;
      const initialPosition = parseCoverPosition(this.metadata.coverPosition);
      this.metadata.coverPosition = formatCoverPosition(initialPosition.x, initialPosition.y);
      cover.style.backgroundPosition = this.metadata.coverPosition;

      cover.createDiv({ cls: "sakura-publisher-cover-frame" });
      const marker = cover.createDiv({ cls: "sakura-publisher-cover-marker" });
      const controls = this.previewEl.createDiv({ cls: "sakura-publisher-cover-controls" });
      const xInput = this.createCoverRangeControl(controls, "横向焦点", initialPosition.x);
      const yInput = this.createCoverRangeControl(controls, "纵向焦点", initialPosition.y);
      const updateMarker = () => {
        const position = parseCoverPosition(this.metadata.coverPosition);
        marker.style.left = `${position.x}%`;
        marker.style.top = `${position.y}%`;
        xInput.input.value = String(position.x);
        yInput.input.value = String(position.y);
        xInput.valueEl.setText(`${position.x}%`);
        yInput.valueEl.setText(`${position.y}%`);
      };

      const setCoverPosition = (x, y) => {
        this.metadata.coverPosition = formatCoverPosition(x, y);
        cover.style.backgroundPosition = this.metadata.coverPosition;
        updateMarker();
      };

      xInput.input.addEventListener("input", () => {
        const position = parseCoverPosition(this.metadata.coverPosition);
        setCoverPosition(xInput.input.value, position.y);
      });
      yInput.input.addEventListener("input", () => {
        const position = parseCoverPosition(this.metadata.coverPosition);
        setCoverPosition(position.x, yInput.input.value);
      });

      const updatePosition = (event) => {
        const rect = cover.getBoundingClientRect();
        const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
        const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
        setCoverPosition(x, y);
      };

      cover.addEventListener("pointerdown", (event) => {
        updatePosition(event);
        cover.setPointerCapture(event.pointerId);
      });
      cover.addEventListener("pointermove", (event) => {
        if (event.buttons === 1) updatePosition(event);
      });
      updateMarker();
    }

    const meta = this.previewEl.createDiv({ cls: "sakura-publisher-preview-meta" });
    meta.createSpan({ text: this.metadata.category || "随笔" });
    meta.createSpan({ text: this.draft.displayPath });
    if (this.metadata.coverName) {
      meta.createSpan({ text: `封面：${this.metadata.coverName}` });
    }

    this.previewEl.createEl("p", {
      text: this.metadata.summary || "还没有简介，建议补上一句方便首页和搜索展示。"
    });
  }

  createCoverRangeControl(parent, label, value) {
    const row = parent.createDiv({ cls: "sakura-publisher-cover-control" });
    row.createSpan({ text: label });
    const input = row.createEl("input", {
      cls: "sakura-publisher-cover-range",
      attr: {
        type: "range",
        min: "0",
        max: "100",
        step: "1",
        value: String(clampPercent(value))
      }
    });
    const valueEl = row.createSpan({
      cls: "sakura-publisher-cover-value",
      text: `${clampPercent(value)}%`
    });
    return { input, valueEl };
  }

  async submit({ preview }) {
    if (!this.metadata.title) {
      new Notice("请先填写标题。");
      return;
    }

    if (!this.metadata.summary) {
      new Notice("请先填写简介。");
      return;
    }

    this.close();
    await this.plugin.publishDraft(this.draft, this.metadata, { preview });
  }

  async cleanup() {
    this.close();
    await this.plugin.cleanupLastPreview();
  }
}

class ManagePostsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.posts = [];
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();
    contentEl.createEl("h2", { text: "管理文章" });
    contentEl.createEl("p", {
      cls: "sakura-publisher-desc",
      text: "统一查看已发布文章。删除会修改本地博客并提交推送，操作前会再次确认。"
    });

    const toolbar = contentEl.createDiv({ cls: "sakura-manager-toolbar" });
    this.statusEl = toolbar.createSpan({ text: "正在读取文章..." });
    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => this.loadPosts());

    this.listEl = contentEl.createDiv({ cls: "sakura-manager-list" });
    await this.loadPosts();
  }

  async loadPosts() {
    if (!this.listEl || !this.statusEl) return;
    this.listEl.empty();
    this.statusEl.setText("正在读取文章...");

    try {
      this.posts = await this.plugin.listPublishedPosts();
      this.statusEl.setText(`共 ${this.posts.length} 篇文章`);
      this.renderPosts();
    } catch (error) {
      console.error(error);
      this.statusEl.setText("读取失败");
      this.listEl.createEl("p", { text: error.message || "无法读取文章列表。" });
    }
  }

  renderPosts() {
    this.listEl.empty();
    if (!this.posts.length) {
      this.listEl.createEl("p", { text: "还没有已发布文章。" });
      return;
    }

    this.posts.forEach((post) => {
      const item = this.listEl.createDiv({ cls: "sakura-manager-post" });
      item.createEl("h3", { text: post.title || post.postPath });
      const meta = item.createDiv({ cls: "sakura-manager-meta" });
      meta.createSpan({ text: post.date || "无日期" });
      meta.createSpan({ text: post.category || "随笔" });
      meta.createSpan({ text: post.postPath });
      if (post.sourcePath) meta.createSpan({ text: `源稿：${post.sourcePath}` });
      if (post.cover) meta.createSpan({ text: `封面：${post.cover.split("/").pop()}` });
      if (post.summary) {
        item.createEl("p", { cls: "sakura-manager-summary", text: post.summary });
      }

      const actions = item.createDiv({ cls: "sakura-manager-actions" });
      const openButton = actions.createEl("button", { text: "打开源稿" });
      openButton.addEventListener("click", () => this.plugin.openManagedPost(post));

      const copyButton = actions.createEl("button", { text: "复制链接" });
      copyButton.addEventListener("click", async () => {
        await this.plugin.copyText(post.url || post.relativeUrl || "");
        new Notice("链接已复制。");
      });

      const republishButton = actions.createEl("button", { text: "重新发布" });
      republishButton.disabled = !post.sourcePath;
      republishButton.addEventListener("click", async () => {
        await this.plugin.republishManagedPost(post);
        await this.loadPosts();
      });

      const coverButton = actions.createEl("button", { text: "更换封面" });
      coverButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp,image/gif";
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const stagedPath = await stageCoverFile(file, this.plugin.settings.blogRoot);
            await this.plugin.replaceCoverForPost(post, stagedPath);
            await this.loadPosts();
          } catch (error) {
            console.error(error);
            new Notice(`更换封面失败：${error.message}`);
          }
        });
        input.click();
      });

      const deleteButton = actions.createEl("button", { text: "删除文章" });
      deleteButton.addClass("sakura-manager-danger");
      deleteButton.addEventListener("click", () => new DeletePostModal(this.app, this.plugin, post, this).open());
    });
  }
}

class DeletePostModal extends Modal {
  constructor(app, plugin, post, manager) {
    super(app);
    this.plugin = plugin;
    this.post = post;
    this.manager = manager;
    this.deleteAssets = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();
    contentEl.createEl("h2", { text: "确认删除文章" });
    contentEl.createEl("p", { text: `即将删除：${this.post.title}` });
    contentEl.createEl("p", { text: this.post.postPath });

    new Setting(contentEl)
      .setName("同时删除图片资源")
      .setDesc(this.post.assetPath || "这会删除文章对应的 assets/images/posts 目录。")
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.deleteAssets = value;
        });
      });

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
    const confirmButton = actions.createEl("button", { text: "确认删除并推送" });
    confirmButton.addClass("sakura-manager-danger");
    confirmButton.addEventListener("click", async () => {
      this.close();
      await this.plugin.deleteManagedPost(this.post, { deleteAssets: this.deleteAssets });
      if (this.manager) await this.manager.loadPosts();
    });
  }
}

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
      if (page.headerImage) {
        meta.createSpan({ text: `头部图片：${page.headerImage}` });
      }

      const actions = item.createDiv({ cls: "sakura-manager-actions" });
      const openButton = actions.createEl("button", { text: "打开编辑" });
      openButton.addClass("mod-cta");
      openButton.addEventListener("click", () => {
        this.plugin.openPageFile(page.path);
      });

      const headerButton = actions.createEl("button", { text: "设置头部图片" });
      headerButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp,image/gif";
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const imageUrl = await this.stageHeaderImage(file, page.path);
            await this.plugin.setPageHeaderImage(page.path, imageUrl);
            new Notice(`头部图片已设置：${imageUrl}`);
            await this.loadPages();
          } catch (error) {
            console.error(error);
            new Notice(`设置失败：${error.message}`);
          }
        });
        input.click();
      });
    });
  }

  async stageHeaderImage(file, pagePath) {
    const blogRoot = this.plugin.settings.blogRoot;
    const ext = path.extname(file.name || ".png").toLowerCase() || ".png";
    const baseName = path.basename(file.name || "header", ext).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
    const safeName = `${baseName || "header"}-${Date.now()}${ext}`;
    const targetDir = path.join(blogRoot, "assets", "images", "site");
    fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, safeName);
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(targetPath, bytes);
    return `/assets/images/site/${safeName}`;
  }

  showCreateDialog() {
    const modal = new Modal(this.app);
    let title = "";
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h2", { text: "新建页面" });

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
          await this.plugin.openPageFile(result.path);
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
      const result = await this.plugin.pushPages();
      if (result === "no-changes") {
        new Notice("没有需要推送的改动。");
      } else {
        new Notice("页面已推送部署。");
      }
    } catch (error) {
      console.error(error);
      new Notice(`推送失败：${error.message}`);
    }
  }
}

class SakuraPublisherSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Sakura Blog Publisher" });

    new Setting(containerEl)
      .setName("博客根目录")
      .setDesc("包含 package.json 和 scripts/obsidian-publish.js 的目录。")
      .addText((text) =>
        text
          .setPlaceholder("D:\\MyBlog")
          .setValue(this.plugin.settings.blogRoot)
          .onChange(async (value) => {
            this.plugin.settings.blogRoot = value.trim() || DEFAULT_SETTINGS.blogRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("预览发布跳过测试")
      .setDesc("预览命令只生成文章并构建，速度更快；正式发布仍会跑完整脚本。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.skipTestsForPreview)
          .onChange(async (value) => {
            this.plugin.settings.skipTestsForPreview = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
