import { expect, it } from "vitest";

// 仕様書の「Workers で日本語の分割が正しく動くかは、実装の最初に確かめる」
it("Intl.Segmenter が workerd で日本語を単語に分ける", () => {
  const words = [...new Intl.Segmenter("ja", { granularity: "word" }).segment("校長先生が走った")]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);
  console.log("segmenter:", JSON.stringify(words));
  expect(words.length).toBeGreaterThan(1);
  expect(words.join("")).toBe("校長先生が走った");
});
