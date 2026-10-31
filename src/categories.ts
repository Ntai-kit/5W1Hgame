// 文の並び順: いつ、どこで、だれが、なぜ、どうやって、なにをした
export const CATEGORIES = ["when", "where", "who", "why", "how", "what"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  when: "いつ",
  where: "どこで",
  who: "だれが",
  why: "なぜ",
  how: "どうやって",
  what: "なにをした",
};
