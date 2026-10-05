// 首页逻辑：加载文章清单，渲染卡片，支持标签筛选

const GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #30cfd0, #330867)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)",
];

const grid = document.getElementById("postGrid");
const filters = document.getElementById("filters");

let posts = [];
let activeTag = "全部";

function tagClass(tag) {
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `tag-${hash % 5}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function renderFilters() {
  const tags = ["全部", ...new Set(posts.flatMap((p) => p.tags || []))];
  filters.innerHTML = tags
    .map(
      (t) =>
        `<button class="chip${t === activeTag ? " active" : ""}" data-tag="${t}">${t}</button>`
    )
    .join("");
  filters.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      activeTag = chip.dataset.tag;
      renderFilters();
      renderPosts();
    })
  );
}

function renderPosts() {
  const list = posts
    .filter((p) => activeTag === "全部" || (p.tags || []).includes(activeTag))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!list.length) {
    grid.innerHTML = `<div class="empty">这个标签下还没有文章。</div>`;
    return;
  }

  grid.innerHTML = list
    .map((p, i) => {
      const gradient = GRADIENTS[i % GRADIENTS.length];
      const char = (p.title || "文")[0];
      const tags = (p.tags || [])
        .map((t) => `<span class="tag ${tagClass(t)}">${t}</span>`)
        .join("");
      return `
        <a class="card" href="post.html?p=${encodeURIComponent(p.slug)}">
          <div class="card-cover" style="background: ${gradient}">
            <span class="card-cover-char">${char}</span>
          </div>
          <div class="card-body">
            <h2 class="card-title">${p.title}</h2>
            <p class="card-summary">${p.summary || ""}</p>
            <div class="card-meta">
              <time>${fmtDate(p.date)}</time>
              ${tags}
            </div>
          </div>
        </a>`;
    })
    .join("");
}

async function init() {
  try {
    const res = await fetch("posts/index.json");
    if (!res.ok) throw new Error(res.status);
    posts = await res.json();
    renderFilters();
    renderPosts();
  } catch (e) {
    grid.innerHTML = `<div class="empty">文章清单加载失败。本地预览请用 <code>python -m http.server</code> 启动服务后再访问。</div>`;
  }
}

init();
