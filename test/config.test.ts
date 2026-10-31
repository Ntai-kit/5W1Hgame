import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("値がそろっていれば数値に直して返す", () => {
    expect(
      loadConfig({ ALLOWED_ORIGIN: "https://ntaaaaaaaaai.com", GACHA_INTERVAL_SEC: "15", LIKE_PER_DAY: "30", REPORT_PER_DAY: "20" }),
    ).toEqual({ allowedOrigin: "https://ntaaaaaaaaai.com", gachaIntervalSec: 15, likePerDay: 30, reportPerDay: 20 });
  });

  it("値が欠けていれば例外を投げる", () => {
    expect(() => loadConfig({ ALLOWED_ORIGIN: "https://ntaaaaaaaaai.com" })).toThrow();
  });

  it("正の整数でなければ例外を投げる", () => {
    expect(() =>
      loadConfig({ ALLOWED_ORIGIN: "https://ntaaaaaaaaai.com", GACHA_INTERVAL_SEC: "0", LIKE_PER_DAY: "30", REPORT_PER_DAY: "20" }),
    ).toThrow();
    expect(() =>
      loadConfig({ ALLOWED_ORIGIN: "https://ntaaaaaaaaai.com", GACHA_INTERVAL_SEC: "15", LIKE_PER_DAY: "30", REPORT_PER_DAY: "x" }),
    ).toThrow();
  });

  it("ALLOWED_ORIGIN が https のオリジンでなければ例外を投げる", () => {
    expect(() =>
      loadConfig({ ALLOWED_ORIGIN: "*", GACHA_INTERVAL_SEC: "15", LIKE_PER_DAY: "30", REPORT_PER_DAY: "20" }),
    ).toThrow();
  });
});
