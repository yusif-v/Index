# Blog Progress Tracker

## Completed

- [x] Terminal-themed static blog design (CRT scanlines, vignette, JetBrains Mono, vim status bar)
- [x] Build system — Node.js script converts markdown to HTML, zero dependencies
- [x] GitHub Actions pipeline — auto-build and deploy on push
- [x] GitHub Pages deployment
- [x] Frontmatter support (title, date, tags, excerpt, draft)
- [x] Obsidian wikilink resolution between posts
- [x] Syntax highlighting via highlight.js
- [x] Image support (static/images/)
- [x] Table support in markdown
- [x] TOC sidebar for long posts (sticky, scroll-spy, responsive)
- [x] Draft system (draft: true hides from build)
- [x] Renamed all prompts to lizard@web
- [x] Cleaned template — no personal info, ready to fill
- [x] Debut post written

## In Progress

- [ ] About page content (bio, certs, LinkedIn, links)
- [ ] Obsidian workflow setup (plugins, templates, folder structure)

## Planned — Content Structure

- [ ] Content groups / categories (pick which ones to use):
  - [ ] HTB / CTF writeups
  - [ ] Infrastructure & Homelab
  - [ ] Kubernetes / CKA
  - [ ] Networking
  - [ ] DevOps & Automation
  - [ ] Knowledge Management
  - [ ] AI & GenAI
  - [ ] Linux & Systems
  - [ ] Security & Offensive
  - [ ] Meta / Building in Public

## Planned — Features

- [ ] Tag-based filtering on the blog index
- [ ] Post graph page (D3 force graph — nodes for posts, edges from tags & wikilinks)
- [ ] RSS feed generation
- [ ] Reading time estimates
- [ ] ASCII art logo
- [ ] Certification badges on about page (Sec+, CySA+, CKA, CRTO, NCA-GENL)
- [ ] LinkedIn link (nav, footer, or about page)

## Planned — Obsidian Workflow

- [ ] `_templates/` folder (ignored by build)
  - [ ] New Post template (frontmatter auto-filled)
  - [ ] HTB Writeup template (recon → enum → exploit → privesc → flags)
  - [ ] General Writeup template
- [ ] `_ideas/` folder for post drafts and brainstorming
- [ ] Plugins to install:
  - [ ] Templater (post templates with auto-date)
  - [ ] obsidian-git (push from Obsidian)
  - [ ] Linter (auto-format on save)
  - [ ] Dataview (dashboard for drafts vs published)
- [ ] Update build script to ignore `_` prefixed folders

## Notes

- Repo doubles as Obsidian vault — write and publish from the same place
- Site URL: https://yusif-v.github.io/Index/
- Posts go in `posts/` as `.md` files with frontmatter
- `draft: true` in frontmatter = hidden from site but stays in repo
