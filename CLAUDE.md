# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`lizard@web` — a static terminal-themed blog. Markdown in `posts/` and `pages/` is built into a static site in `dist/` by a single zero-dependency Node script and deployed to GitHub Pages by `.github/workflows/build.yml` on push to `main`. The repo is also an Obsidian vault (`.obsidian/`).

## Commands

```bash
node build/build.js                     # Build site → dist/
cd dist && python3 -m http.server 8000  # Preview locally
```

There is no package.json, no test suite, no linter, and no dependencies. The build is pure Node stdlib (`fs`, `path`).

## Architecture

The entire build is one file: `build/build.js` (~445 lines). It runs top-to-bottom in `build()` and does, in order:

1. **Wipe & recreate `dist/`**, then `copyDir` `css/` and `static/` into it.
2. **Read posts** from `posts/*.md`, parse each via `parseFrontmatter` (custom regex, not a YAML lib — only handles `key: value` and `[a, b]` arrays), drop `draft: true`, sort by `date` desc.
3. **Render each post** through `markdownToHtml` (custom regex-based markdown — fenced code, inline code, images, links, headings with auto-id, hr, blockquote, bold/italic, strikethrough, lists, tables, paragraphs). Then `resolveWikilinks` rewrites `[[Title]]` → `<a href="./posts/{slug}.html">` if a matching slug exists, else `<span class="comment">`. Image `src` attrs without `http(s)://` or leading `/` are rewritten to `../static/images/...`. A TOC is built from H2/H3 in the original markdown via `generateToc`.
4. **Wrap** every page in `templates/shell.html` via `wrapShell`, which does `{{TOKEN}}` string replacement (no template engine) for `CONTENT`, `PAGE_TITLE`, `ROOT`, `NAV_*` (active class), and `STATUS_FILE`. Per-page templates (`home.html`, `post.html`, `about.html`, `projects.html`) have their own tokens like `{{POST_LIST}}`, `{{BODY}}`, `{{TOC}}`, `{{ABOUT_BODY}}`, `{{PROJECTS_BODY}}`.
5. **Write outputs**: `dist/index.html`, `dist/posts/{slug}.html`, `dist/about.html`, `dist/projects.html`.

Slugs come from the post's filename (lowercased, spaces → `-`), not the title — but `resolveWikilinks` slugifies the wikilink *target text*, so wikilinks only resolve when the target text slugifies to the same thing as the filename.

## Conventions specific to this repo

- **Markdown is hand-rolled regex.** When extending syntax, edit `markdownToHtml` directly. Order matters — fenced code is replaced first so its contents aren't mangled by later passes. Inline code uses a single-line regex, so backticks across lines won't match.
- **Frontmatter parser is minimal.** It only understands flat `key: value` and bracketed arrays. No nested objects, no multi-line strings, no quoted-string escaping beyond stripping outer quotes from array items. `draft` is matched as either the boolean `true` or the string `"true"`.
- **Templates are not a real engine.** `{{TOKEN}}` is global string replace — tokens cannot appear in content (including inside posts) or they will be substituted.
- **`_drafts/`, `_ideas/`, `_templates/`** are Obsidian scratch dirs, not consumed by the build. `_ideas/` is gitignored. `pages/` and `posts/` are the only content dirs the build reads.
- **Syntax highlighting** is done client-side by highlight.js loaded from `templates/shell.html`; the build only emits `<pre><code class="language-xxx">`.
- **Date format must be `YYYY-MM-DD`** — sorting uses `localeCompare` on the raw string, so any other format will sort wrong.

## Deploy

Push to `main`. `.github/workflows/build.yml` runs `node build/build.js` on Node 20 and deploys `dist/` to GitHub Pages. There is no preview environment.
