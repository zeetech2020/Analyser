import { Candle, SweepEvent, SwingPoint, OrderBlock } from "./types";
import { findSwingPoints } from "./bias";

/**
 * Detects a liquidity sweep: a candle that wicks beyond a recent swing high/low
 * but closes back on the other side of it (rejection, not a clean break).
 *
 * direction "sell-side" = swept a swing LOW (hunting sell-stops, bullish implication)
 * direction "buy-side"  = swept a swing HIGH (hunting buy-stops, bearish implication)
 */
export function detectSweep(candles: Candle[], swings: SwingPoint[]): SweepEvent | null {
  if (candles.length < 5) return null;

  // Look at the most recent candles for a sweep of a prior swing point
  const recentWindow = candles.slice(-15);
  const startIdx = candles.length - recentWindow.length;

  const priorHighs = swings.filter((s) => s.type === "high");
  const priorLows = swings.filter((s) => s.type === "low");

  for (let i = recentWindow.length - 1; i >= 1; i--) {
    const candle = recentWindow[i];
    const globalIdx = startIdx + i;

    // Only consider swings that occurred BEFORE this candle
    const relevantHighs = priorHighs.filter((s) => s.index < globalIdx);
    const relevantLows = priorLows.filter((s) => s.index < globalIdx);

    const lastHigh = relevantHighs[relevantHighs.length - 1];
    const lastLow = relevantLows[relevantLows.length - 1];

    // Sell-side sweep: wick below a prior low, close back above it
    if (lastLow && candle.low < lastLow.price && candle.close > lastLow.price) {
      return {
        index: globalIdx,
        time: candle.time,
        sweptLevel: lastLow.price,
        wickPrice: candle.low,
        direction: "sell-side",
      };
    }

    // Buy-side sweep: wick above a prior high, close back below it
    if (lastHigh && candle.high > lastHigh.price && candle.close < lastHigh.price) {
      return {
        index: globalIdx,
        time: candle.time,
        sweptLevel: lastHigh.price,
        wickPrice: candle.high,
        direction: "buy-side",
      };
    }
  }

  return null;
}

/**
 * Structure shift: after a sweep, price should break the minor structure
 * in the new intended direction (confirms the sweep wasn't just continuation).
 */
export function detectStructureShift(
  candles: Candle[],
  sweep: SweepEvent,
  swings: SwingPoint[]
): boolean {
  const afterSweep = candles.slice(sweep.index + 1);
  if (afterSweep.length < 2) return false;

  if (sweep.direction === "sell-side") {
    // expecting bullish structure shift: break above the minor swing high after the sweep
    const minorHighAfter = swings
      .filter((s) => s.type === "high" && s.index > sweep.index)
      .sort((a, b) => a.index - b.index)[0];
    if (!minorHighAfter) {
      // fallback: did price simply break above the high of the sweep candle's local range?
      const localHigh = Math.max(...candles.slice(Math.max(0, sweep.index - 5), sweep.index).map((c) => c.high));
      return afterSweep.some((c) => c.close > localHigh);
    }
    return afterSweep.some((c) => c.close > minorHighAfter.price);
  } else {
    // expecting bearish structure shift: break below the minor swing low after the sweep
    const minorLowAfter = swings
      .filter((s) => s.type === "low" && s.index > sweep.index)
      .sort((a, b) => a.index - b.index)[0];
    if (!minorLowAfter) {
      const localLow = Math.min(...candles.slice(Math.max(0, sweep.index - 5), sweep.index).map((c) => c.low));
      return afterSweep.some((c) => c.close < localLow);
    }
    return afterSweep.some((c) => c.close < minorLowAfter.price);
  }
}

/**
 * Order block: the last opposing candle before the impulsive move that
 * caused the structure shift. Per user's rule, entries are placed at the
 * "2nd candle" in the identified block zone.
 */
export function findOrderBlock(
  candles: Candle[],
  sweep: SweepEvent
): OrderBlock | null {
  const afterSweep = candles.slice(sweep.index, sweep.index + 12);
  if (afterSweep.length < 3) return null;

  if (sweep.direction === "sell-side") {
    // bullish OB: last down (red) candle before the impulsive up move
    for (let i = 1; i < afterSweep.length - 1; i++) {
      const c = afterSweep[i];
      const next = afterSweep[i + 1];
      const isDown = c.close < c.open;
      const nextIsStrongUp = next.close > next.open && next.close > c.high;
      if (isDown && nextIsStrongUp) {
        return {
          index: sweep.index + i,
          time: c.time,
          high: c.high,
          low: c.low,
          direction: "bullish",
        };
      }
    }
  } else {
    // bearish OB: last up (green) candle before the impulsive down move
    for (let i = 1; i < afterSweep.length - 1; i++) {
      const c = afterSweep[i];
      const next = afterSweep[i + 1];
      const isUp = c.close > c.open;
      const nextIsStrongDown = next.close < next.open && next.close < c.low;
      if (isUp && nextIsStrongDown) {
        return {
          index: sweep.index + i,
          time: c.time,
          high: c.high,
          low: c.low,
          direction: "bearish",
        };
      }
    }
  }

  return null;
}

/**
 * Inducement: a smaller liquidity pocket (minor swing) between the sweep
 * and the order block that likely trapped early entries.
 */
export function findInducement(
  swings: SwingPoint[],
  sweep: SweepEvent,
  orderBlock: OrderBlock
): SwingPoint | null {
  const between = swings.filter(
    (s) => s.index > sweep.index && s.index < orderBlock.index
  );
  if (between.length === 0) return null;

  // pick the most prominent minor swing between sweep and OB
  return between[Math.floor(between.length / 2)];
}
