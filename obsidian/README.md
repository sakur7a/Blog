# Obsidian 写作工作流

这个目录可以作为 Obsidian vault 打开。推荐结构：

- `Drafts/`：写草稿，不提交到 Git。
- `Templates/`：放 Obsidian 模板，不提交到 Git。
- `Attachments/`：草稿图片，不提交到 Git。
- `Published/`：发布后脚本会复制一份源稿，便于追踪。

## 一键发布

在 PowerShell 中运行：

```powershell
npm run post:publish -- "obsidian/Drafts/文章标题.md"
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

目前 Archive 使用两个分类：

```yaml
categories: [随笔]
```

或者：

```yaml
categories: [学习]
```

不写 `categories` 时，脚本会默认归到 `随笔`。

## 图片写法

Obsidian 常见写法支持：

```markdown
![[image.png]]
![](../Attachments/image.png)
```

图片建议放在 `obsidian/Attachments/`。
