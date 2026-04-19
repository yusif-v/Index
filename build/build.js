#!/usr/bin/env node

/**
 * build.js — Static site generator for yusif@web terminal blog
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

/** Convert Obsidian [[wikilinks]] to HTML links */
function resolveWikilinks(html, allSlugs) {
  // [[Page Name]] → link to post if it exists
  // [[Page Name|Display Text]] → link with custom text
  return html.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target, display) => {
      const slug = slugify(target.trim());
      const text = display ? display.trim() : target.trim();
      if (allSlugs.includes(slug)) {
        return `<a href="./posts/${slug}.html">${text}</a>`;
      }
      // If no matching post, render as plain text with a dim style
      return `<span class="comment">${text}</span>`;
    },
  );
}

/** Convert markdown to HTML (lightweight, no dependencies) */
function markdownToHtml(md) {
  let html = md;

  // Fenced code blocks (```lang ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    const langClass = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${langClass}>${escaped}</code></pre>`;
  });

  // Inline code (but not inside <pre>)
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Images ![alt](src)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy">',
  );

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

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

  // Unordered lists
  html = html.replace(/^(\s*)[-*+] (.+)$/gm, (match, indent, content) => {
    return `<li>${content}</li>`;
  });
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

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

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/** Wrap content in shell template */
function wrapShell(content, options = {}) {
  const shell = readTemplate("shell.html");
  const root = options.root || ".";
  return shell
    .replace(/\{\{CONTENT\}\}/g, content)
    .replace(/\{\{PAGE_TITLE\}\}/g, options.title || "lizard@web:~$")
    .replace(/\{\{ROOT\}\}/g, root)
    .replace(/\{\{NAV_BLOG\}\}/g, options.nav === "blog" ? "active" : "")
    .replace(/\{\{NAV_ABOUT\}\}/g, options.nav === "about" ? "active" : "")
    .replace(
      /\{\{NAV_PROJECTS\}\}/g,
      options.nav === "projects" ? "active" : "",
    )
    .replace(/\{\{STATUS_FILE\}\}/g, options.statusFile || "index.html");
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
    return {
      slug,
      title: meta.title || slug,
      date: meta.date || "1970-01-01",
      tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
      excerpt: meta.excerpt || "",
      draft: meta.draft === "true" || meta.draft === true,
      body,
    };
  });

  // Filter out drafts and sort by date (newest first)
  const publishedPosts = posts
    .filter((p) => !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));

  const allSlugs = publishedPosts.map((p) => p.slug);

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
    bodyHtml = resolveWikilinks(bodyHtml, allSlugs);

    const tagsHtml = post.tags
      .map((t) => `<span class="post-tag">${t}</span>`)
      .join("\n        ");

    const content = postTemplate
      .replace(/\{\{SLUG\}\}/g, post.slug)
      .replace(/\{\{DATE\}\}/g, post.date)
      .replace(/\{\{TAGS_HTML\}\}/g, tagsHtml)
      .replace(/\{\{BODY\}\}/g, bodyHtml)
      .replace(/\{\{ROOT\}\}/g, "..");

    const page = wrapShell(content, {
      title: `${post.title} — lizard@web`,
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
    postListHtml = publishedPosts
      .map((post) => {
        const tagsHtml = post.tags
          .map((t) => `<span class="post-tag">${t}</span>`)
          .join("\n                ");
        return `
          <li class="post-item">
            <a class="post-link" href="./posts/${post.slug}.html">
              <div class="post-meta">
                <span class="post-date">${post.date}</span>
                ${tagsHtml}
              </div>
              <div class="post-title">${post.title}</div>
              <div class="post-excerpt">${post.excerpt}</div>
            </a>
          </li>`;
      })
      .join("\n");
  }

  const homeContent = homeTemplate.replace("{{POST_LIST}}", postListHtml);
  const homePage = wrapShell(homeContent, {
    title: "lizard@web:~$ — blog",
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

  const aboutContent = aboutTemplate.replace("{{ABOUT_BODY}}", aboutHtml);
  const aboutPage = wrapShell(aboutContent, {
    title: "About — lizard@web",
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

  const projectsContent = projectsTemplate.replace(
    "{{PROJECTS_BODY}}",
    projectsHtml,
  );
  const projectsPage = wrapShell(projectsContent, {
    title: "Projects — lizard@web",
    nav: "projects",
    root: ".",
    statusFile: "projects.html",
  });
  fs.writeFileSync(path.join(DIST_DIR, "projects.html"), projectsPage);
  console.log("  ✓ projects.html");

  console.log("\x1b[32m✔ Build complete → dist/\x1b[0m");
}

// ─── Run ──────────────────────────────────────────────────────
build();
