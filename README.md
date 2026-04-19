# yusif@web — Terminal Blog

A static blog with a terminal aesthetic, powered by markdown and GitHub Actions.

## How It Works

1. You write posts as `.md` files in `posts/`
2. You `git push` to `main`
3. GitHub Actions runs `build/build.js` which converts your markdown into HTML
4. The built site deploys to GitHub Pages automatically

You never touch HTML. Just write markdown.

## Writing a Post

Create a new `.md` file in the `posts/` folder. The filename becomes the URL slug.

**Example:** `posts/my-new-post.md` → `yusif-v.github.io/Index/posts/my-new-post.html`

Every post needs YAML frontmatter at the top:

```markdown
---
title: My Post Title
date: 2026-04-19
tags: [homelab, docker]
excerpt: A short description that appears on the blog index.
---

Your markdown content starts here...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Post title displayed on the page and blog index |
| `date` | Yes | Publication date in `YYYY-MM-DD` format (used for sorting) |
| `tags` | No | Array of tags: `[tag1, tag2]` |
| `excerpt` | No | Short summary shown on the blog index |
| `draft` | No | Set to `true` to exclude from the built site |

### Supported Markdown Features

- **Standard markdown**: headings, bold, italic, strikethrough, links, images, lists, blockquotes, horizontal rules, tables
- **Fenced code blocks** with language hints (syntax highlighted via highlight.js):
  ````
  ```bash
  kubectl get pods -A
  ```
  ````
- **Obsidian wikilinks**: `[[Other Post Title]]` links to a matching post by title. `[[Post Title|Custom Text]]` renders with custom display text. If no matching post exists, it renders as dimmed text.
- **Images**: Place images in `static/images/` and reference them in posts as `![alt](filename.png)`. The build resolves paths automatically.

### Drafts

Add `draft: true` to frontmatter to hide a post from the site. The file stays in the repo but won't be built or listed:

```markdown
---
title: Work in Progress
date: 2026-04-19
tags: [notes]
draft: true
---
```

Remove the `draft` line (or set it to `false`) and push to publish.

## Editing Pages

- **About page**: Edit `pages/about.md` for the text content. The info grid blocks (certifications, stack, etc.) are in `templates/about.html`.
- **Projects page**: Edit `pages/projects.md` — standard markdown.
- **Home hero**: Edit `templates/home.html` to change the ASCII art, whoami text, or status line.

## Folder Structure

```
Index/
├── .github/workflows/build.yml  # GitHub Actions: build + deploy
├── .obsidian/                   # Obsidian vault config (ignored by build)
├── build/
│   └── build.js                 # Build script (markdown → HTML)
├── css/
│   └── style.css                # Terminal theme styles
├── pages/
│   ├── about.md                 # About page content
│   └── projects.md              # Projects page content
├── posts/                       # Your blog posts (markdown)
│   ├── my-first-post.md
│   └── another-post.md
├── static/
│   └── images/                  # Images referenced in posts
├── templates/
│   ├── shell.html               # Outer wrapper (nav, footer, status bar)
│   ├── home.html                # Blog index with hero
│   ├── post.html                # Single post layout
│   ├── about.html               # About page layout
│   └── projects.html            # Projects page layout
├── dist/                        # Generated output (gitignored)
├── .gitignore
└── README.md
```

## Local Preview

To test the build locally before pushing:

```bash
node build/build.js
```

Then open `dist/index.html` in a browser. For proper relative paths, use a local server:

```bash
cd dist && python3 -m http.server 8000
# open http://localhost:8000
```

## GitHub Pages Setup

1. Go to your repo **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` — the workflow handles the rest

Your site will be at: `https://yusif-v.github.io/Index/`

> **Tip:** Rename the repo to `yusif-v.github.io` to get a cleaner URL at the root domain.

## Customization

- **Colors**: All theme colors are CSS variables at the top of `css/style.css`
- **ASCII art**: In `templates/home.html` inside `.hero-ascii`
- **Nav links**: In `templates/shell.html`
- **Status bar text**: In `templates/shell.html`
