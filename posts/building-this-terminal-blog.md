---
title: Building This Terminal Blog with Markdown and GitHub Actions
date: 2026-04-19
tags: [meta, github-pages, automation]
excerpt: How I built a terminal-themed static blog powered by Obsidian, a custom Node.js build script, and GitHub Actions — no frameworks, no dependencies.
---

## Why Build a Blog From Scratch?

I could have used Hugo, Jekyll, or any other static site generator. But I wanted something that fits my workflow exactly — write markdown in Obsidian, push to GitHub, and have the site build itself. No framework lock-in, no config files to learn, no theme marketplace. Just a build script I fully understand and can modify whenever I want.

## The Stack

The entire site runs on three things:

- **Obsidian** as the writing environment — the vault *is* the GitHub repo
- **A Node.js build script** (~200 lines) that converts markdown to HTML
- **GitHub Actions** that triggers the build on every push and deploys to GitHub Pages

There are zero npm dependencies. The build script handles frontmatter parsing, markdown-to-HTML conversion, Obsidian `[[wikilink]]` resolution, and template injection — all with plain Node.js.

## How It Works

Every post lives as a `.md` file in the `posts/` folder with YAML frontmatter:

```markdown
---
title: My Post Title
date: 2026-04-19
tags: [topic1, topic2]
excerpt: A short summary for the blog index.
---

Your content here...
```

When I push to `main`, GitHub Actions runs `build/build.js` which:

1. Reads all `.md` files from `posts/`
2. Parses the frontmatter for metadata
3. Converts the markdown body to HTML
4. Resolves any `[[wikilinks]]` to matching posts
5. Injects everything into the terminal-themed HTML templates
6. Outputs a complete static site to `dist/`
7. GitHub Pages serves `dist/`

The whole build takes under a second.

## The Design

I wanted the site to feel like you're reading output in a terminal. The design choices reflect that:

- **JetBrains Mono** for all text — a monospace font designed for readability
- **CRT scanlines and vignette** as subtle CSS overlays
- **A macOS-style window chrome bar** at the top with the red/yellow/green dots
- **A vim-style status bar** at the bottom showing scroll position
- **Syntax highlighting** via highlight.js for code blocks
- **Green-on-dark** color scheme with a hacker aesthetic

Everything is CSS — no images, no canvas, no JavaScript rendering tricks.

## Folder Structure

```
Index/
├── .github/workflows/build.yml
├── build/build.js
├── css/style.css
├── pages/
│   ├── about.md
│   └── projects.md
├── posts/
│   └── (your markdown posts)
├── static/images/
└── templates/
    ├── shell.html
    ├── home.html
    ├── post.html
    ├── about.html
    └── projects.html
```

## What I Like About This Setup

**The writing experience is clean.** I open Obsidian, create a new note in `posts/`, write, and push. No build commands to remember locally, no preview servers to run.

**Drafts are built in.** Adding `draft: true` to frontmatter hides the post from the site without removing it from the repo.

**Wikilinks work.** I can link between posts using Obsidian's `[[Post Title]]` syntax and the build script resolves them to proper HTML links.

**No dependencies to maintain.** The build script is vanilla Node.js. No `package.json`, no `node_modules`, no version conflicts. It'll run the same way in five years.

## What's Next

This is version one. Some things I'm considering:

- RSS feed generation
- A tag-based filtering system on the index page
- Reading time estimates
- An ASCII art logo that I actually like

For now — it works, it's fast, and it's mine. That's enough to start writing.
