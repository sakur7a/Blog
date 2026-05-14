# Tags Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tags to every blog post with display on the blog and management in the Obsidian plugin.

**Architecture:** Tags stored as `tags: [tag1, tag2]` in YAML front matter. Blog renders tags on post pages and cards, plus a dedicated `/tags/` aggregation page. Obsidian plugin adds tag input to the publish form and tag editing to the management UI. Scripts handle tag parsing and editing.

**Tech Stack:** Jekyll 4.x (Liquid templates), vanilla CSS/JS, Obsidian Plugin API, Node.js scripts

---

### Task 1: Add tag chip CSS styles

**Files:**
- Modify: `assets/css/style.css`

- [ ] **Step 1: Add tag chip styles at the end of `style.css`**

Append before the closing `@media` block (before line 783 `@media (max-width: 640px) {`):

```css
/* Tag chips */
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 30px;
}

.post-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0 0;
}

.tag-chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.7;
  transition: background 0.15s, color 0.15s;
}

.tag-chip:hover {
  background: var(--accent);
  color: #fff;
}

.tag-chip--sm {
  padding: 1px 7px;
  font-size: 11px;
}

/* Tags page */
.tags-page-header {
  margin-bottom: 32px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 36px;
}

.tag-cloud-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--chip-bg);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-cloud-item:hover,
.tag-cloud-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.tag-cloud-item em {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.tag-group {
  scroll-margin-top: 22px;
}

.tag-group[hidden] {
  display: none;
}

.tag-group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.tag-group-header h2 {
  margin: 0;
  color: var(--strong);
  font-size: 22px;
}
```

- [ ] **Step 2: Add responsive styles inside the `@media (max-width: 640px)` block**

Append before the closing `}` of the media query (before line 881):

```css
  .tag-cloud {
    gap: 6px;
  }

  .tag-cloud-item {
    font-size: 13px;
  }
```

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "style: add tag chip and tag page CSS styles"
```

---

### Task 2: Add tags display to post page layout

**Files:**
- Modify: `_layouts/post.html`

- [ ] **Step 1: Add tags rendering after the `.page-info` paragraph**

In `_layouts/post.html`, after line 11 (`</p>` closing the `.page-info` div), insert:

```html
  {% if page.tags.size > 0 %}
  <p class="post-tags">
    {% for tag in page.tags %}
      <a href="{{ '/tags/' | append: tag | relative_url }}" class="tag-chip">{{ tag }}</a>
    {% endfor %}
  </p>
  {% endif %}
```

- [ ] **Step 2: Build and verify the site still builds**

```bash
cd D:/MyBlog && npm run build
```

Expected: Build succeeds (no posts have tags yet, so nothing renders).

- [ ] **Step 3: Commit**

```bash
git add _layouts/post.html
git commit -m "feat: render tags on post page"
```

---

### Task 3: Add tags display to post cards

**Files:**
- Modify: `_includes/post-item.html`

- [ ] **Step 1: Add tags rendering after the summary paragraph**

In `_includes/post-item.html`, after line 14 (`</p>` closing `.entry-summary`), insert:

```html
  {% if include.post.tags.size > 0 %}
  <p class="post-card-tags">
    {% for tag in include.post.tags %}
      <a href="{{ '/tags/' | append: tag | relative_url }}" class="tag-chip tag-chip--sm">{{ tag }}</a>
    {% endfor %}
  </p>
  {% endif %}
```

- [ ] **Step 2: Commit**

```bash
git add _includes/post-item.html
git commit -m "feat: render tags on post cards"
```

---

### Task 4: Create tags aggregation page

**Files:**
- Create: `tags.html`

- [ ] **Step 1: Create `tags.html` at project root**

```html
---
layout: base
body_id: tags
permalink: /tags/
---

<section class="tags-page-header">
  <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;">标签</h1>
  <p style="color:var(--muted);margin:0;">按标签浏览所有文章。</p>
</section>

{% assign all_tags = site.tags | sort %}
{% if all_tags.size > 0 %}
<div class="tag-cloud">
  {% for tag_pair in all_tags %}
    {% assign tag_name = tag_pair[0] %}
    {% assign tag_posts = tag_pair[1] %}
    <a href="#{{ tag_name }}" class="tag-cloud-item" data-tag="{{ tag_name }}">
      {{ tag_name }} <em>{{ tag_posts.size }}</em>
    </a>
  {% endfor %}
</div>

<div class="archive-groups" id="tag-groups">
  {% for tag_pair in all_tags %}
    {% assign tag_name = tag_pair[0] %}
    {% assign tag_posts = tag_pair[1] %}
    <div class="tag-group" id="{{ tag_name }}" data-tag="{{ tag_name }}">
      <div class="tag-group-header">
        <h2>{{ tag_name }}</h2>
        <span>{{ tag_posts.size }} 篇</span>
      </div>
      <div class="archive-list">
        {% for post in tag_posts %}
        <a href="{{ post.url | relative_url }}" class="archive-row">
          <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y-%m-%d" }}</time>
          <div>
            <strong>{{ post.title }}</strong>
            {% if post.summary %}<small>{{ post.summary }}</small>{% endif %}
          </div>
        </a>
        {% endfor %}
      </div>
    </div>
  {% endfor %}
</div>
{% else %}
<p class="archive-empty">还没有文章有标签。</p>
{% endif %}
```

- [ ] **Step 2: Commit**

```bash
git add tags.html
git commit -m "feat: add tags aggregation page"
```

---

### Task 5: Add tags page JavaScript filtering

**Files:**
- Modify: `assets/js/site.js`

- [ ] **Step 1: Add tags page interactivity script**

Append to the end of `site.js` (before the final `})();` if present, or at the end):

```javascript
// Tags page filtering
(function () {
  var cloud = document.querySelector(".tag-cloud");
  var groups = document.querySelectorAll(".tag-group");
  if (!cloud || !groups.length) return;

  var items = cloud.querySelectorAll(".tag-cloud-item");

  function activateTag(tag) {
    items.forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-tag") === tag);
    });
    groups.forEach(function (group) {
      group.hidden = tag && group.getAttribute("data-tag") !== tag;
    });
  }

  cloud.addEventListener("click", function (event) {
    var item = event.target.closest(".tag-cloud-item");
    if (!item) return;
    event.preventDefault();
    var tag = item.getAttribute("data-tag");
    var current = cloud.querySelector(".tag-cloud-item.active");
    activateTag(current && current.getAttribute("data-tag") === tag ? "" : tag);
  });

  // Auto-activate from hash
  if (window.location.hash) {
    activateTag(decodeURIComponent(window.location.hash.slice(1)));
  }
})();
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/site.js
git commit -m "feat: add tags page filtering interactivity"
```

---

### Task 6: Add tags to search index

**Files:**
- Modify: `search.json`
- Modify: `assets/js/site.js`

- [ ] **Step 1: Add tags field to `search.json`**

In `search.json`, after the `summary` line (line 10), add:

```json
    "tags": {{ post.tags | default: "" | jsonify }}
```

The full object becomes:
```json
  {
    "title": {{ post.title | jsonify }},
    "url": {{ post.url | relative_url | jsonify }},
    "date": {{ post.date | date: "%Y-%m-%d" | jsonify }},
    "summary": {{ post.summary | default: post.excerpt | strip_html | strip_newlines | jsonify }},
    "tags": {{ post.tags | default: "" | jsonify }}
  }
```

- [ ] **Step 2: Update search matching in `site.js` to include tags**

In `site.js`, find the search filter function (around line 142):

```javascript
    render((index || []).filter(function (item) {
      return (item.title + " " + item.summary).toLowerCase().indexOf(query) !== -1;
    }));
```

Replace with:

```javascript
    render((index || []).filter(function (item) {
      var tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
      return (item.title + " " + item.summary + " " + tags).toLowerCase().indexOf(query) !== -1;
    }));
```

- [ ] **Step 3: Commit**

```bash
git add search.json assets/js/site.js
git commit -m "feat: include tags in search index and matching"
```

---

### Task 7: Add tags parsing to `list-posts.js`

**Files:**
- Modify: `scripts/list-posts.js`

- [ ] **Step 1: Add `tagsFromYaml` function**

After the `categoryFromYaml` function (line 44), add:

```javascript
function tagsFromYaml(yaml) {
  const raw = readYamlValue(yaml, "tags");
  if (!raw || raw === "[]") return [];
  const match = raw.match(/^\[(.*)\]$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}
```

- [ ] **Step 2: Include `tags` in `postInfo` return object**

In `postInfo`, after line 59 (`const category = categoryFromYaml(yaml);`), add:

```javascript
  const tags = tagsFromYaml(yaml);
```

In the return object (line 73-87), add `tags` after `category`:

```javascript
  return {
    title,
    date: `${year}-${month}-${day}`,
    dateValue,
    category,
    tags,
    summary,
    slug,
    cover,
    coverPosition,
    postPath,
    assetPath,
    sourcePath,
    url,
    relativeUrl: `${basePath}${relativeUrl}`
  };
```

- [ ] **Step 3: Export `tagsFromYaml`**

In the `module.exports` (line 110-115), add `tagsFromYaml`:

```javascript
module.exports = {
  listPosts,
  postInfo,
  splitFrontMatter,
  readYamlValue,
  tagsFromYaml
};
```

- [ ] **Step 4: Verify by running list-posts**

```bash
cd D:/MyBlog && node scripts/list-posts.js
```

Expected: JSON output includes `"tags": []` for existing posts.

- [ ] **Step 5: Commit**

```bash
git add scripts/list-posts.js
git commit -m "feat: parse and return tags in list-posts"
```

---

### Task 8: Add `edit-tags` subcommand to `manage-post.js`

**Files:**
- Modify: `scripts/manage-post.js`

- [ ] **Step 1: Add `editTags` function**

After the `deletePost` function (line 95), add:

```javascript
function editTags(root = path.resolve(__dirname, ".."), postPath, tagsInput, options = {}) {
  const { fullPath, relative } = normalizePostPath(root, postPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Post does not exist: ${relative}`);
  }

  const content = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("No front matter found");

  const yaml = match[1];
  const body = match[2];

  const tags = tagsInput
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const tagsYaml = `[${tags.join(", ")}]`;

  const pattern = /^tags:\s*.+?$/m;
  let nextYaml;
  if (pattern.test(yaml)) {
    nextYaml = yaml.replace(pattern, `tags: ${tagsYaml}`);
  } else {
    nextYaml = yaml.trimEnd() + `\ntags: ${tagsYaml}`;
  }

  const nextContent = `---\n${nextYaml.trim()}\n---\n${body}`;
  fs.writeFileSync(fullPath, nextContent, "utf8");

  if (!options.noCommit) {
    run(root, "git", ["add", relative], { inherit: true });
    run(root, "git", ["commit", "-m", `post: update tags for ${path.basename(relative, ".md")}`], { inherit: true });
    if (!options.noPush) {
      run(root, "git", ["-c", "http.sslBackend=openssl", "push", "origin", "main"], { inherit: true });
    }
  }

  return { postPath: relative, tags };
}
```

- [ ] **Step 2: Update `parseArgs` to handle `edit-tags` command**

In `parseArgs`, add `tags` option. In the for loop (after the `--skip-tests` block, line 121), add:

```javascript
    } else if (arg === "--tags") {
      options.tags = argv[index + 1] || "";
      index += 1;
```

Add `tags: ""` to the initial options object.

- [ ] **Step 3: Update CLI handler to support `edit-tags`**

In the `if (require.main === module)` block (line 129-138), replace:

```javascript
if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === "delete") {
      const result = deletePost(path.resolve(__dirname, ".."), options.post, options);
      process.stdout.write(JSON.stringify(result, null, 2));
    } else if (options.command === "edit-tags") {
      const result = editTags(path.resolve(__dirname, ".."), options.post, options.tags || "", options);
      process.stdout.write(JSON.stringify(result, null, 2));
    } else {
      throw new Error("Usage: node scripts/manage-post.js <delete|edit-tags> --post _posts/YYYY-MM-DD-slug.md");
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Update exports**

In `module.exports`, add `editTags`:

```javascript
module.exports = {
  assetPathForPost,
  deletePost,
  editTags,
  normalizePostPath,
  parseArgs
};
```

- [ ] **Step 5: Commit**

```bash
git add scripts/manage-post.js
git commit -m "feat: add edit-tags subcommand to manage-post"
```

---

### Task 9: Update Obsidian plugin data functions

**Files:**
- Modify: `obsidian/.obsidian/plugins/sakura-blog-publisher/main.js`

- [ ] **Step 1: Add `tagsFromYaml` helper function**

After the `readYamlValue` function (line 36), add:

```javascript
function tagsFromYaml(yaml) {
  const raw = readYamlValue(yaml, "tags");
  if (!raw || raw === "[]") return [];
  const match = raw.match(/^\[(.*)\]$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}
```

- [ ] **Step 2: Update `extractMetadata` to include tags**

In `extractMetadata` (line 60-69), after line 66 (`const coverPosition = ...`), add:

```javascript
const tags = tagsFromYaml(yaml);
```

Update the return to include `tags`:

```javascript
return { title, summary, category, tags, coverPosition };
```

- [ ] **Step 3: Update `applyMetadata` to write tags**

In `applyMetadata` (line 71-81), after the `writeYamlValue` for summary (line 76), add:

```javascript
if (metadata.tags && metadata.tags.length) {
  nextYaml = writeYamlValue(nextYaml, "tags", `[${metadata.tags.join(", ")}]`);
} else {
  nextYaml = writeYamlValue(nextYaml, "tags", "[]");
}
```

- [ ] **Step 4: Commit**

```bash
git add obsidian/.obsidian/plugins/sakura-blog-publisher/main.js
git commit -m "feat: parse and write tags in plugin metadata functions"
```

---

### Task 10: Add tags input to plugin publish form

**Files:**
- Modify: `obsidian/.obsidian/plugins/sakura-blog-publisher/main.js`

- [ ] **Step 1: Add tags to `PublishPostModal` metadata**

In `PublishPostModal` constructor (line 717-729), add `tags` to the metadata object:

```javascript
this.metadata = {
  title: draft.metadata.title || "",
  summary: draft.metadata.summary || "",
  category: CATEGORIES.includes(draft.metadata.category) ? draft.metadata.category : "随笔",
  tags: draft.metadata.tags || [],
  coverPath: "",
  coverPosition: draft.metadata.coverPosition || "50% 50%"
};
```

- [ ] **Step 2: Add tags text input after the summary setting in `PublishPostModal.onOpen`**

After the summary Setting (line 781), before the cover setting (line 783), add:

```javascript
    new Setting(contentEl)
      .setName("标签")
      .setDesc("用逗号或空格分隔，如：机器学习, 深度学习, 笔记")
      .addText((text) => {
        text
          .setPlaceholder("标签1, 标签2, 标签3")
          .setValue(this.metadata.tags.join(", "))
          .onChange((value) => {
            this.metadata.tags = value
              .split(/[,，\s]+/)
              .map((t) => t.trim())
              .filter(Boolean);
            this.renderPreview();
          });
      });
```

- [ ] **Step 3: Show tags in `PublishPostModal.renderPreview`**

In `renderPreview`, after the category span (line 901), add:

```javascript
    if (this.metadata.tags.length) {
      this.metadata.tags.forEach(function (tag) {
        meta.createSpan({ text: "#" + tag });
      });
    }
```

- [ ] **Step 4: Commit**

```bash
git add obsidian/.obsidian/plugins/sakura-blog-publisher/main.js
git commit -m "feat: add tags input to publish modal"
```

---

### Task 11: Add tags to plugin management UI

**Files:**
- Modify: `obsidian/.obsidian/plugins/sakura-blog-publisher/main.js`

- [ ] **Step 1: Add tags to `ManageContentModal.publishMeta` initialization**

In `renderPublishForm` (line 1120-1207), in the `publishMeta` initialization (line 1134-1140), add `tags`:

```javascript
    this.publishMeta = {
      title: this.draft.metadata.title || "",
      summary: this.draft.metadata.summary || "",
      category: CATEGORIES.includes(this.draft.metadata.category) ? this.draft.metadata.category : "随笔",
      tags: this.draft.metadata.tags || [],
      coverPath: "",
      coverPosition: this.draft.metadata.coverPosition || "50% 50%"
    };
```

- [ ] **Step 2: Add tags input to the publish form**

After the summary Setting in `renderPublishForm` (after line 1173), add:

```javascript
    new Setting(this.publishContainer)
      .setName("标签")
      .setDesc("用逗号或空格分隔")
      .addText((text) => {
        text
          .setPlaceholder("标签1, 标签2")
          .setValue(this.publishMeta.tags.join(", "))
          .onChange((value) => {
            this.publishMeta.tags = value
              .split(/[,，\s]+/)
              .map((t) => t.trim())
              .filter(Boolean);
          });
      });
```

- [ ] **Step 3: Display tags on post cards in `renderPosts`**

In `renderPosts`, after the meta section that shows the summary (around line 1413-1415), add tag display:

```javascript
      if (post.tags && post.tags.length) {
        const tagsEl = card.createDiv({ cls: "sakura-manager-card-meta" });
        post.tags.forEach(function (tag) {
          tagsEl.createSpan({
            cls: "sakura-manager-badge",
            text: tag,
            attr: { style: "background: rgba(139,92,246,0.12); color: rgb(139,92,246);" }
          });
        });
      }
```

- [ ] **Step 4: Add "编辑标签" button to post card actions**

In `renderPosts`, after the cover button event listener (around line 1467), before the delete button (line 1469), add:

```javascript
      const tagsButton = actions.createEl("button", { text: "编辑标签" });
      tagsButton.addEventListener("click", () => {
        new EditTagsModal(this.app, this.plugin, post, this).open();
      });
```

- [ ] **Step 5: Add tags to search filtering**

In `renderPosts`, update the `filterList` call (line 1389) to include `"tags"`:

```javascript
    const filtered = this.filterList(this.posts, ["title", "summary", "slug", "tags"]);
```

- [ ] **Step 6: Show tags in content preview**

In `toggleContentPreview`, after the category badge (line 1236-1239), add:

```javascript
    if (this.publishMeta.tags && this.publishMeta.tags.length) {
      this.publishMeta.tags.forEach(function (tag) {
        meta.createSpan({
          cls: "sakura-manager-badge",
          text: tag,
          attr: { style: "background: rgba(139,92,246,0.12); color: rgb(139,92,246);" }
        });
      });
    }
```

- [ ] **Step 7: Commit**

```bash
git add obsidian/.obsidian/plugins/sakura-blog-publisher/main.js
git commit -m "feat: add tags display and edit button to post management UI"
```

---

### Task 12: Add EditTagsModal to plugin

**Files:**
- Modify: `obsidian/.obsidian/plugins/sakura-blog-publisher/main.js`

- [ ] **Step 1: Add `EditTagsModal` class**

After the `DeletePostModal` class (after line 1663), add:

```javascript
class EditTagsModal extends Modal {
  constructor(app, plugin, post, manager) {
    super(app);
    this.plugin = plugin;
    this.post = post;
    this.manager = manager;
    this.tagsInput = (post.tags || []).join(", ");
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();
    contentEl.createEl("h2", { text: "编辑标签" });
    contentEl.createEl("p", { text: this.post.title || this.post.postPath });

    new Setting(contentEl)
      .setName("标签")
      .setDesc("用逗号或空格分隔多个标签")
      .addText((text) => {
        text
          .setPlaceholder("标签1, 标签2")
          .setValue(this.tagsInput)
          .onChange((value) => {
            this.tagsInput = value;
          });
      });

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());

    const confirmBtn = actions.createEl("button", { text: "保存并推送", cls: "mod-cta" });
    confirmBtn.addEventListener("click", async () => {
      const tags = this.tagsInput
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      this.close();
      try {
        await this.plugin.runNode([
          "scripts/manage-post.js",
          "edit-tags",
          "--post",
          this.post.postPath,
          "--tags",
          tags.join(", ")
        ]);
        new Notice("标签已更新并推送。");
        if (this.manager) await this.manager.loadPosts();
      } catch (error) {
        console.error(error);
        new Notice(`更新标签失败：${error.message}`);
      }
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add obsidian/.obsidian/plugins/sakura-blog-publisher/main.js
git commit -m "feat: add EditTagsModal for editing post tags"
```

---

### Task 13: Add a tags link to the site header

**Files:**
- Modify: `_config.yml`

- [ ] **Step 1: Add Tags entry to the menu**

In `_config.yml`, add a new menu item after the Archive entry (after line 18):

```yaml
  - title: "Tags"
    url: "/tags/"
```

- [ ] **Step 2: Commit**

```bash
git add _config.yml
git commit -m "feat: add Tags link to site navigation"
```

---

### Task 14: Add tags to an existing post and verify end-to-end

- [ ] **Step 1: Add tags to the existing ML post**

Edit `_posts/2026-05-07-ml.md` front matter, add:

```yaml
tags: [机器学习, PCA, 降维]
```

- [ ] **Step 2: Build the site**

```bash
cd D:/MyBlog && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Start dev server and verify visually**

```bash
cd D:/MyBlog && npm run dev
```

Check:
- Home page: ML post card shows tags
- Post page: Tags appear below the meta line
- `/tags/` page: Tag cloud shows 机器学习, PCA, 降维 with count 1
- Click a tag: Filters to show only that tag's posts
- Search: Typing "PCA" in search finds the post

- [ ] **Step 4: Verify list-posts returns tags**

```bash
cd D:/MyBlog && node scripts/list-posts.js
```

Expected: ML post entry includes `"tags": ["机器学习", "PCA", "降维"]`.

- [ ] **Step 5: Commit the test post change**

```bash
git add _posts/2026-05-07-ml.md
git commit -m "post: add tags to ML post"
```
