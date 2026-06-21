---
title: Projects
---

A selection of things I've built and put on GitHub. Mostly tooling — small, focused, dependency-light.

## 🔐 Security & DFIR

### Mimir

DFIR shell and tool multiplexer. Written in Go. Single binary, zero dependencies — turns any server into a DFIR lab. Local-first (binaries to `~/.mimir/bin`), Docker fallback for heavy deps.

- **Repo:** [github.com/yusif-v/Mimir](https://github.com/yusif-v/Mimir)
- **Stack:** Go, Docker
- **Status:** active development

### PI-Bench

Prompt injection benchmark for local LLMs (via Ollama) — 200+ adversarial payloads across 7 attack categories, automated leak detection, ASR scoring, and publication-ready charts.

- **Repo:** [github.com/yusif-v/PI-Bench](https://github.com/yusif-v/PI-Bench)
- **Stack:** Python, Ollama

### Quizterm

Exam-agnostic terminal quiz bot. Loads JSON question files and drills you with a colored TUI. Five modes: all, by chapter, random N, wrong-answers-only, stats. Persistent history per question file.

- **Repo:** [github.com/yusif-v/Quizterm](https://github.com/yusif-v/Quizterm)
- **Stack:** Python, Rich
- **Try it:** [quiz.html](/quiz.html) — web quiz (passphrase required)

## 🌐 Web & Platforms

### Openwave

Nərimanov Real-Time Incident & Coordination Platform. Next.js 15 + Prisma + Leaflet. Built for coordinating incident response with real-time mapping and team communication.

- **Repo:** [github.com/yusif-v/openwave](https://github.com/yusif-v/openwave)
- **Stack:** Next.js 15, Prisma, Leaflet

### lizard@web

This site. A terminal-themed static blog built from scratch — zero npm dependencies, a single Node script (~500 lines) that compiles markdown to HTML, deployed to GitHub Pages on push.

- **Repo:** [github.com/yusif-v/Index](https://github.com/yusif-v/Index)
- **Stack:** Node.js (stdlib only), GitHub Actions, GitHub Pages
- **Writeup:** [Building This Terminal Blog with Markdown and GitHub Actions](./posts/building-this-terminal-blog.html)

## 🤖 AI & Knowledge

### LLM-Wiki

Open-source template for building LLM-powered knowledge bases following Karpathy's LLM Wiki pattern. Drop raw sources into an inbox, let Claude write the structured, interlinked wiki pages. Plain markdown, stdlib-only Python tooling, optional Obsidian dashboard.

- **Repo:** [github.com/yusif-v/LLM-Wiki](https://github.com/yusif-v/LLM-Wiki)
- **Stack:** Markdown, Python (stdlib), Claude Code, Obsidian + Dataview (optional)
- **Writeup:** [The LLM Wiki — Karpathy's Pattern for a Self-Compiling Knowledge Base](./posts/llm-wiki.html)

## 🛠️ Developer Tools

### Blueprint

Personal terminal bootstrap that turns a fresh machine into a fully configured development environment in one command. Installs the tools I rely on, sets up the shell, fonts, and editor, and deploys dotfiles for a consistent, ready-to-work setup anywhere.

- **Repo:** [github.com/yusif-v/Blueprint](https://github.com/yusif-v/Blueprint)
- **Stack:** Shell, Dotfiles

### codecrafters-go

A series of from-scratch implementations in Go — Redis, grep, shell, and Claude Code. Each one built to understand the internals.

- **Redis:** [github.com/yusif-v/codecrafters-redis-go](https://github.com/yusif-v/codecrafters-redis-go)
- **Shell:** [github.com/yusif-v/codecrafters-shell-go](https://github.com/yusif-v/codecrafters-shell-go)
- **Grep:** [github.com/yusif-v/codecrafters-grep-go](https://github.com/yusif-v/codecrafters-grep-go)
- **Claude Code:** [github.com/yusif-v/codecrafters-claude-code-go](https://github.com/yusif-v/codecrafters-claude-code-go)

## 🎨 Experiments

### Hermes

Braille pixel art and ASCII art experiments.

- **Repo:** [github.com/yusif-v/Hermes](https://github.com/yusif-v/Hermes)

---

More in progress. If you want to see something earlier than it lands here, my [GitHub](https://github.com/yusif-v) is the source of truth.
