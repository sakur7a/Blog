const { Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const path = require("path");

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
  return { title, summary, category };
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

function pathToFileUrl(filePath) {
  if (!filePath) return "";
  return `file:///${String(filePath).replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

module.exports = class SakuraBlogPublisher extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.injectStyles();

    this.addRibbonIcon("send", "发布当前文章", () => {
      this.openPublishModal();
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
      coverPosition: "50% 50%"
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
    coverInput.addEventListener("change", () => {
      const file = coverInput.files && coverInput.files[0];
      if (!file) return;

      this.metadata.coverPath = file.path || "";
      this.metadata.coverName = file.name || path.basename(this.metadata.coverPath);
      if (!this.metadata.coverPath) {
        new Notice("没有读到封面图路径，请在桌面版 Obsidian 中选择本地图片。");
        return;
      }
      this.renderPreview();
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
      cover.setText("拖动或点击，调整封面显示区域");
      cover.style.backgroundImage = `url("${pathToFileUrl(this.metadata.coverPath)}")`;
      cover.style.backgroundPosition = this.metadata.coverPosition;

      const marker = cover.createDiv({ cls: "sakura-publisher-cover-marker" });
      const updateMarker = () => {
        const [x = "50%", y = "50%"] = this.metadata.coverPosition.split(/\s+/);
        marker.style.left = x;
        marker.style.top = y;
      };
      updateMarker();

      const updatePosition = (event) => {
        const rect = cover.getBoundingClientRect();
        const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
        const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
        this.metadata.coverPosition = `${x}% ${y}%`;
        cover.style.backgroundPosition = this.metadata.coverPosition;
        updateMarker();
      };

      cover.addEventListener("pointerdown", (event) => {
        updatePosition(event);
        cover.setPointerCapture(event.pointerId);
      });
      cover.addEventListener("pointermove", (event) => {
        if (event.buttons === 1) updatePosition(event);
      });
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
