# Moments 功能设计

## 概述

为 Sakura 博客添加类似 QQ 空间/朋友圈的 moments 功能——轻量、灵活的短内容时间线。

## 内容结构

moments 复用 `_posts/` 目录，通过 `categories: [moments]` 区分。

### Front matter 格式

```yaml
---
date: 2026-06-12 14:30:00 +0800
categories: [moments]
slug: cat-cafe           # 必填，permalink 依赖 :title
title: "可选标题"         # 可选，纯文字碎碎念不需要
---

正文内容，支持 Markdown 全部语法。

![图片描述](/assets/images/posts/2026-06-12-cat-cafe/img1.jpg)
![图片描述](/assets/images/posts/2026-06-12-cat-cafe/img2.jpg)
```

**规则：**
- `slug` 必填（permalink 模式 `/:year-:month-:day/:title.html` 依赖它）
- `title` 可选，有则在卡片中加粗显示
- `summary` 不需要（页面展示全文）
- 图片直接在正文用 Markdown 语法添加，模板自动提取并以缩略图网格展示

## 页面设计

### 入口

`_config.yml` 的 `menu` 新增 Moments 项，链接到 `/moments/`，位于 Archive 和 Tags 之间。

### Moments 页面 (`moments.html`)

- 使用 `layout: page`，复用现有 page 布局
- 顶部 hero 区域（可配专属头图）
- 下方紧凑卡片列表，按时间倒序
- 不分页，全部加载

### 卡片设计

```
┌─────────────────────────────────┐
│  [可选标题 - 加粗]               │
│  正文内容，完整展示...            │
│  [缩略图] [缩略图] [缩略图]      │
│                          06-12  │
└─────────────────────────────────┘
```

- 背景：`var(--panel)`，与现有 post 卡片一致
- 圆角、轻微阴影
- 日期右下角，小字 `var(--muted)` 颜色
- 图片以缩略图网格展示（桌面 3 列、平板 2 列、手机 2 列），点击可放大（lightbox）
- 纯文字 moment 无图片区域，更紧凑
- 暗色主题自动适配（复用 CSS custom properties）

## 首页处理

修改 `_layouts/home.html` 的文章循环，过滤掉 `categories` 包含 `moments` 的文章。moments 只在自己的页面出现。

## 技术实现

### 新增文件

| 文件 | 说明 |
|------|------|
| `moments.html` | Moments 页面模板 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `_config.yml` | menu 新增 Moments 入口 |
| `_layouts/home.html` | 过滤 moments 分类 |
| `assets/css/style.css` | 新增 moments 卡片 + lightbox 样式（~80 行） |
| `assets/js/site.js` | 新增图片 lightbox 模块 |

### CSS

新增样式追加到 `style.css` 末尾，遵循现有模式：
- 使用 CSS custom properties（`--panel`, `--text`, `--muted`, `--accent` 等）
- 响应式断点：768px（平板）、640px（手机）
- 暗色主题通过 `[data-theme="dark"]` 自动适配

### JS

新增 lightbox IIFE 模块追加到 `site.js` 末尾：
- 点击缩略图 → 全屏 overlay 展示大图
- 点击 overlay 背景或 ESC 键关闭
- 纯 vanilla JS，无依赖

## 不做的事

- 不做评论/互动功能（静态博客）
- 不做无限滚动/分页
- 不做独立的 moment 详情页（内容全部内联展示）
- 不做发布脚本修改（复用现有 `_posts` 流程，手动创建文件即可）
