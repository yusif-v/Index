---
title: The LLM Wiki — Karpathy's Pattern for a Self-Compiling Knowledge Base
date: 2026-05-11
tags: [llm, knowledge-management, obsidian, claude-code, tooling]
excerpt: Andrej Karpathy proposed using an LLM as the compiler for a personal wiki — you drop raw material in, it writes the structured, interlinked pages. I built a template for it. Here's the idea, why it works, and what changes when your notes write themselves.
---

## The problem with personal knowledge bases

Every few years I rebuild my notes from scratch. Obsidian, Notion, Logseq, plain folders of markdown — the tool isn't the bottleneck. The bottleneck is the labor between *reading something interesting* and *having a clean, linked, retrievable note about it*.

That labor has two parts. The first is summarizing: extracting the load-bearing ideas from a paper, a repo, an article, a 90-minute talk. The second is **linking**: noticing this concept overlaps with something I wrote about six months ago, finding the page, adding a wikilink in both directions, maybe writing a synthesis. Both parts are mostly cognitive janitorial work. And both parts are exactly what LLMs are good at.

The wiki I'd actually use doesn't exist not because the tools are bad, but because I don't want to spend two hours linting my own notes after every paper.

## Karpathy's idea

In [a tweet](https://x.com/karpathy/status/1756380066580455557), Andrej Karpathy floated a deceptively simple framing: treat the LLM as the **compiler** of your wiki. You drop raw material — papers, repos, articles, screenshots — into an inbox. The LLM compiles each source into a structured page: summary, key concepts, entities, links. As more sources arrive, the LLM updates the existing pages: adding citations, merging duplicates, surfacing patterns across sources, flagging contradictions.

The wiki is *output*, not input. You don't curate it — you curate the raw inbox and let the model produce the curated graph.

That reframing matters because it inverts where the human effort lives. In a traditional wiki, you write the pages and the structure emerges from your discipline. In an LLM wiki, the structure emerges from the *compilation rules* you give the model — and the structure stays consistent across hundreds of sources, because the same rules apply every time.

## Why this works now and didn't a year ago

Three things changed:

- **Context windows got long enough** to fit a whole wiki folder. Claude can read every existing page before writing a new one, which means new pages cite existing concepts instead of inventing duplicates.
- **Markdown agents got good enough.** Tools like Claude Code can read, write, and *modify* files in place — not just generate text. The wiki edits itself.
- **Wikilinks are a perfect protocol.** `[[double brackets]]` are plain text, so the LLM can write them; they're parseable, so tools can lint them; they're rendered by Obsidian, so a human can browse the result.

The combination is what makes the LLM-as-compiler pattern work in 2026 and not in 2024.

## What I built

[**LLM-Wiki**](https://github.com/yusif-v/LLM-Wiki) is an open-source template — a vault skeleton plus a handful of Python stdlib tools and Claude Code prompt templates. No framework, no API keys hardcoded, no vector DB. The whole thing is markdown files and ~200 lines of Python.

The vault is split into three top-level dirs:

```
raw/          ← input: papers, articles, repos, datasets, images
wiki/         ← output: the compiled, interlinked knowledge base
outputs/      ← derivatives: research-question answers, slide decks
```

And `wiki/` itself has a deliberate shape:

- `sources/` — one page per raw input (a paper, a repo). Summary + extracted concepts.
- `concepts/` — abstract ideas, techniques, patterns (e.g. `[[mixture-of-experts]]`).
- `entities/` — concrete things: people, papers, tools, companies.
- `syntheses/` — comparisons and cross-concept analyses ("MoE vs. dense models").
- `maps/` — thematic overviews, MOCs (Maps of Content).
- `_index.md`, `_meta.md`, `log.md` — the wiki's metadata layer.

The distinction between *sources*, *concepts*, *entities*, and *syntheses* is the most important design decision in the whole template. It tells the model *where* a piece of information belongs and *what voice* to use. Source pages are descriptive — they summarize what the author said. Concept pages are normative — they describe what the idea *is*, across sources. Syntheses are argumentative — they make claims that span multiple sources.

Without that separation, you get one big pile of summaries.

## The compile loop

To add a paper, I drop the PDF into `raw/papers/attention-is-all-you-need.pdf` and say to Claude:

```
compile wiki/sources/attention-is-all-you-need.md from raw/papers/attention-is-all-you-need.pdf
```

Claude reads `_prompts/compile-source.md`, which tells it to:

1. Write the source summary (`sources/<slug>.md`).
2. Extract any new concepts or entities — create or update their pages.
3. Add this source as a citation on every concept/entity page it touches.
4. Add the new page to `_index.md`.
5. Append to `log.md` with a timestamp.

The wiki edits itself in five places from one input. That's the whole pitch.

## Health is a measurable property

A wiki rots when links break, pages drift out of sync, or new sources get dropped without updating the index. The template includes a Python linter — `tools/lint.py` — that reports:

- Dead wikilinks (a page references `[[foo]]` but `foo.md` doesn't exist)
- Unsummarized raw files (a file in `raw/` with no `sources/<slug>.md`)
- Orphan pages (in `wiki/` with no incoming links)
- Low-confidence pages (the `confidence: low` field — speculative claims that need more sources)

The output is plain text. You pipe it back to Claude with `_prompts/lint-check.md`, and the model updates `wiki/_meta.md` with a health score and a punch list of things to fix. Run it weekly. The wiki stays clean.

## Confidence levels matter more than they sound

Every concept, entity, and synthesis page carries a `confidence` field: `high`, `medium`, or `low`. `high` means multiple corroborating sources. `medium` means one source. `low` means speculative — usually a synthesis that hasn't been grounded yet.

This is the cheapest possible defense against the failure mode everyone fears: the model writing confident-sounding nonsense and you treating it as fact six months later. If the page says `confidence: low`, you know it's a working hypothesis, not a citation-worthy claim.

I treat `low`-confidence pages the way I treat TODO comments: useful for thinking, dangerous to leave around forever.

## What it's like to use

Different from any notes setup I've had before. A few things I didn't expect:

**The wiki gets *denser* as I add sources, not just bigger.** When I add a new paper on retrieval-augmented generation, Claude doesn't just write a new page — it finds the three existing pages where RAG is mentioned and adds the new citation there too. The graph thickens.

**I write differently in `raw/articles/`.** Knowing that my own notes will be compiled into the wiki, I write more honestly in the rough drafts. The output page is for clean structure; the raw page is for thinking out loud. The separation freed me up.

**Search via grep is mostly enough.** I expected to need embeddings. I don't — `tools/search.py` does plain full-text search across the vault, and because the LLM has already normalized terminology across sources, the same word usually appears wherever it's relevant. Embeddings would be marginal for the size of vault I have.

**Obsidian's Dataview plugin is the killer view layer.** The template ships a `dashboard.md` with live queries: low-confidence pages, recently updated, orphan check, source-count rankings. Browsing the wiki in Obsidian feels like reading a database with a markdown interface.

## What this is and isn't

It's not a search engine. It's not a RAG pipeline. It's not a chatbot wrapper. It's a *template for a long-lived knowledge base* where an LLM does the librarian work, and the artifact is plain markdown that I'd still own if every AI tool disappeared tomorrow.

The whole vault is portable. The tools are stdlib-only Python. The prompts are checked into the repo and editable. If you change LLMs, you change one or two prompt files. If you walk away from Claude Code, you have a directory of well-linked markdown.

That portability is the point. The LLM is a compiler — and compilers are interchangeable.

## Try it

The template is on GitHub: [yusif-v/LLM-Wiki](https://github.com/yusif-v/LLM-Wiki). It's MIT-style — clone it, replace the example sources, point Claude Code at the prompt files, and you have a working LLM wiki in under five minutes.

I'd love feedback on the prompt templates especially. The compile prompt is the heart of the system, and I suspect it can get much sharper. If you build something on top of this, tell me — I'll add it to the README.

Karpathy's framing was the unlock. The rest is just plumbing.
