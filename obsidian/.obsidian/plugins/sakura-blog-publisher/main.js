const { Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const path = require("path");
const { applyMetadata, extractMetadata } = require("./metadata");

const DEFAULT_SETTINGS = {
  blogRoot: "D:\\MyBlog",
  skipTestsForPreview: true
};

const CATEGORIES = ["随笔", "学习"];

module.exports = class SakuraBlogPublisher extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

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

    if (relativeDraftPath.startsWith("..") || path.isAbsolute(relativeDraftPath)) {
      new Notice("当前文件不在博客目录下，无法发布。");
      return null;
    }

    const content = await this.app.vault.read(file);
    return {
      file,
      content,
      absoluteDraftPath,
      relativeDraftPath,
      metadata: extractMetadata(content, file.path)
    };
  }

  async publishDraft(draft, metadata, { preview }) {
    await this.app.vault.modify(draft.file, applyMetadata(draft.content, metadata));

    const args = [
      "scripts/obsidian-publish.js",
      "--draft",
      draft.relativeDraftPath
    ];

    if (preview) {
      args.push("--no-commit");
      args.push("--no-push");
      if (this.settings.skipTestsForPreview) args.push("--skip-tests");
    }

    new Notice(preview ? "开始生成预览..." : "开始发布并推送...");

    try {
      await this.runNode(args);
      new Notice(preview ? "预览已生成，可回到博客页面刷新查看。" : "文章已发布并推送。");
    } catch (error) {
      console.error(error);
      new Notice(`发布失败：${error.message}`);
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
      category: CATEGORIES.includes(draft.metadata.category) ? draft.metadata.category : "随笔"
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

    this.previewEl = contentEl.createDiv({ cls: "sakura-publisher-preview" });
    this.renderPreview();

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    const previewButton = actions.createEl("button", {
      cls: "mod-cta",
      text: this.options.previewFirst ? "生成预览" : "预览"
    });
    previewButton.addEventListener("click", () => this.submit({ preview: true }));

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

    const meta = this.previewEl.createDiv({ cls: "sakura-publisher-preview-meta" });
    meta.createSpan({ text: this.metadata.category || "随笔" });
    meta.createSpan({ text: this.draft.relativeDraftPath });

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
