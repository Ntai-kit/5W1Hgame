"use strict";

// ガチャとランキングで使う、文を部分に分けて出す処理。ほかのスクリプトより先に読み込む

const CATEGORY_LABELS = {
  when: "いつ",
  where: "どこで",
  who: "だれが",
  why: "なぜ",
  how: "どうやって",
  what: "なにをした",
};

// 部分ごとに名前を付ける。名前は合わせたときだけ見せ、読み上げソフトには常に伝える
function buildSentence(target, parts, focusable) {
  target.replaceChildren();
  for (const part of parts) {
    const label = CATEGORY_LABELS[part.category] ?? "";
    const span = document.createElement("span");
    span.className = `part ${part.category}`;
    if (focusable) span.tabIndex = 0;

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
    target.append(span);
  }
}

// カーソルのない端末では、タップした部分だけ名前を出し入れする
function enablePartToggle(container) {
  container.addEventListener("click", (event) => {
    const part = event.target.closest(".part");
    if (!part || !container.contains(part)) return;
    const wasOpen = part.classList.contains("open");
    for (const open of container.querySelectorAll(".part.open")) open.classList.remove("open");
    if (!wasOpen) part.classList.add("open");
  });
}
