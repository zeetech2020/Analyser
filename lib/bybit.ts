import { Candle } from "./types";

const BYBIT_BASE = "https://api.bybit.com";

// Bybit kline intervals: 1,3,5,15,30,60,120,240,360,720,D,W,M
const INTERVAL_MAP: Record<string, string> = {
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

export async function fetchKlines(
  symbol: string,
  timeframe: keyof typeof INTERVAL_MAP,
  limit = 200
): Promise<Candle[]> {
  const interval = INTERVAL_MAP[timeframe];
  const url = `${BYBIT_BASE}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Bybit API error for ${symbol} ${timeframe}: ${res.status}`);
  }
  const json = await res.json();

  if (json.retCode !== 0) {
    throw new Error(`Bybit API returned error for ${symbol}: ${json.retMsg}`);
  }

  // Bybit returns newest-first: [start, open, high, low, close, volume, turnover]
  const rows: string[][] = json.result?.list ?? [];

  const candles: Candle[] = rows
    .map((r) => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
    .reverse(); // oldest-first for easier structure analysis

  return candles;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAllTimeframes(symbol: string) {
  // Sequential (not Promise.all) with small gaps — Bybit's CDN layer flags
  // bursts of concurrent requests from the same IP with 403s, even though
  // each request individually is valid. Spacing them out avoids that.
  const weekly = await fetchKlines(symbol, "1w", 100);
  await sleep(150);
  const daily = await fetchKlines(symbol, "1d", 150);
  await sleep(150);
  const h4 = await fetchKlines(symbol, "4h", 200);
  await sleep(150);
  const h1 = await fetchKlines(symbol, "1h", 200);
  await sleep(150);
  const m30 = await fetchKlines(symbol, "30m", 200);

  return { weekly, daily, h4, h1, m30 };
}
