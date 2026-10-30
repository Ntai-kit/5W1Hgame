"use strict";

const API = "/games/5w1h/api";

const drawButton = document.getElementById("draw");
const sentenceEl = document.getElementById("sentence");
const actionsEl = document.getElementById("actions");
const likeButton = document.getElementById("like");
const likeCountEl = document.getElementById("like-count");
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

async function request(path, options) {
  const res = await fetch(API + path, { credentials: "same-origin", ...options });
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
  sentenceEl.replaceChildren();
  for (const part of parts) {
    const span = document.createElement("span");
    span.className = "part";
    span.textContent = part.text;
    sentenceEl.append(span);
  }
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
  likeCountEl.textContent = "";
  reportOpenButton.disabled = false;
  startCountdown(body.cooldownSec);
}

async function like() {
  likeButton.disabled = true;
  const { status, body } = await postJson("/likes", { partIds: currentParts.map((p) => p.id) });
  if (status === 200 && body) {
    likeCountEl.textContent = `${body.likeCount} 件`;
  } else if (status === 409) {
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
    button.textContent = part.text;
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
likeButton.addEventListener("click", like);
reportOpenButton.addEventListener("click", openReport);
reportCancelButton.addEventListener("click", closeReport);
