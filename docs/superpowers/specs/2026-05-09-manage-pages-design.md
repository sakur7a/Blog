# 设计文档：Obsidian 插件 - 独立页面管理

## 概述

在 Sakura Blog Publisher 插件中新增"管理独立页面"功能，允许用户在 Obsidian 中编辑博客的非文章页面（如 About 页面），并支持创建新页面和一键推送。

## 目标

- 列出所有独立页面（`layout: page` 的 .md 文件）
- 在 Obsidian 中打开页面文件进行编辑
- 创建新页面（自动生成 front matter）
- 一键 git commit + push 部署到 GitHub Pages

## 非目标

- 在弹窗内编辑页面内容（使用 Obsidian 原生编辑器）
- 编辑 `_config.yml` 站点配置
- 编辑文章（已有发布和管理功能）

## 页面检测逻辑

扫描博客根目录下的 `.md` 文件，读取 YAML front matter，筛选 `layout: page` 的文件。排除 `_posts/`、`_layouts/`、`_includes/` 等目录。

当前页面：`about.md`

## UI 设计

### 命令

- `manage-pages` — "管理页面"
- 新增 ribbon 图标（`file-text`）

### ManagePagesModal 弹窗

**页面列表区域：**
- 每个页面一张卡片，显示：标题、文件路径
- 操作按钮：打开编辑

**底部操作区：**
- 新建页面按钮
- 保存并推送按钮

### 新建页面流程

1. 点击「新建页面」
2. 弹出输入框，输入页面标题
3. 自动生成文件到博客根目录：
   ```markdown
   ---
   layout: page
   title: "输入的标题"
   ---

   在这里编写内容。
   ```
4. 自动在 Obsidian 中打开该文件

### 推送流程

点击「保存并推送」→ 运行 Node 脚本 → `git add .` + `git commit -m "update: 更新独立页面"` + `git push` → 显示结果

## 新增文件

### `scripts/manage-pages.js`

Node 脚本，支持子命令：

- `list` — 扫描根目录 .md 文件，输出页面列表 JSON
- `create --title "标题"` — 创建新页面文件
- `push` — git add + commit + push

### 插件 `main.js` 修改

- 新增 `ManagePagesModal` 类
- 新增 `manage-pages` 命令
- 新增 ribbon 图标
- `runNode` 方法复用现有的 Node 脚本执行机制

## 数据流

```
Obsidian 插件
  ├── list → manage-pages.js list → 返回 JSON [{title, path, slug}]
  ├── create → manage-pages.js create --title "X" → 创建文件 → Obsidian 打开
  └── push → manage-pages.js push → git commit + push
```

## 测试

- 手动测试：在 Obsidian 中打开插件，验证列表显示、打开文件、创建页面、推送流程
- 单元测试：可选，为 manage-pages.js 的 list/create 子命令添加测试
