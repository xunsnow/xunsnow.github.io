// 文章页逻辑：按 ?p=slug 加载 Markdown，渲染标题 / 元信息 / 上下篇导航

const header = document.getElementById("postHeader");
const content = document.getElementById("postContent");
const pager = document.getElementById("postPager");
const progressBar = document.getElementById("progressBar");

const slug = new URLSearchParams(location.search).get("p");

function tagClass(tag) {
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `tag-${hash % 5}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function renderPager(posts, idx) {
  const prev = posts[idx - 1]; // 清单按日期倒序后，idx-1 是更新的
  const next = posts[idx + 1];
  const link = (p, cls, label) =>
    `<a class="pager-link ${cls}" href="post.html?p=${encodeURIComponent(p.slug)}">
       <span class="pager-label">${label}</span>
       <span class="pager-title">${p.title}</span>
     </a>`;
  pager.innerHTML =
    (prev ? link(prev, "", "← 上一篇") : `<div class="pager-empty"></div>`) +
    (next ? link(next, "next", "下一篇 →") : `<div class="pager-empty"></div>`);
}

async function init() {
  if (!slug) {
    header.innerHTML = `<div class="empty">缺少文章参数，<a href="index.html">返回首页</a>。</div>`;
    return;
  }

  try {
    const [mdRes, listRes] = await Promise.all([
      fetch(`posts/${encodeURIComponent(slug)}.md`),
      fetch("posts/index.json"),
    ]);
    if (!mdRes.ok) throw new Error("not found");

    const md = await mdRes.text();
    const posts = listRes.ok ? await listRes.json() : [];
    const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
    const idx = sorted.findIndex((p) => p.slug === slug);
    const meta = idx >= 0 ? sorted[idx] : null;

    content.innerHTML = marked.parse(md);
    content.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el));

    // 标题：优先用清单里的，否则取 Markdown 第一个 # 标题
    const firstH1 = content.querySelector("h1");
    const title = meta?.title || firstH1?.textContent || slug;
    if (firstH1) firstH1.remove(); // 避免标题重复
    document.title = `${title} — Xunsnow's Blog`;

    const tags = (meta?.tags || [])
      .map((t) => `<span class="tag ${tagClass(t)}">${t}</span>`)
      .join("");
    header.innerHTML = `
      <h1 class="post-title">${title}</h1>
      <div class="post-meta">
        ${meta?.date ? `<time>${fmtDate(meta.date)}</time>` : ""}
        ${tags}
      </div>`;

    if (sorted.length > 1 && idx >= 0) renderPager(sorted, idx);
  } catch {
    header.innerHTML = `<div class="empty">文章不存在或加载失败，<a href="index.html">返回首页</a>。</div>`;
  }
}

// 阅读进度条
window.addEventListener("scroll", () => {
  const h = document.documentElement;
  const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
  progressBar.style.width = `${pct}%`;
});

init();
