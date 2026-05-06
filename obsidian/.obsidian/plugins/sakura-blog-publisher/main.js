const { Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const path = require("path");

const DEFAULT_SETTINGS = {
  blogRoot: "D:\\MyBlog",
  skipTestsForPreview: true
};

module.exports = class SakuraBlogPublisher extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addRibbonIcon("send", "发布当前文章", () => {
      this.publishCurrentFile({ preview: false });
    });

    this.addCommand({
      id: "publish-current-post",
      name: "发布当前文章",
      callback: () => this.publishCurrentFile({ preview: false })
    });

    this.addCommand({
      id: "preview-current-post",
      name: "预览发布当前文章",
      callback: () => this.publishCurrentFile({ preview: true })
    });

    this.addSettingTab(new SakuraPublisherSettingTab(this.app, this));
  }

  async publishCurrentFile({ preview }) {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("请先打开一篇 Markdown 草稿。");
      return;
    }

    const adapter = this.app.vault.adapter;
    const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : "";
    const absoluteDraftPath = path.join(vaultRoot, file.path);
    const relativeDraftPath = path.relative(this.settings.blogRoot, absoluteDraftPath);

    if (relativeDraftPath.startsWith("..")) {
      new Notice("当前文件不在博客目录下，无法发布。");
      return;
    }

    const args = [
      "scripts/obsidian-publish.js",
      "--draft",
      relativeDraftPath
    ];

    if (preview) {
      args.push("--no-commit");
      args.push("--no-push");
      if (this.settings.skipTestsForPreview) args.push("--skip-tests");
    }

    new Notice(preview ? "开始预览发布..." : "开始发布文章...");

    try {
      await this.runNode(args);
      new Notice(preview ? "预览发布完成。" : "文章已发布并推送。");
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
