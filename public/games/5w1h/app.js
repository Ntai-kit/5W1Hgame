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

function renderSentence(parts) {
  buildSentence(sentenceEl, parts, true);
  placeholderEl.hidden = true;
  sentenceEl.hidden = false;
  hintEl.hidden = false;
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
enablePartToggle(sentenceEl);
likeButton.addEventListener("click", like);
reportOpenButton.addEventListener("click", openReport);
reportCancelButton.addEventListener("click", closeReport);
