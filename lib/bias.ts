import { Candle, Bias, SwingPoint } from "./types";

/**
 * Finds swing highs/lows using a simple fractal method:
 * a candle is a swing high if its high is greater than `lookback` candles
 * on either side, and a swing low if its low is lower than those candles.
 */
export function findSwingPoints(candles: Candle[], lookback = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const current = candles[i];

    const isHigh = window.every((c) => c.high <= current.high);
    const isLow = window.every((c) => c.low >= current.low);

    if (isHigh) {
      swings.push({ index: i, time: current.time, price: current.high, type: "high" });
    } else if (isLow) {
      swings.push({ index: i, time: current.time, price: current.low, type: "low" });
    }
  }

  return swings;
}

/**
 * Determines bias from swing structure:
 * - "up" if the last two swing highs are rising AND last two swing lows are rising
 * - "down" if the inverse
 * - "range" otherwise
 */
export function determineBias(candles: Candle[]): Bias {
  const swings = findSwingPoints(candles, 2);
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  if (highs.length < 2 || lows.length < 2) return "range";

  const lastTwoHighs = highs.slice(-2);
  const lastTwoLows = lows.slice(-2);

  const higherHighs = lastTwoHighs[1].price > lastTwoHighs[0].price;
  const higherLows = lastTwoLows[1].price > lastTwoLows[0].price;
  const lowerHighs = lastTwoHighs[1].price < lastTwoHighs[0].price;
  const lowerLows = lastTwoLows[1].price < lastTwoLows[0].price;

  if (higherHighs && higherLows) return "up";
  if (lowerHighs && lowerLows) return "down";
  return "range";
}
