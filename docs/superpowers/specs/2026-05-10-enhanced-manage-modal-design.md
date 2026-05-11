# Enhanced Manage Content Modal Design

## Context
管理博客弹窗（ManageContentModal）当前 UI 过于简陋：纯文本列表、无搜索、无排序、无封面预览、无统计。需要全面升级为实用的博客管理面板。

## Scope
单文件修改：`obsidian/.obsidian/plugins/sakura-blog-publisher/main.js`

## 功能需求

### 1. 统计摘要
- 文章 Tab：显示"共 N 篇 · 随笔 X · 学习 Y"
- 页面 Tab：显示"共 N 个页面"
- 位于工具栏左侧，`text-muted` 样式

### 2. 搜索过滤
- 搜索框位于工具栏中间，实时过滤（input 事件）
- 文章：匹配标题、摘要、slug
- 页面：匹配标题、路径
- 无结果时显示"没有匹配的结果"

### 3. 排序
- 下拉选择器位于工具栏右侧
- 文章排序选项：最新发布 / 标题 A-Z
- 页面排序选项：标题 A-Z / 标题 Z-A（页面无日期）
- 默认：文章按最新发布，页面按标题 A-Z

### 4. 横向卡片 + 封面缩略图
- 布局：左侧 60x60 圆角封面缩略图，右侧标题/元信息/摘要/操作
- 封面来源：
  - 文章：`post.cover` 字段（如 `/assets/images/posts/.../cover.png`），拼接 blogRoot 转 file:// URL
  - 页面：`page.headerImage` 同样处理
  - 无封面：显示 SVG 占位图标（图片轮廓）
- 分类 badge：随笔用蓝色、学习用绿色，小圆角标签

## CSS 新增样式

```css
.sakura-manager-search {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 13px;
  outline: none;
}
.sakura-manager-sort {
  padding: 5px 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 12px;
}
.sakura-manager-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-secondary);
}
.sakura-manager-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  background: var(--background-modifier-border);
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
.sakura-manager-thumb-placeholder {
  display: grid;
  place-items: center;
  color: var(--text-muted);
}
.sakura-manager-card-body {
  flex: 1;
  min-width: 0;
}
.sakura-manager-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.sakura-manager-badge--essay {
  background: rgba(59, 130, 246, 0.12);
  color: rgb(59, 130, 246);
}
.sakura-manager-badge--study {
  background: rgba(34, 197, 94, 0.12);
  color: rgb(34, 197, 94);
}
.sakura-manager-stats {
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
}
```

## 数据流
1. `loadPosts()` / `loadPages()` 获取数据后，存入 `this.posts` / `this.pages`
2. 渲染时先经过搜索过滤 + 排序，再生成卡片
3. 搜索/排序变化时重新过滤并渲染，不重新请求数据

## 验证
- 重新加载插件，打开管理窗口
- 文章 Tab：显示统计、搜索框、排序下拉、带封面缩略图的卡片列表
- 搜索关键词实时过滤
- 排序切换后列表重新排列
- 分类显示为彩色 badge
- 页面 Tab：同样有搜索、排序、缩略图
- 所有原有操作按钮正常工作
