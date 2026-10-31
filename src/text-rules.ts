const MAX_ANSWER_LENGTH = 30;
// ひらがな、カタカナ、長音符、漢字、英字、数字、読点、句点
const ANSWER_CHARS = /^[\p{Script=Hiragana}\p{Script=Katakana}ー\p{Script=Han}A-Za-z0-9、。]+$/u;

// 全角英数字を半角に、半角カタカナを全角にそろえ、前後の空白を取り除く
export function normalizeInput(s: string): string {
  return s.normalize("NFKC").trim();
}

export function isValidAnswerText(s: string): boolean {
  const length = [...s].length;
  return length >= 1 && length <= MAX_ANSWER_LENGTH && ANSWER_CHARS.test(s);
}
