"use strict";

// ================= 基本参数 =================
const TILE = 32;
const COLS = 30;
const ROWS = 20;
const W = COLS * TILE;  // 960
const H = ROWS * TILE;  // 640

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// 地块类型
const T = { GRASS: 0, WALL: 1, TREE: 2, SIGN: 3 };

// 迷宫区域（含边界墙，宽高必须为奇数）
const RX = 5, RY = 3, RW = 19, RH = 15;
const ENTRANCE = [14, RY + RH - 1]; // 南侧入口
const GOAL = [2, 1];                // 终点在外面的草地上

// ================= 地图生成 =================
const grid = [];
for (let y = 0; y < ROWS; y++) {
  grid.push(
    Array.from({ length: COLS }, (_, x) =>
      x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? T.TREE : T.GRASS
    )
  );
}

// 迷宫区域先全部填墙
for (let y = RY; y < RY + RH; y++)
  for (let x = RX; x < RX + RW; x++) grid[y][x] = T.WALL;

// 回溯法在内部格子架上挖一个"完美迷宫"：处处连通，但除了入口没有任何出口
const CXN = (RW - 1) / 2; // 9 列
const CYN = (RH - 1) / 2; // 7 行
const cellAt = (cx, cy) => [RX + 1 + 2 * cx, RY + 1 + 2 * cy];
const visited = Array.from({ length: CYN }, () => Array(CXN).fill(false));
const stack = [[4, 6]]; // 入口下方的格子出发
visited[6][4] = true;
{
  const [sx, sy] = cellAt(4, 6);
  grid[sy][sx] = T.GRASS;
}
while (stack.length) {
  const [cx, cy] = stack[stack.length - 1];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < CXN && ny < CYN && !visited[ny][nx]);
  if (!dirs.length) { stack.pop(); continue; }
  const [nx, ny, dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
  const [x1, y1] = cellAt(cx, cy);
  grid[y1 + dy][x1 + dx] = T.GRASS; // 打通两格之间的墙
  const [x2, y2] = cellAt(nx, ny);
  grid[y2][x2] = T.GRASS;
  visited[ny][nx] = true;
  stack.push([nx, ny]);
}
// 打开入口
grid[ENTRANCE[1]][ENTRANCE[0]] = T.GRASS;

// 用 BFS 找迷宫里离入口最远的格子，放只史莱姆钓玩家往里走
function farthestCell(sx, sy) {
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  const q = [[sx, sy]];
  dist[sy][sx] = 0;
  let far = [sx, sy];
  while (q.length) {
    const [x, y] = q.shift();
    if (dist[y][x] > dist[far[1]][far[0]]) far = [x, y];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= RX && ny >= RY && nx < RX + RW && ny < RY + RH &&
          grid[ny][nx] === T.GRASS && dist[ny][nx] < 0) {
        dist[ny][nx] = dist[y][x] + 1;
        q.push([nx, ny]);
      }
    }
  }
  return far;
}
const MONSTER = farthestCell(ENTRANCE[0], ENTRANCE[1] - 1);

// 入口旁立个木牌（实心，凑近触发对话）
const SIGN = [16, 18];
grid[SIGN[1]][SIGN[0]] = T.SIGN;

// 草地上撒点装饰花
const flowers = [];
for (let i = 0; i < 40; i++) {
  const x = 1 + Math.floor(Math.random() * (COLS - 2));
  const y = 1 + Math.floor(Math.random() * (ROWS - 2));
  if (grid[y][x] === T.GRASS &&
      !(x >= RX - 1 && x <= RX + RW && y >= RY - 1 && y <= RY + RH) &&
      Math.hypot(x - 14, y - 18) > 3 && Math.hypot(x - GOAL[0], y - GOAL[1]) > 2)
    flowers.push([x + 0.5, y + 0.5, Math.random()]);
}

// ================= 状态 =================
const player = { x: 14.5 * TILE, y: 18.5 * TILE, r: 10 };
const keys = {};
let insideT = 0;      // 在迷宫里累计待了多久
let steps = 0;        // 走的路程（格数）
let won = false;
let startTime = performance.now();
let msg = null;       // {text, t}
const flags = {};     // 各触发器只响一次

const HINTS = [
  [15, "坚持就是胜利！"],
  [35, "就差一点了，别放弃！"],
  [60, "真正的勇者从不回头。"],
];

// ================= 输入 =================
const KEYMAP = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
addEventListener("keydown", (e) => {
  const k = KEYMAP[e.key.toLowerCase()] || e.key.toLowerCase();
  keys[k] = true;
  if ([" ", "w", "a", "s", "d"].includes(k)) e.preventDefault();
  if (k === "r" && won) location.reload();
});
addEventListener("keyup", (e) => {
  keys[KEYMAP[e.key.toLowerCase()] || e.key.toLowerCase()] = false;
});

// ================= 碰撞 =================
const solidAt = (tx, ty) =>
  tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS ||
  grid[ty][tx] === T.WALL || grid[ty][tx] === T.TREE || grid[ty][tx] === T.SIGN;

function rectSolid(x, y, w, h) {
  return (
    solidAt(Math.floor(x / TILE), Math.floor(y / TILE)) ||
    solidAt(Math.floor((x + w) / TILE), Math.floor(y / TILE)) ||
    solidAt(Math.floor(x / TILE), Math.floor((y + h) / TILE)) ||
    solidAt(Math.floor((x + w) / TILE), Math.floor((y + h) / TILE))
  );
}

function tryMove(dx, dy) {
  const r = player.r;
  if (dx && !rectSolid(player.x + dx - r, player.y - r, r * 2, r * 2)) player.x += dx;
  if (dy && !rectSolid(player.x - r, player.y + dy - r, r * 2, r * 2)) player.y += dy;
}

// ================= 旁白 =================
function say(text, dur = 3.2) { msg = { text, t: dur }; }

const inMaze = () => {
  const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
  return tx >= RX && tx < RX + RW && ty >= RY && ty < RY + RH;
};

// ================= 结算 =================
const overlay = document.getElementById("overlay");
function win() {
  if (won) return;
  won = true;
  const secs = ((performance.now() - startTime) / 1000).toFixed(1);
  const inside = insideT.toFixed(1);
  document.getElementById("ovTitle").textContent = "通关！";
  document.getElementById("ovTitle").className = "ov-title win";
  document.getElementById("ovText").textContent =
    secs < 10
      ? `用时 ${secs} 秒 · 套路还是太老了`
      : `用时 ${secs} 秒（其中 ${inside} 秒在迷宫里）· 有时候，不进去就是答案`;
  overlay.classList.remove("hidden");
}

// ================= 更新 =================
function update(dt) {
  if (won) return;

  let mx = (keys["d"] ? 1 : 0) - (keys["a"] ? 1 : 0);
  let my = (keys["s"] ? 1 : 0) - (keys["w"] ? 1 : 0);
  if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
  const px = player.x, py = player.y;
  tryMove(mx * 170 * dt, my * 170 * dt);
  steps += Math.hypot(player.x - px, player.y - py) / TILE;

  // 首次进迷宫
  if (inMaze()) {
    insideT += dt;
    if (!flags.entered) { flags.entered = true; say("（迷宫深处，好像有什么在等着你……）"); }
  }
  for (const [th, text] of HINTS) {
    if (insideT > th && !flags[`h${th}`]) { flags[`h${th}`] = true; say(text, 4); }
  }

  // 深处的史莱姆
  const monsterX = (MONSTER[0] + 0.5) * TILE, monsterY = (MONSTER[1] + 0.5) * TILE;
  if (!flags.monster && Math.hypot(player.x - monsterX, player.y - monsterY) < TILE * 0.7) {
    flags.monster = true;
    say("你发现了一只史莱姆。它……好像也是迷路进来的。", 4.5);
  }

  // 木牌
  const signX = (SIGN[0] + 0.5) * TILE, signY = (SIGN[1] + 0.5) * TILE;
  if (!flags.sign && Math.hypot(player.x - signX, player.y - signY) < TILE * 1.4) {
    flags.sign = true;
    say("木牌写着：「勇者，宝藏就在迷宫深处。」", 4);
  }

  // 终点
  const gx = (GOAL[0] + 0.5) * TILE, gy = (GOAL[1] + 0.5) * TILE;
  if (Math.hypot(player.x - gx, player.y - gy) < TILE * 0.8) win();

  if (msg && (msg.t -= dt) <= 0) msg = null;
}

// ================= 渲染 =================
function emoji(ch, x, y, size) {
  ctx.font = `${size}px "Segoe UI Emoji", "Noto Color Emoji", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, x, y);
}

function render(now) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE, py = y * TILE;
      const c = grid[y][x];
      // 草地底色
      ctx.fillStyle = (x + y) % 2 ? "#5da75f" : "#66b168";
      ctx.fillRect(px, py, TILE, TILE);
      if (c === T.WALL) {
        ctx.fillStyle = "#7b7f8c";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#9ba0ae";
        ctx.fillRect(px, py, TILE, 4);
        ctx.fillStyle = "#636775";
        ctx.fillRect(px, py + TILE - 4, TILE, 4);
        ctx.fillRect(px + 4, py + TILE / 2 - 1, TILE - 8, 2);
      } else if (c === T.TREE) {
        emoji("🌲", px + TILE / 2, py + TILE / 2, 26);
      } else if (c === T.SIGN) {
        emoji("🪧", px + TILE / 2, py + TILE / 2, 24);
      }
    }
  }

  // 花
  for (const [fx, fy, t] of flowers) {
    emoji(t < 0.5 ? "🌼" : "🌷", fx * TILE, fy * TILE, 16);
  }

  // 入口金框 + 标注（诱饵）
  const [ex, ey] = ENTRANCE;
  ctx.strokeStyle = "#ffd76b";
  ctx.lineWidth = 3;
  ctx.strokeRect(ex * TILE + 2, ey * TILE + 1, TILE - 4, TILE - 2);
  ctx.fillStyle = "rgba(20,15,40,0.75)";
  ctx.beginPath();
  ctx.roundRect(ex * TILE - 14, ey * TILE - 20, TILE + 28, 20, 8);
  ctx.fill();
  ctx.fillStyle = "#ffd76b";
  ctx.font = "bold 13px 'Noto Sans SC', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("入 口", (ex + 0.5) * TILE, ey * TILE - 10);

  // 深处的史莱姆
  const mbob = Math.sin(now / 400) * 3;
  emoji("👾", (MONSTER[0] + 0.5) * TILE, (MONSTER[1] + 0.5) * TILE + mbob, 28);

  // 终点：光晕 + 旗子
  const gx = (GOAL[0] + 0.5) * TILE, gy = (GOAL[1] + 0.5) * TILE;
  const pulse = 22 + Math.sin(now / 350) * 6;
  ctx.fillStyle = "rgba(255, 215, 107, 0.35)";
  ctx.beginPath();
  ctx.arc(gx, gy, pulse, 0, Math.PI * 2);
  ctx.fill();
  emoji("🏁", gx, gy + Math.sin(now / 300) * 3, 30);

  // 玩家
  emoji("🚶", player.x, player.y + Math.sin(now / 150) * 1.5, 26);

  // HUD：时间 + 步数
  ctx.fillStyle = "rgba(10,8,20,0.55)";
  ctx.beginPath();
  ctx.roundRect(10, 10, 200, 40, 10);
  ctx.fill();
  const secs = ((performance.now() - startTime) / 1000).toFixed(0);
  ctx.fillStyle = "#fff";
  ctx.font = "15px 'Noto Sans SC', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`⏱ ${secs}s   👣 ${Math.floor(steps)}`, 22, 35);

  // 旁白气泡
  if (msg) {
    ctx.font = "16px 'Noto Sans SC', sans-serif";
    const tw = ctx.measureText(msg.text).width;
    const bx = W / 2, by = H - 46;
    ctx.fillStyle = "rgba(15,10,35,0.85)";
    ctx.beginPath();
    ctx.roundRect(bx - tw / 2 - 18, by - 20, tw + 36, 40, 12);
    ctx.fill();
    ctx.fillStyle = "#ffd76b";
    ctx.textAlign = "center";
    ctx.fillText(msg.text, bx, by + 5);
  }
}

// ================= 主循环 =================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
