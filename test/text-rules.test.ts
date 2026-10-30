import { describe, expect, it } from "vitest";
import { isValidAnswerText, normalizeInput } from "../src/text-rules";

describe("答えの文字の検査", () => {
  it.each(["朝ごはんの前に", "コンビニで", "ABCの3人が", "なぜか、急に。", "ラーメン屋で"])("%s は通る", (s) => {
    expect(isValidAnswerText(normalizeInput(s))).toBe(true);
  });

  it.each(["", "   ", "あ".repeat(31), "すごい！", "なぜ？", "<b>", "絵文字😀", "空白 あり", "&amp;", "a\"b", "改行\nあり", "A・B"])(
    "%j は通らない",
    (s) => {
      expect(isValidAnswerText(normalizeInput(s))).toBe(false);
    },
  );

  it("30字ちょうどは通る", () => {
    expect(isValidAnswerText("あ".repeat(30))).toBe(true);
  });

  it("全角英数字と半角カタカナはそろえてから調べる", () => {
    expect(normalizeInput("ＡＢＣ１２３ｶﾀｶﾅ")).toBe("ABC123カタカナ");
  });

  it("前後の空白は取り除く", () => {
    expect(normalizeInput("　コンビニで ")).toBe("コンビニで");
  });
});
