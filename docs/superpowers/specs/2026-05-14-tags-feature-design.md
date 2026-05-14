# Tags Feature Design

## Goal

Add a `tags` field to every blog post, display tags on the blog (post page, home cards, dedicated tag aggregation page), and allow tag management through the Obsidian plugin's publish and manage UIs.

## Data Model

Front matter format:

```yaml
tags: [机器学习, 深度学习, 笔记]
```

YAML array, consistent with the existing `categories` pattern. Tags are free-form strings in Chinese or English. Empty array `[]` or omission means no tags.

## Blog Changes

### 1. Post page (`_layouts/post.html`)

Below the existing `.page-info` line (category + date), render tags as clickable chips linking to `/tags/{tag}/`.

```html
{% if page.tags.size > 0 %}
<p class="post-tags">
  {% for tag in page.tags %}
    <a href="{{ '/tags/' | append: tag | relative_url }}" class="tag-chip">{{ tag }}</a>
  {% endfor %}
</p>
{% endif %}
```

### 2. Post cards (`_includes/post-item.html`)

Below the summary line, render tags as small chips.

```html
{% if include.post.tags.size > 0 %}
<p class="post-card-tags">
  {% for tag in include.post.tags %}
    <a href="{{ '/tags/' | append: tag | relative_url }}" class="tag-chip tag-chip--sm">{{ tag }}</a>
  {% endfor %}
</p>
{% endif %}
```

### 3. Tag aggregation page (`tags.html`)

New file at project root, using Jekyll's built-in `site.tags` variable (no extra plugins needed). Two views:

- **`/tags/`** (no fragment): Master index listing all tags with post counts as a clickable grid
- **`/tags/#{tag}`** (with fragment): Clicking a tag scrolls to / filters its post list on the same page

Implementation: A single `tags.html` page that iterates `site.tags`, renders a tag cloud at top, and a grouped post list below. Uses anchor links (`#tag-name`) for filtering. JavaScript enhances this to show/hide groups when a tag is clicked.

### 4. Search (`search.json`)

Add `tags` field to the search index:

```json
"tags": {{ post.tags | default: "" | jsonify }}
```

Update `assets/js/site.js` search function to also match against tags.

### 5. CSS (`assets/css/style.css`)

New styles:
- `.post-tags`: flex wrap container for tag chips on post page
- `.post-card-tags`: flex wrap container for tag chips on cards
- `.tag-chip`: small pill-shaped badge (similar to `.sakura-manager-badge` in the plugin)
- `.tag-chip--sm`: smaller variant for cards
- Tag page styles: `.tag-cloud` grid, `.tag-cloud-item` with count badge, filtered post list

## Obsidian Plugin Changes

### 1. Publish form (`ManageContentModal.renderPublishForm`)

Add a "标签" Setting with a text input. User enters comma or space separated tags (e.g., `机器学习, 深度学习, 笔记`). The input is parsed into an array on submit.

### 2. Post management cards

Each post card in the "文章" tab shows tags as small badge elements. Add an "编辑标签" button that opens a small dialog to modify tags.

### 3. Data flow

- `extractMetadata()`: Parse `tags` from YAML front matter as an array
- `applyMetadata()`: Write `tags` as YAML array to front matter
- `ManageContentModal.publishMeta`: Include `tags: string[]`
- `ManageContentModal.renderPosts()`: Display tags on each card

### 4. Edit tags dialog

A small Modal that shows the current tags as a text input, pre-filled with comma-separated values. On confirm, calls a new script or the existing `manage-post.js` to update the post's front matter and push.

## Scripts Changes

### 1. `scripts/list-posts.js`

- Add `tagsFromYaml(yaml)` function to parse tags array from front matter
- Include `tags` array in the returned post info object

### 2. `scripts/manage-post.js`

- Add `edit-tags` subcommand: `manage-post.js edit-tags --post _posts/xxx.md --tags "tag1,tag2,tag3"`
- Reads the post file, updates the `tags` field in front matter, commits and pushes

### 3. `scripts/publish-obsidian-post.ps1`

- Already handles arbitrary YAML fields via `applyMetadata`; tags will flow through naturally once `applyMetadata` writes them

## Files to Create/Modify

| File | Action |
|---|---|
| `_layouts/post.html` | Add tags display below meta |
| `_includes/post-item.html` | Add tags display on cards |
| `tags.html` | New: tag aggregation page |
| `search.json` | Add tags to search index |
| `assets/js/site.js` | Include tags in search matching |
| `assets/css/style.css` | Add tag chip and tag page styles |
| `obsidian/.obsidian/plugins/sakura-blog-publisher/main.js` | Add tags input to publish form, display tags on cards, edit tags button |
| `scripts/list-posts.js` | Return tags in post info |
| `scripts/manage-post.js` | Add edit-tags subcommand |
