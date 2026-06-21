#!/usr/bin/env node

/**
 * build.js — Static site generator for lizard@web terminal blog
 *
 * Reads markdown posts from /posts, pages from /pages,
 * converts them to HTML with syntax highlighting support,
 * resolves Obsidian [[wikilinks]], and outputs a complete
 * static site to /dist.
 */

const fs = require("fs");
const path = require("path");

// ─── Configuration ────────────────────────────────────────────
const ROOT_DIR = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT_DIR, "posts");
const PAGES_DIR = path.join(ROOT_DIR, "pages");
const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
const CSS_DIR = path.join(ROOT_DIR, "css");
const STATIC_DIR = path.join(ROOT_DIR, "static");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const SITE_URL = "https://yusif-v.github.io/Index";
const SITE_TITLE = "lizard@web";
const SITE_DESCRIPTION =
  "Notes from a cybersecurity engineer — offensive, defensive, and the messy middle.";
const SITE_AUTHOR = "lizard";

// ─── HTB writeup config ────────────────────────────────────────
// Maps the `difficulty` frontmatter value to a 5-dot rank + theme color.
// Color escalates with rank; dots render as ● (filled) / ○ (empty).
const HTB_DIFFICULTY = {
  "very-easy": { rank: 1, color: "green" },
  easy: { rank: 2, color: "cyan" },
  medium: { rank: 3, color: "yellow" },
  hard: { rank: 4, color: "orange" },
  insane: { rank: 5, color: "red" },
};

// ─── Helpers ──────────────────────────────────────────────────

/** Parse YAML-ish frontmatter from markdown string */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) {
      let value = kv[2].trim();
      // Parse YAML arrays: [item1, item2]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      }
      meta[kv[1]] = value;
    }
  }
  return { meta, body: match[2] };
}

/** Convert Obsidian [[wikilinks]] to HTML links.
 *  Resolution order: exact title match → slugified-title match → filename slug.
 *  This way `[[My Post Title]]` resolves regardless of how the file is named. */
function resolveWikilinks(html, titleIndex) {
  // Mask code blocks/spans so `[[example]]` shown as a literal in docs is left alone.
  const stash = [];
  const masked = html.replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/g, (m) => {
    const i = stash.push(m) - 1;
    return `\x00WL${i}\x00`;
  });
  const resolved = masked.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target, display) => {
      const key = target.trim();
      const text = display ? display.trim() : key;
      const slug =
        titleIndex.byTitle[key] ||
        titleIndex.bySlugifiedTitle[slugify(key)] ||
        (titleIndex.bySlug[slugify(key)] ? slugify(key) : null);
      if (slug) return `<a href="./posts/${slug}.html">${escapeHtml(text)}</a>`;
      return `<span class="wikilink-broken" title="unresolved wikilink: ${escapeHtml(key)}">${escapeHtml(text)}</span>`;
    },
  );
  return resolved.replace(/\x00WL(\d+)\x00/g, (m, i) => stash[+i]);
}

/** Convert markdown to HTML (lightweight, no dependencies) */
function markdownToHtml(md) {
  let html = md;

  // Mask code blocks/spans with placeholders BEFORE any line-based regex runs.
  // Otherwise patterns like `^---$` (hr), `^1. ` (ol), `^# ` (heading),
  // `[[wiki]]`, `**bold**`, `*it*` etc. mangle content inside code samples.
  // Restored at the end of this function.
  const codeStash = [];
  // Block placeholder masquerades as a block tag so paragraph-wrap leaves it alone.
  // Inline placeholder masquerades as inline so it sits inside <p>.
  const stashBlock = (rendered) => {
    const i = codeStash.push(rendered) - 1;
    return `\n\n<pre data-stash="${i}"></pre>\n\n`;
  };
  const stashInline = (rendered) => {
    const i = codeStash.push(rendered) - 1;
    return `<code data-stash="${i}"></code>`;
  };

  // Fenced code blocks (```lang ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escaped = escapeHtml(code.replace(/\n$/, ""));
    const langClass = lang ? ` class="language-${lang}"` : "";
    return stashBlock(`<pre><code${langClass}>${escaped}</code></pre>`);
  });

  // Inline code — escape contents (so `<code>` inside doesn't get re-parsed as HTML)
  html = html.replace(/`([^`\n]+)`/g, (m, code) =>
    stashInline(`<code>${escapeHtml(code)}</code>`),
  );

  // Images ![alt](src)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy">',
  );

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings — add id attributes for TOC linking
  html = html.replace(/^(#{1,4}) (.+)$/gm, (match, hashes, text) => {
    const level = hashes.length;
    const id = text
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `<h${level} id="${id}">${text}</h${level}>`;
  });

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, "");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Lists — group consecutive lines into <ul> or <ol> based on the marker.
  // Walk line-by-line so a `- ` block and a `1. ` block don't bleed together.
  {
    const lines = html.split("\n");
    const out = [];
    let kind = null; // "ul" | "ol" | null
    const flush = () => {
      if (kind) {
        out[out.length - 1] = `<${kind}>\n${out[out.length - 1]}\n</${kind}>`;
        kind = null;
      }
    };
    for (const line of lines) {
      const ul = line.match(/^\s*[-*+] (.+)$/);
      const ol = line.match(/^\s*\d+\. (.+)$/);
      if (ul) {
        if (kind && kind !== "ul") flush();
        if (kind === "ul") {
          out[out.length - 1] += `\n<li>${ul[1]}</li>`;
        } else {
          kind = "ul";
          out.push(`<li>${ul[1]}</li>`);
        }
      } else if (ol) {
        if (kind && kind !== "ol") flush();
        if (kind === "ol") {
          out[out.length - 1] += `\n<li>${ol[1]}</li>`;
        } else {
          kind = "ol";
          out.push(`<li>${ol[1]}</li>`);
        }
      } else {
        flush();
        out.push(line);
      }
    }
    flush();
    html = out.join("\n");
  }

  // Tables
  html = html.replace(
    /^(\|.+\|)\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm,
    (match, header, body) => {
      const headerCells = header
        .split("|")
        .filter((c) => c.trim())
        .map((c) => `<th>${c.trim()}</th>`)
        .join("");
      const rows = body
        .trim()
        .split("\n")
        .map((row) => {
          const cells = row
            .split("|")
            .filter((c) => c.trim())
            .map((c) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("\n");
      return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    },
  );

  // Paragraphs: wrap remaining text blocks
  // Split by double newlines, wrap non-tag content in <p>
  const blocks = html.split(/\n{2,}/);
  html = blocks
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      // Don't wrap blocks that already start with HTML block elements
      if (
        /^<(h[1-6]|p|ul|ol|li|pre|blockquote|table|thead|tbody|tr|th|td|hr|img|div|section)[\s>]/i.test(
          block,
        )
      ) {
        return block;
      }
      // Don't wrap if it's only whitespace
      if (!block.replace(/<[^>]*>/g, "").trim()) return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");

  // Restore stashed code placeholders.
  html = html.replace(/<(pre|code) data-stash="(\d+)"><\/\1>/g, (m, _t, i) => codeStash[+i]);

  return html;
}

/** Extract headings from markdown and generate TOC HTML */
function generateToc(markdown) {
  const headings = [];
  const lines = markdown.split("\n");

  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3}) (.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      headings.push({ level, text, id });
    }
  }

  if (headings.length < 2) return "";

  const items = headings
    .map((h) => {
      const cls = h.level === 3 ? ' class="toc-h3"' : "";
      return `          <li${cls}><a href="#${h.id}">${h.text}</a></li>`;
    })
    .join("\n");

  return `
        <nav class="toc">
          <div class="toc-title">Contents</div>
          <ul class="toc-list">
${items}
          </ul>
        </nav>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip HTML tags and collapse whitespace — for meta descriptions */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf-8");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Copy directory recursively */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Render a `{{TOKEN}}` template against a values map.
 *  Uses the callback form of `String.replace` so values containing `$&`, `$1`,
 *  etc. (e.g. inside post bodies) are inserted verbatim instead of being
 *  interpreted as backreferences. */
function renderTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : m,
  );
}

/** Wrap content in shell template */
function wrapShell(content, options = {}) {
  const shell = readTemplate("shell.html");
  const title = options.title || `${SITE_TITLE}:~$`;
  const description = options.description || SITE_DESCRIPTION;
  const canonical = options.canonical || SITE_URL;
  return renderTemplate(shell, {
    CONTENT: content,
    PAGE_TITLE: escapeHtml(title),
    META_DESCRIPTION: escapeHtml(description),
    CANONICAL: canonical,
    OG_TITLE: escapeHtml(title),
    OG_TYPE: options.ogType || "website",
    OG_IMAGE: options.ogImage || `${SITE_URL}/static/og.svg`,
    ROOT: options.root || ".",
    NAV_BLOG: options.nav === "blog" ? "active" : "",
    NAV_CTF: options.nav === "ctf" ? "active" : "",
    NAV_QUIZ: options.nav === "quiz" ? "active" : "",
    NAV_ABOUT: options.nav === "about" ? "active" : "",
    NAV_PROJECTS: options.nav === "projects" ? "active" : "",
    STATUS_FILE: options.statusFile || "index.html",
  });
}

/** Estimate reading time in minutes for a markdown body. 220 wpm is typical
 *  for tech reading; code blocks are excluded since they're scanned not read. */
function readingTime(markdown) {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "");
  const words = stripped.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** RSS 2.0 feed */
function buildRss(posts) {
  const items = posts
    .map((p) => {
      const link = `${SITE_URL}/posts/${p.slug}.html`;
      const pubDate = new Date(`${p.date}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeHtml(p.excerpt || "")}</description>
${(p.tags || []).map((t) => `      <category>${escapeHtml(t)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${escapeHtml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/** sitemap.xml */
function buildSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: today, priority: "1.0" },
    { loc: `${SITE_URL}/ctf.html`, lastmod: today, priority: "0.7" },
    { loc: `${SITE_URL}/quiz.html`, lastmod: today, priority: "0.7" },
    { loc: `${SITE_URL}/about.html`, lastmod: today, priority: "0.6" },
    { loc: `${SITE_URL}/projects.html`, lastmod: today, priority: "0.6" },
    ...posts.map((p) => ({
      loc: `${SITE_URL}/posts/${p.slug}.html`,
      lastmod: p.date,
      priority: "0.8",
    })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>
`;
}

// ─── HTB writeup rendering ────────────────────────────────────

/** Difficulty as 5 colored dots + label, e.g. ●●○○○ medium (yellow) */
function renderDifficulty(level) {
  const spec = HTB_DIFFICULTY[level];
  if (!spec) return escapeHtml(level || "");
  const filled = "●".repeat(spec.rank);
  const empty = "○".repeat(5 - spec.rank);
  return (
    `<span class="htb-dots htb-${spec.color}">` +
    `<span class="htb-dots-filled">${filled}</span>` +
    `<span class="htb-dots-empty">${empty}</span>` +
    `</span> <span class="htb-diff-label">${escapeHtml(level)}</span>`
  );
}

/** Render a list of values as labeled pills */
function renderPillRow(label, values, kind) {
  if (!values || !values.length) return "";
  const pills = values
    .map((v) => `<span class="htb-pill htb-pill-${kind}">${escapeHtml(v)}</span>`)
    .join("");
  return `      <div class="htb-pill-row"><span class="htb-key">${label}</span><span class="htb-val">${pills}</span></div>`;
}

/** Render a single key/value row in the box-info card */
function renderInfoRow(key, valueHtml) {
  if (valueHtml === undefined || valueHtml === null || valueHtml === "")
    return "";
  return `      <div class="htb-row"><span class="htb-key">${key}</span><span class="htb-val">${valueHtml}</span></div>`;
}

/** The dmesg-style box-info card injected at the top of HTB writeups */
function renderHtbCard(post) {
  const rows = [
    renderInfoRow("box", `<span class="htb-box-name">${escapeHtml(post.box || post.title)}</span>`),
    renderInfoRow(
      "os",
      post.os
        ? `<span class="htb-os htb-os-${escapeHtml(post.os)}">${escapeHtml(post.os)}</span>`
        : "",
    ),
    renderInfoRow("difficulty", post.difficulty ? renderDifficulty(post.difficulty) : ""),
    renderInfoRow("points", escapeHtml(post.points || "")),
    renderInfoRow("released", escapeHtml(post.released || "")),
    renderInfoRow("retired", escapeHtml(post.retired || "")),
    renderInfoRow(
      "makers",
      post.makers && post.makers.length
        ? post.makers.map((m) => escapeHtml(m)).join(", ")
        : "",
    ),
    renderInfoRow("ip", post.ip ? `<code>${escapeHtml(post.ip)}</code>` : ""),
  ]
    .filter(Boolean)
    .join("\n");

  const pillRows = [
    renderPillRow("tools", post.tools, "tool"),
    renderPillRow("cves", post.cves, "cve"),
  ]
    .filter(Boolean)
    .join("\n");

  return `<aside class="htb-card" aria-label="box info">
  <div class="htb-card-head">
    <span class="prompt">$</span>
    <span class="cmd">cat</span>
    <span class="flag">box.info</span>
  </div>
  <div class="htb-card-body">
${rows}
${pillRows ? `      <div class="htb-divider" aria-hidden="true"></div>\n${pillRows}` : ""}
  </div>
</aside>
`;
}

/** Render a `<li class="post-item">` list. `root` is the relative path
 *  from the listing page back to the site root (`.` for /index.html). */
function renderPostList(posts, root) {
  return posts
    .map((post) => {
      const tagsHtml = post.tags
        .map((t) => `<span class="post-tag">${escapeHtml(t)}</span>`)
        .join("\n                ");
      const chip = renderHtbChip(post);
      return `
          <li class="post-item">
            <a class="post-link" href="${root}/posts/${post.slug}.html">
              <div class="post-meta">
                <span class="post-date">${post.date}</span>
                ${chip}
                ${tagsHtml}
              </div>
              <div class="post-title">${escapeHtml(post.title)}</div>
              <div class="post-excerpt">${escapeHtml(post.excerpt)}</div>
            </a>
          </li>`;
    })
    .join("\n");
}

/** Compact chip shown next to the date on listings — `[HTB · easy · linux]` */
function renderHtbChip(post) {
  if (post.type !== "htb") return "";
  const spec = HTB_DIFFICULTY[post.difficulty];
  const color = spec ? `htb-${spec.color}` : "";
  const parts = ["HTB", post.difficulty, post.os].filter(Boolean);
  return `<span class="htb-chip ${color}">[${parts.map(escapeHtml).join(" · ")}]</span>`;
}

// ─── Build ────────────────────────────────────────────────────

function build() {
  console.log("\x1b[32m⚡ Building site...\x1b[0m");

  // Clean dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, "posts"));

  // Copy static assets
  copyDir(CSS_DIR, path.join(DIST_DIR, "css"));
  copyDir(STATIC_DIR, path.join(DIST_DIR, "static"));

  // ── Read all posts ──────────────────────────────────────
  const postFiles = fs.existsSync(POSTS_DIR)
    ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  const posts = postFiles.map((filename) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const slug = path
      .basename(filename, ".md")
      .toLowerCase()
      .replace(/\s+/g, "-");
    const asArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    return {
      slug,
      title: meta.title || slug,
      date: meta.date || "1970-01-01",
      tags: asArr(meta.tags),
      excerpt: meta.excerpt || "",
      draft: meta.draft === "true" || meta.draft === true,
      // HTB-writeup frontmatter (only used when type === "htb")
      type: meta.type || "post",
      box: meta.box || "",
      os: meta.os || "",
      difficulty: meta.difficulty || "",
      points: meta.points || "",
      released: meta.released || "",
      retired: meta.retired || "",
      makers: asArr(meta.makers),
      ip: meta.ip || "",
      tools: asArr(meta.tools),
      cves: asArr(meta.cves),
      body,
    };
  });

  // Filter out drafts and sort by date (newest first)
  const publishedPosts = posts
    .filter((p) => !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Build a title→slug index so wikilinks resolve by post title, not filename.
  const titleIndex = {
    byTitle: {},
    bySlugifiedTitle: {},
    bySlug: {},
  };
  for (const p of publishedPosts) {
    titleIndex.byTitle[p.title] = p.slug;
    titleIndex.bySlugifiedTitle[slugify(p.title)] = p.slug;
    titleIndex.bySlug[p.slug] = p.slug;
  }

  console.log(
    `  Found ${publishedPosts.length} post(s), ${posts.length - publishedPosts.length} draft(s)`,
  );

  // ── Build individual post pages ─────────────────────────
  const postTemplate = readTemplate("post.html");

  for (const post of publishedPosts) {
    let bodyHtml = markdownToHtml(post.body);

    // Resolve image paths: relative to /static/images/
    bodyHtml = bodyHtml.replace(
      /src="(?!https?:\/\/)(?!\/)(.*?)"/g,
      'src="../static/images/$1"',
    );

    // Resolve Obsidian wikilinks
    bodyHtml = resolveWikilinks(bodyHtml, titleIndex);

    // HTB writeup: inject the box-info card at the top
    if (post.type === "htb") {
      bodyHtml = renderHtbCard(post) + bodyHtml;
    }

    // Generate TOC from original markdown
    const tocHtml = generateToc(post.body);

    const tagsHtml = post.tags
      .map((t) => `<span class="post-tag">${t}</span>`)
      .join("\n        ");

    const minutes = readingTime(post.body);
    const content = renderTemplate(postTemplate, {
      SLUG: post.slug,
      DATE: post.date,
      TAGS_HTML: tagsHtml,
      BODY: bodyHtml,
      TOC: tocHtml,
      ROOT: "..",
      READING_TIME: `${minutes} min read`,
      TITLE: escapeHtml(post.title),
    });

    const page = wrapShell(content, {
      title: `${post.title} — ${SITE_TITLE}`,
      description:
        post.excerpt || stripHtml(bodyHtml).slice(0, 160) || SITE_DESCRIPTION,
      canonical: `${SITE_URL}/posts/${post.slug}.html`,
      ogType: "article",
      nav: "blog",
      root: "..",
      statusFile: `posts/${post.slug}.md`,
    });

    fs.writeFileSync(path.join(DIST_DIR, "posts", `${post.slug}.html`), page);
    console.log(`  ✓ posts/${post.slug}.html`);
  }

  // ── Build home page (blog index) ───────────────────────
  const homeTemplate = readTemplate("home.html");

  let postListHtml = "";
  if (publishedPosts.length === 0) {
    postListHtml =
      '<li class="post-no-results"><span class="prompt">$</span> No posts yet. Check back soon.</li>';
  } else {
    postListHtml = renderPostList(publishedPosts, ".");
  }

  const homeContent = renderTemplate(homeTemplate, { POST_LIST: postListHtml });
  const homePage = wrapShell(homeContent, {
    title: `${SITE_TITLE}:~$ — blog`,
    description: SITE_DESCRIPTION,
    canonical: `${SITE_URL}/`,
    nav: "blog",
    root: ".",
    statusFile: "index.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "index.html"), homePage);
  console.log("  ✓ index.html");

  // ── Build about page ───────────────────────────────────
  const aboutTemplate = readTemplate("about.html");
  const aboutMd = fs.readFileSync(path.join(PAGES_DIR, "about.md"), "utf-8");
  const { body: aboutBody } = parseFrontmatter(aboutMd);
  const aboutHtml = markdownToHtml(aboutBody);

  const aboutContent = renderTemplate(aboutTemplate, { ABOUT_BODY: aboutHtml });
  const aboutPage = wrapShell(aboutContent, {
    title: `About — ${SITE_TITLE}`,
    description: `About ${SITE_AUTHOR} — ${SITE_DESCRIPTION}`,
    canonical: `${SITE_URL}/about.html`,
    nav: "about",
    root: ".",
    statusFile: "about.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "about.html"), aboutPage);
  console.log("  ✓ about.html");

  // ── Build projects page ────────────────────────────────
  const projectsTemplate = readTemplate("projects.html");
  const projectsMd = fs.readFileSync(
    path.join(PAGES_DIR, "projects.md"),
    "utf-8",
  );
  const { body: projectsBody } = parseFrontmatter(projectsMd);
  const projectsHtml = markdownToHtml(projectsBody);

  const projectsContent = renderTemplate(projectsTemplate, {
    PROJECTS_BODY: projectsHtml,
  });
  const projectsPage = wrapShell(projectsContent, {
    title: `Projects — ${SITE_TITLE}`,
    description: `Projects by ${SITE_AUTHOR}`,
    canonical: `${SITE_URL}/projects.html`,
    nav: "projects",
    root: ".",
    statusFile: "projects.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "projects.html"), projectsPage);
  console.log("  ✓ projects.html");

  // ── CTF index page (HTB writeups only) ─────────────────
  const htbPosts = publishedPosts.filter((p) => p.type === "htb");
  const ctfTemplate = readTemplate("ctf.html");
  const ctfList =
    htbPosts.length === 0
      ? '<li class="post-no-results"><span class="prompt">$</span> No writeups yet.</li>'
      : renderPostList(htbPosts, ".");
  const ctfContent = renderTemplate(ctfTemplate, {
    CTF_LIST: ctfList,
    CTF_COUNT: String(htbPosts.length),
  });
  const ctfPage = wrapShell(ctfContent, {
    title: `Writeups — ${SITE_TITLE}`,
    description: `HackTheBox writeups by ${SITE_AUTHOR}.`,
    canonical: `${SITE_URL}/ctf.html`,
    nav: "ctf",
    root: ".",
    statusFile: "ctf.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "ctf.html"), ctfPage);
  console.log(`  ✓ ctf.html (${htbPosts.length} writeup${htbPosts.length === 1 ? "" : "s"})`);

  // ── Build quiz page ────────────────────────────────────
  const quizTemplate = readTemplate("quiz.html");
  const quizPage = wrapShell(quizTemplate, {
    title: `Quiz — ${SITE_TITLE}`,
    description: `Encrypted quiz — enter passphrase to begin.`,
    canonical: `${SITE_URL}/quiz.html`,
    nav: "quiz",
    root: ".",
    statusFile: "quiz.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "quiz.html"), quizPage);
  console.log("  ✓ quiz.html");

  // Copy questions.enc into dist
  const encSrc = path.join(ROOT_DIR, "quiz", "questions.enc");
  if (fs.existsSync(encSrc)) {
    fs.copyFileSync(encSrc, path.join(DIST_DIR, "questions.enc"));
    console.log("  ✓ questions.enc");
  }

  // ── Feeds & discovery ──────────────────────────────────
  fs.writeFileSync(path.join(DIST_DIR, "feed.xml"), buildRss(publishedPosts));
  console.log("  ✓ feed.xml");

  fs.writeFileSync(
    path.join(DIST_DIR, "sitemap.xml"),
    buildSitemap(publishedPosts),
  );
  console.log("  ✓ sitemap.xml");

  fs.writeFileSync(
    path.join(DIST_DIR, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  );
  console.log("  ✓ robots.txt");

  // ── 404 page (GitHub Pages serves /404.html for missing routes) ─
  const notFoundContent = `
    <section class="section page-enter">
      <div class="section-header">
        <span class="prompt">lizard@web:~$</span>
        <span class="cmd">cat</span>
        <span class="flag">${escapeHtml(SITE_TITLE)}/$_PATH</span>
      </div>
      <div class="post-body" style="max-width:none">
        <pre style="background:none;border:none;padding:0;margin:0;color:var(--red);">cat: $_PATH: No such file or directory</pre>
        <p style="margin-top:1rem;color:var(--text-dim)">The page you're looking for either moved, never existed, or got <em>rm -rf</em>'d. Pick a known-good path:</p>
        <ul>
          <li><a href="/">~/posts</a> — the blog index</li>
          <li><a href="/ctf.html">~/writeups</a> — HTB writeups</li>
          <li><a href="/quiz.html">~/quiz</a></li>
          <li><a href="/about.html">~/about</a></li>
          <li><a href="/projects.html">~/projects</a></li>
        </ul>
      </div>
    </section>
  `;
  const notFoundPage = wrapShell(notFoundContent, {
    title: `404 — ${SITE_TITLE}`,
    description: "Page not found.",
    canonical: `${SITE_URL}/404.html`,
    nav: "",
    root: ".",
    statusFile: "404.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "404.html"), notFoundPage);
  console.log("  ✓ 404.html");

  // ── Open Graph image (SVG, no deps) ────────────────────
  const og = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0e14"/>
  <g font-family="JetBrains Mono, monospace" fill="#00ff9c">
    <text x="80" y="180" font-size="72" font-weight="700">lizard@web:~$ _</text>
    <text x="80" y="290" font-size="36" fill="#c9d1d9">${escapeHtml(SITE_DESCRIPTION)}</text>
    <text x="80" y="540" font-size="24" fill="#8b949e">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</text>
  </g>
</svg>
`;
  ensureDir(path.join(DIST_DIR, "static"));
  fs.writeFileSync(path.join(DIST_DIR, "static", "og.svg"), og);
  console.log("  ✓ static/og.svg");

  console.log("\x1b[32m✔ Build complete → dist/\x1b[0m");
}

// ─── Run ──────────────────────────────────────────────────────
build();
