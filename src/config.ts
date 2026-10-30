export type Config = {
  allowedOrigin: string;
  gachaIntervalSec: number;
  likePerDay: number;
  reportPerDay: number;
};

type ConfigVars = Partial<Record<"ALLOWED_ORIGIN" | "GACHA_INTERVAL_SEC" | "LIKE_PER_DAY" | "REPORT_PER_DAY", string>>;

function positiveInt(name: string, value: string | undefined): number {
  if (value === undefined || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`環境変数 ${name} は正の整数で設定する`);
  }
  return Number(value);
}

function httpsOrigin(name: string, value: string | undefined): string {
  if (value === undefined) throw new Error(`環境変数 ${name} がない`);
  let url: URL;
  try {
    url = new URL(value);
  } catch (err) {
    throw new Error(`環境変数 ${name} は https のオリジンで設定する`, { cause: err });
  }
  if (url.protocol !== "https:" || url.origin !== value) {
    throw new Error(`環境変数 ${name} は https のオリジンで設定する`);
  }
  return value;
}

// 値がないときや形がおかしいときは、既定値を使わずに止める
export function loadConfig(vars: ConfigVars): Config {
  return {
    allowedOrigin: httpsOrigin("ALLOWED_ORIGIN", vars.ALLOWED_ORIGIN),
    gachaIntervalSec: positiveInt("GACHA_INTERVAL_SEC", vars.GACHA_INTERVAL_SEC),
    likePerDay: positiveInt("LIKE_PER_DAY", vars.LIKE_PER_DAY),
    reportPerDay: positiveInt("REPORT_PER_DAY", vars.REPORT_PER_DAY),
  };
}
