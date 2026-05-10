# Sakura Blog

一个轻量的 Jekyll 4.x 个人博客，中文界面，托管在 GitHub Pages。视觉风格参考 [tw93/tw93.github.io](https://github.com/tw93/tw93.github.io)，非 fork，内容和结构完全独立。

在线地址：[https://sakur7a.github.io/Blog/](https://sakur7a.github.io/Blog/)

## 功能

- **双主题** — 亮色 / 暗色一键切换，CSS 自定义属性驱动
- **文章归档** — 按分类（随笔 / 学习）筛选
- **客户端搜索** — 基于本地 JSON 索引，无需后端
- **MathJax 数学公式** — 内置 MathJax 3，支持 TeX 渲染与复制
- **Obsidian 发文流水线** — 从 Obsidian 草稿到 GitHub Pages 一键发布
- **E2E 测试** — Playwright 覆盖桌面端和移动端

## 快速开始

```bash
# 安装依赖（首次）
bundle install

# 启动本地开发服务器
npm run dev
```

访问 http://127.0.0.1:4000/Blog/

## 命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 本地开发，livereload |
| `npm run build` | 构建到 `_site/` |
| `npm run clean` | 清理构建产物 |
| `npm run test:e2e` | Playwright E2E 测试 |
| `npm run test:unit` | Node.js 单元测试 |
| `npm run post:publish -- "obsidian/Drafts/文章.md"` | 发布 Obsidian 草稿 |
| `npm run preview:clean` | 撤销上次预览发布 |

## 项目结构

```
├── _config.yml              # 站点配置
├── _layouts/                # 页面布局（base → home / post / page）
├── _includes/               # 组件（header, footer, post-item, search）
├── _posts/                  # 文章
├── assets/
│   ├── css/style.css        # 样式（纯 CSS，支持暗色主题）
│   ├── js/site.js           # 主题切换、搜索、TOC、MathJax
│   └── vendor/mathjax/      # MathJax 3
├── scripts/                 # 发布流水线脚本
├── obsidian/                # Obsidian vault（草稿、插件）
├── tests/                   # E2E + 单元测试
└── .github/workflows/       # GitHub Pages 部署
```

## 内容发布

文章用 Obsidian 编写，存放在 `obsidian/Drafts/`（gitignored）。发布流程：

1. 在 Obsidian 中编写草稿（支持 `![[图片]]` 语法和 `$$数学公式$$`）
2. 运行发布命令
3. 脚本自动完成：解析 front matter → 转换图片路径 → 复制资源 → 构建 → 测试 → 提交 → 推送
4. GitHub Actions 自动部署到 GitHub Pages

插件目录 `obsidian/.obsidian/plugins/sakura-blog-publisher/` 提供 Obsidian 内的图形化发布界面。

## 部署

推送到 `main` 分支后，GitHub Actions 自动执行：

```
Ruby 3.3 → bundle exec jekyll build → actions/deploy-pages@v4
```

无需手动操作。

## 致谢

- 视觉设计参考 [tw93/tw93.github.io](https://github.com/tw93/tw93.github.io)
- MathJax 3 数学公式渲染
- Playwright E2E 测试框架
