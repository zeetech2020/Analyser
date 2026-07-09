// Core data shapes used across the detection engine

export interface Candle {
  time: number;   // ms epoch, candle open time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Bias = "up" | "down" | "range";

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

export interface OrderBlock {
  index: number;       // index of the OB candle (the "2nd candle" per user's rule)
  time: number;
  high: number;
  low: number;
  direction: "bullish" | "bearish"; // bullish OB = last down candle before up move, etc.
}

export interface SweepEvent {
  index: number;
  time: number;
  sweptLevel: number;
  wickPrice: number;
  direction: "buy-side" | "sell-side"; // buy-side sweep = swept a high, sell-side = swept a low
}

export interface SetupResult {
  symbol: string;
  timeframeBias: {
    weekly: Bias;
    daily: Bias;
    "4h": Bias;
  };
  biasAligned: boolean;
  overallDirection: "long" | "short" | null;
  sweep: SweepEvent | null;
  structureShift: boolean;
  inducement: SwingPoint | null;
  orderBlock: OrderBlock | null;
  valid: boolean;       // true only if every required piece is present and aligned
  entryZone: { high: number; low: number } | null;
  stopLoss: number | null;
  currentPrice: number;
}
