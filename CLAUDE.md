# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A lightweight Jekyll 4.x personal blog ("Sakura"), Chinese-language (zh-CN), hosted on GitHub Pages. Inspired by tw93/tw93.github.io visually but not a fork. Posts are written in Obsidian and published via a custom pipeline.

## Commands

```bash
bundle install                # install Ruby deps (first time)
npm run dev                   # local dev server at http://127.0.0.1:4000/Blog/ (livereload)
npm run build                 # build to _site/
npm run clean                 # clean build artifacts
npm run test:e2e              # Playwright E2E tests (auto-starts Jekyll as webServer)
npm run test:unit             # Node.js unit tests (5 test files in tests/)
npm run post:publish -- "obsidian/Drafts/文章标题.md"  # publish an Obsidian draft
npm run preview:clean         # revert last preview-publish artifacts
```

## Architecture

### Jekyll layer (the blog itself)

- **Layouts** (`_layouts/`): `base.html` → `home.html` / `post.html` / `page.html`. All pages inherit from `base`.
- **Includes** (`_includes/`): `head.html`, `header.html`, `footer.html`, `post-item.html`, `search.html`.
- **Config**: `_config.yml` — site metadata, permalink pattern (`/:year-:month-:day/:title.html`), plugins (feed, sitemap, seo-tag), two archive categories ("随笔"/essays, "学习"/study).
- **Styling**: Pure hand-written CSS in `assets/css/style.css` (~890 lines). Uses CSS custom properties for dark/light theming (`:root` vs `html[data-theme="dark"]`). No Sass source files, no Tailwind.
- **JS** (`assets/js/site.js`): Theme toggle, firework canvas animation, client-side search, sticky TOC, MathJax rendering with copy buttons.
- **Math**: Vendored MathJax 3 in `assets/vendor/mathjax/` for TeX→SVG rendering.

### Content pipeline (Obsidian → Jekyll)

Posts are written in `obsidian/Drafts/` (gitignored). The publish flow:
1. `scripts/obsidian-publish.js` (Node CLI wrapper) delegates to `scripts/publish-obsidian-post.ps1` (PowerShell).
2. The PS1 script: reads Obsidian markdown, normalizes YAML front matter, converts Obsidian image syntax (`![[img]]`) to Jekyll paths, copies images to `assets/images/posts/YYYY-MM-DD-slug/`, normalizes `$$...$$` math, writes to `_posts/`, builds, tests, commits, and pushes.
3. Push triggers `.github/workflows/pages.yml` → GitHub Pages deployment.

Post front matter uses: `title`, `date`, `slug`, `categories` (随笔 or 学习), `summary`.

### Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `publish-obsidian-post.ps1` | Main publish pipeline (PowerShell) |
| `obsidian-publish.js` | Node wrapper for the PS1 publish script |
| `cleanup-obsidian-preview.js` | Revert preview-publish using `.obsidian-preview.json` manifest |
| `sync-obsidian-plugin.ps1` | Sync Sakura Blog Publisher plugin to user's Obsidian vault |
| `list-posts.js` | List all posts with metadata as JSON |
| `manage-post.js` | Delete a post with optional asset cleanup, build, test, commit, push |

### Tests

- **E2E** (`tests/blog.spec.js`): Playwright tests against the live Jekyll server, two projects: desktop (Chrome) and mobile (Pixel 7). Config in `playwright.config.js`.
- **Unit** (5 files): Node.js built-in test runner testing the Obsidian publish/metadata/plugin/cleanup/management scripts.

### Deployment

Push to `main` → GitHub Actions (`.github/workflows/pages.yml`) builds with Ruby 3.3 + `bundle exec jekyll build` → deploys via `actions/deploy-pages@v4`. Site lives at `https://sakur7a.github.io/Blog/`.

## Key Files to Edit

- Site config: `_config.yml`
- Styles: `assets/css/style.css`
- JS: `assets/js/site.js`
- Layouts/includes: `_layouts/`, `_includes/`
- Posts: `_posts/`
- Obsidian plugin: `obsidian/.obsidian/plugins/sakura-blog-publisher/`
