"use strict";

const API = "/games/5w1h/api";

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const periodButtons = document.querySelectorAll(".periods button");

// 3つの期間をまとめて1回だけ読み、切り替えでは呼び直さない
let ranking = null;

function showError(body) {
  const id = body && typeof body.requestId === "string" ? body.requestId : "なし";
  statusEl.textContent = `うまくいきませんでした（番号: ${id}）`;
}

function render(period) {
  for (const button of periodButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.period === period));
  }
  listEl.replaceChildren();
  if (!ranking) return;
  const items = ranking[period] ?? [];
  // 文があるときは、お知らせの欄の余白を残さない
  statusEl.textContent = items.length === 0 ? "この期間には、まだ文がありません。" : "";
  statusEl.hidden = items.length !== 0;
  for (const item of items) {
    const li = document.createElement("li");

    const rankEl = document.createElement("span");
    rankEl.className = "rank";
    rankEl.textContent = `${item.rank}位`;

    const sentenceEl = document.createElement("p");
    sentenceEl.className = "sentence";
    buildSentence(sentenceEl, item.parts, false);

    const likesEl = document.createElement("span");
    likesEl.className = "likes";
    likesEl.textContent = `いいね ${item.likeCount}`;

    li.append(rankEl, sentenceEl, likesEl);
    listEl.append(li);
  }
}

async function load() {
  let res;
  try {
    res = await fetch(`${API}/ranking`, { credentials: "same-origin" });
  } catch {
    showError(null);
    return;
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status !== 200 || !body) {
    showError(body);
    return;
  }
  ranking = body;
  const current = document.querySelector('.periods button[aria-pressed="true"]');
  render(current ? current.dataset.period : "today");
}

for (const button of periodButtons) {
  button.addEventListener("click", () => render(button.dataset.period));
}
enablePartToggle(listEl);
load();
