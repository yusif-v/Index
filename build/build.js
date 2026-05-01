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
  return html.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target, display) => {
      const key = target.trim();
      const text = display ? display.trim() : key;
      const slug =
        titleIndex.byTitle[key] ||
        titleIndex.bySlugifiedTitle[slugify(key)] ||
        (titleIndex.bySlug[slugify(key)] ? slugify(key) : null);
      if (slug) return `<a href="./posts/${slug}.html">${text}</a>`;
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

/** Wrap content in shell template */
function wrapShell(content, options = {}) {
  const shell = readTemplate("shell.html");
  const root = options.root || ".";
  const title = options.title || `${SITE_TITLE}:~$`;
  const description = options.description || SITE_DESCRIPTION;
  const canonical = options.canonical || SITE_URL;
  const ogType = options.ogType || "website";
  return shell
    .replace(/\{\{CONTENT\}\}/g, content)
    .replace(/\{\{PAGE_TITLE\}\}/g, title)
    .replace(/\{\{META_DESCRIPTION\}\}/g, escapeHtml(description))
    .replace(/\{\{CANONICAL\}\}/g, canonical)
    .replace(/\{\{OG_TITLE\}\}/g, escapeHtml(title))
    .replace(/\{\{OG_TYPE\}\}/g, ogType)
    .replace(/\{\{ROOT\}\}/g, root)
    .replace(/\{\{NAV_BLOG\}\}/g, options.nav === "blog" ? "active" : "")
    .replace(/\{\{NAV_ABOUT\}\}/g, options.nav === "about" ? "active" : "")
    .replace(
      /\{\{NAV_PROJECTS\}\}/g,
      options.nav === "projects" ? "active" : "",
    )
    .replace(/\{\{STATUS_FILE\}\}/g, options.statusFile || "index.html");
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

    // Generate TOC from original markdown
    const tocHtml = generateToc(post.body);

    const tagsHtml = post.tags
      .map((t) => `<span class="post-tag">${t}</span>`)
      .join("\n        ");

    const content = postTemplate
      .replace(/\{\{SLUG\}\}/g, post.slug)
      .replace(/\{\{DATE\}\}/g, post.date)
      .replace(/\{\{TAGS_HTML\}\}/g, tagsHtml)
      .replace(/\{\{BODY\}\}/g, bodyHtml)
      .replace(/\{\{TOC\}\}/g, tocHtml)
      .replace(/\{\{ROOT\}\}/g, "..");

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

  const aboutContent = aboutTemplate.replace("{{ABOUT_BODY}}", aboutHtml);
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

  const projectsContent = projectsTemplate.replace(
    "{{PROJECTS_BODY}}",
    projectsHtml,
  );
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

  console.log("\x1b[32m✔ Build complete → dist/\x1b[0m");
}

// ─── Run ──────────────────────────────────────────────────────
build();
