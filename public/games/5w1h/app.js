"use strict";

const API = "/games/5w1h/api";

const drawButton = document.getElementById("draw");
const placeholderEl = document.getElementById("placeholder");
const sentenceEl = document.getElementById("sentence");
const hintEl = document.getElementById("hint");
const actionsEl = document.getElementById("actions");
const likeButton = document.getElementById("like");
const reportOpenButton = document.getElementById("report-open");
const reportEl = document.getElementById("report");
const reportPartsEl = document.getElementById("report-parts");
const reportCancelButton = document.getElementById("report-cancel");
const messageEl = document.getElementById("message");

const CATEGORY_LABELS = {
  when: "いつ",
  where: "どこで",
  who: "だれが",
  why: "なぜ",
  how: "どうやって",
  what: "なにをした",
};

let currentParts = [];
let countdownTimer = null;

function showMessage(text) {
  messageEl.textContent = text;
}

function showError(body) {
  const id = body && typeof body.requestId === "string" ? body.requestId : "なし";
  showMessage(`うまくいきませんでした（番号: ${id}）`);
}

// 通信そのものが失敗したときは status 0 を返し、呼び出し側でエラーとして扱う
async function request(path, options) {
  let res;
  try {
    res = await fetch(API + path, { credentials: "same-origin", ...options });
  } catch {
    return { status: 0, body: null };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function postJson(path, data) {
  return request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

// 次に引けるまでの秒数をボタンに出す
function startCountdown(seconds) {
  clearInterval(countdownTimer);
  let left = seconds;
  drawButton.disabled = true;
  drawButton.textContent = `あと ${left} 秒`;
  countdownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(countdownTimer);
      drawButton.disabled = false;
      drawButton.textContent = "引く";
    } else {
      drawButton.textContent = `あと ${left} 秒`;
    }
  }, 1000);
}

// 部分ごとに名前を付ける。名前は合わせたときだけ見せ、読み上げソフトには常に伝える
function renderSentence(parts) {
  sentenceEl.replaceChildren();
  for (const part of parts) {
    const label = CATEGORY_LABELS[part.category] ?? "";
    const span = document.createElement("span");
    span.className = `part ${part.category}`;
    span.tabIndex = 0;

    const labelEl = document.createElement("span");
    labelEl.className = "part-label";
    labelEl.setAttribute("aria-hidden", "true");
    labelEl.textContent = label;

    const spokenEl = document.createElement("span");
    spokenEl.className = "visually-hidden";
    spokenEl.textContent = `${label}、`;

    const textEl = document.createElement("span");
    textEl.className = "part-text";
    textEl.textContent = part.text;

    span.append(labelEl, spokenEl, textEl);
    sentenceEl.append(span);
  }
  placeholderEl.hidden = true;
  sentenceEl.hidden = false;
  hintEl.hidden = false;
}

// カーソルのない端末では、タップした部分だけ名前を出し入れする
function togglePart(event) {
  const part = event.target.closest(".part");
  if (!part) return;
  const wasOpen = part.classList.contains("open");
  for (const open of sentenceEl.querySelectorAll(".part.open")) open.classList.remove("open");
  if (!wasOpen) part.classList.add("open");
}

function setLiked(likeCount) {
  likeButton.setAttribute("aria-pressed", "true");
  likeButton.textContent = typeof likeCount === "number" ? `いいね済み ${likeCount}` : "いいね済み";
}

function closeReport() {
  reportEl.hidden = true;
  reportPartsEl.replaceChildren();
}

async function draw() {
  showMessage("");
  closeReport();
  const { status, body } = await request("/gacha", { method: "GET" });
  if (status === 429 && body) {
    startCountdown(body.retryAfterSec);
    return;
  }
  if (status !== 200 || !body) {
    showError(body);
    return;
  }
  currentParts = body.parts;
  renderSentence(currentParts);
  actionsEl.hidden = false;
  likeButton.disabled = false;
  likeButton.setAttribute("aria-pressed", "false");
  likeButton.textContent = "いいね";
  reportOpenButton.disabled = false;
  startCountdown(body.cooldownSec);
}

async function like() {
  likeButton.disabled = true;
  const { status, body } = await postJson("/likes", { partIds: currentParts.map((p) => p.id) });
  if (status === 200 && body) {
    setLiked(body.likeCount);
  } else if (status === 409) {
    setLiked(null);
    showMessage("この文にはもういいねしています。");
  } else if (status === 429) {
    showMessage("今日はもういいねできません。");
  } else {
    likeButton.disabled = false;
    showError(body);
  }
}

function openReport() {
  reportPartsEl.replaceChildren();
  for (const part of currentParts) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${CATEGORY_LABELS[part.category] ?? ""}: ${part.text}`;
    button.addEventListener("click", () => report(part.id));
    li.append(button);
    reportPartsEl.append(li);
  }
  reportEl.hidden = false;
}

async function report(partId) {
  const { status, body } = await postJson("/reports", { partId });
  closeReport();
  if (status === 200) {
    reportOpenButton.disabled = true;
    showMessage("通報しました。");
  } else if (status === 409) {
    showMessage("この部分はもう通報しています。");
  } else if (status === 429) {
    showMessage("今日はもう通報できません。");
  } else {
    showError(body);
  }
}

drawButton.addEventListener("click", draw);
sentenceEl.addEventListener("click", togglePart);
likeButton.addEventListener("click", like);
reportOpenButton.addEventListener("click", openReport);
reportCancelButton.addEventListener("click", closeReport);
