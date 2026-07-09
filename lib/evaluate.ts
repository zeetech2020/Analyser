import { Candle, SetupResult, Bias } from "./types";
import { determineBias, findSwingPoints } from "./bias";
import { detectSweep, detectStructureShift, findOrderBlock, findInducement } from "./pattern";

interface TimeframeData {
  weekly: Candle[];
  daily: Candle[];
  h4: Candle[];
  h1: Candle[];
  m30: Candle[];
}

/**
 * Evaluates a symbol against the full rule set:
 * 1. Weekly -> Daily -> 4h bias alignment (must all agree, or higher TF neutral)
 * 2. Sweep + structure shift + inducement + OB on the 1h
 * 3. 30m used only for entry refinement (returned separately, not required for validity)
 */
export function evaluateSetup(symbol: string, data: TimeframeData): SetupResult {
  const weeklyBias = determineBias(data.weekly);
  const dailyBias = determineBias(data.daily);
  const h4Bias = determineBias(data.h4);

  const biasAligned = checkBiasAlignment(weeklyBias, dailyBias, h4Bias);
  const overallDirection = biasAligned ? directionFromBias(dailyBias) : null;

  const currentPrice = data.h1[data.h1.length - 1]?.close ?? 0;

  const result: SetupResult = {
    symbol,
    timeframeBias: { weekly: weeklyBias, daily: dailyBias, "4h": h4Bias },
    biasAligned,
    overallDirection,
    sweep: null,
    structureShift: false,
    inducement: null,
    orderBlock: null,
    valid: false,
    entryZone: null,
    stopLoss: null,
    currentPrice,
  };

  // If bias isn't aligned, per the user's rule: no trade, skip pair.
  // Still run detection so the dashboard can show "what's forming" for context.
  const h1Swings = findSwingPoints(data.h1, 2);
  const sweep = detectSweep(data.h1, h1Swings);
  result.sweep = sweep;

  if (!sweep) return result;

  // Direction from the sweep should match overall direction if bias is aligned
  const sweepImpliesLong = sweep.direction === "sell-side";
  const sweepImpliesShort = sweep.direction === "buy-side";

  if (biasAligned) {
    if (overallDirection === "long" && !sweepImpliesLong) return result;
    if (overallDirection === "short" && !sweepImpliesShort) return result;
  }

  const structureShift = detectStructureShift(data.h1, sweep, h1Swings);
  result.structureShift = structureShift;
  if (!structureShift) return result;

  const orderBlock = findOrderBlock(data.h1, sweep);
  result.orderBlock = orderBlock;
  if (!orderBlock) return result;

  const inducement = findInducement(h1Swings, sweep, orderBlock);
  result.inducement = inducement;
  // inducement is supportive but not strictly required to flag the setup

  result.entryZone = { high: orderBlock.high, low: orderBlock.low };

  // Stop loss: beyond the sweep wick with a small buffer, per user's rule
  // (SL placed beyond sweep / beyond OB with structural room)
  const buffer = (orderBlock.high - orderBlock.low) * 0.15;
  result.stopLoss =
    orderBlock.direction === "bullish"
      ? Math.min(sweep.wickPrice, orderBlock.low) - buffer
      : Math.max(sweep.wickPrice, orderBlock.high) + buffer;

  // Valid only if bias is aligned AND all pattern pieces are present
  result.valid = biasAligned && structureShift && !!orderBlock;

  return result;
}

function checkBiasAlignment(weekly: Bias, daily: Bias, h4: Bias): boolean {
  // Strict rule: weekly and daily must agree in direction (or weekly is range),
  // and 4h must not conflict with daily.
  if (daily === "range") return false;
  if (weekly !== "range" && weekly !== daily) return false;
  if (h4 === "range") return false;
  if (h4 !== daily) return false;
  return true;
}

function directionFromBias(bias: Bias): "long" | "short" | null {
  if (bias === "up") return "long";
  if (bias === "down") return "short";
  return null;
}
