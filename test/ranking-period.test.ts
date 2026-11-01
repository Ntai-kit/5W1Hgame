import { describe, expect, it } from "vitest";
import { periodStarts } from "../src/ranking";

describe("期間の区切り", () => {
  it("月曜日の0時半は、今日も今週もその日の0時から", () => {
    const start = Date.parse("2026-11-02T00:00:00+09:00");
    expect(periodStarts(Date.parse("2026-11-02T00:30:00+09:00"))).toEqual({ today: start, week: start });
  });

  it("日曜日の23時59分59秒999は、今週が前の月曜日から", () => {
    expect(periodStarts(Date.parse("2026-11-01T23:59:59.999+09:00"))).toEqual({
      today: Date.parse("2026-11-01T00:00:00+09:00"),
      week: Date.parse("2026-10-26T00:00:00+09:00"),
    });
  });

  it("日本時間の水曜日8時59分（UTC では火曜日）は、日本時間で区切る", () => {
    expect(periodStarts(Date.parse("2026-11-04T08:59:59+09:00"))).toEqual({
      today: Date.parse("2026-11-04T00:00:00+09:00"),
      week: Date.parse("2026-11-02T00:00:00+09:00"),
    });
  });
});
