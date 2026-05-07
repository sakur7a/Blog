# Obsidian 写作工作流

这个目录可以作为 Obsidian vault 打开。推荐结构：

- `Drafts/`：写草稿，不提交到 Git。
- `Templates/`：放 Obsidian 模板，不提交到 Git。
- `Attachments/`：草稿图片，不提交到 Git。
- `Published/`：发布后脚本会复制一份源稿，便于追踪。

## 一键发布

推荐使用本地 Obsidian 插件：

1. 打开 Obsidian 设置。
2. 进入 `Community plugins`。
3. 关闭 `Restricted mode`。
4. 在已安装插件中启用 `Sakura Blog Publisher`。
5. 打开一篇 Markdown。它可以在博客目录里，也可以在你的日常 Obsidian Vault 里。
6. 点击左侧纸飞机图标，或在命令面板执行 `发布当前文章`。
7. 在弹窗里确认标题、板块和简介。
8. 先点 `预览` 检查生成效果；确认无误后点 `发布并推送`。

插件会调用同一套发布脚本。你也可以继续在 PowerShell 中运行：

```powershell
npm run post:publish -- "obsidian/Drafts/文章标题.md"
```

插件源码保存在本项目：

```text
D:\MyBlog\obsidian\.obsidian\plugins\sakura-blog-publisher
```

Obsidian 实际加载的插件目录是：

```text
C:\Users\28068\Documents\Obsidian Vault\.obsidian\plugins\sakura-blog-publisher
```

以后更新插件后运行下面命令即可同步到 Obsidian，不需要手动复制：

```powershell
npm run plugin:sync
```

脚本会完成：

1. 读取 Obsidian 草稿。
2. 自动生成或补齐 Jekyll front matter。
3. 把文章写入 `_posts/YYYY-MM-DD-slug.md`。
4. 复制文章引用的本地图片到 `assets/images/posts/YYYY-MM-DD-slug/`。
5. 将 Obsidian 图片链接改成站点可访问路径。
6. 运行 `npm run build` 和 `npm run test:e2e`。
7. 提交并推送到 GitHub，触发 Pages 自动部署。

## 草稿模板

```markdown
---
title: "文章标题"
date: 2026-04-28 20:00:00 +0800
categories: [随笔]
summary: "一句话摘要，会显示在首页和搜索里。"
published: true
---

这里开始写正文。
```

没有 front matter 也可以，脚本会用文件名和正文第一段生成基础信息。
插件弹窗会把这些信息写回草稿 front matter，所以你不需要手动记 YAML 格式。

目前 Archive 使用两个分类：

```yaml
categories: [随笔]
```

或者：

```yaml
categories: [学习]
```

不写 `categories` 时，脚本会默认归到 `随笔`。

## 推荐发布节奏

1. 在你的日常 Obsidian Vault 里新建 Markdown，直接写正文。
2. 插入图片时用 Obsidian 默认图片语法，图片放在文章旁边或 Vault 附件目录都可以。
3. 写完后点击插件纸飞机图标。
4. 在弹窗里选择 `随笔` 或 `学习`，补好标题和简介。
5. 点 `预览`，刷新本地博客看效果。
6. 如果预览效果不想保留，点 `清理上次预览`。
7. 没问题后回到 Obsidian 点 `发布并推送`。

正式发布会自动读取当前笔记、生成 `_posts/` 文章、复制图片、运行构建和端到端检查，然后提交并推送到 GitHub Pages。
预览发布会额外写入 `.obsidian-preview.json` 清单，清理按钮只按这份清单撤回上次预览生成的文件。

## 管理已发布文章

插件提供 `Sakura Blog Publisher: 管理文章` 命令，也可以点左侧 ribbon 的管理入口。

管理面板会读取 `_posts/` 下的文章，并提供：

- `打开源稿`：打开 `obsidian/Published/` 中保留的源稿；如果没有源稿，会打开生成后的 `_posts` 文件。
- `复制链接`：复制文章线上地址。
- `重新发布`：用保留的源稿重新走发布、构建、提交、推送流程。
- `删除文章`：删除 `_posts/YYYY-MM-DD-slug.md`，确认后构建、测试、提交并推送。

删除时默认只删除文章文件，不会删除图片资源。确认弹窗里可以勾选「同时删除图片资源」，这会删除对应的 `assets/images/posts/YYYY-MM-DD-slug/` 文件夹。

## 图片写法

Obsidian 常见写法支持：

```markdown
![[image.png]]
![](../Attachments/image.png)
```

图片建议放在 `obsidian/Attachments/`。
