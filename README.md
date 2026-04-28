# MyBlog

一个受 `tw93/tw93.github.io` 视觉气质启发的轻量 Jekyll 个人博客。它保留了清爽导航、大标题头图、文章列表和安静阅读体验，但没有复制原站的个人内容与复杂系统。

## 本地预览

本机已经安装 RubyInstaller with DevKit。新打开一个 PowerShell 后运行：

```bash
bundle install
npm run dev
```

启动后访问 `http://127.0.0.1:4000/Blog/`。

## 常用命令

```bash
npm run build
npm run clean
```

## 常用修改

- 站点名称、描述、作者和导航：`_config.yml`
- 首页标题：`index.html`
- 文章：`_posts/`
- 关于页：`about.md`
- 归档页：`archive.html`
- 样式：`assets/css/style.css`
- 头部、搜索、页脚和文章列表组件：`_includes/`

## 部署

仓库包含 GitHub Pages 工作流：`.github/workflows/pages.yml`。推送到 `sakur7a/Blog` 后，在仓库设置里启用 Pages 的 GitHub Actions 来源即可自动构建发布。
