import { NextResponse } from "next/server";
import { fetchAllTimeframes } from "@/lib/bybit";
import { evaluateSetup } from "@/lib/evaluate";
import { WATCHLIST } from "@/lib/watchlist";
import { SetupResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const results: SetupResult[] = [];
  const errors: { symbol: string; error: string }[] = [];

  // Run sequentially with small stagger to avoid hitting Bybit rate limits.
  // (Bybit public API allows generous limits, but we stay conservative since
  // this can be called from Vercel's free tier without issue.)
  for (const symbol of WATCHLIST) {
    try {
      const data = await fetchAllTimeframes(symbol);
      const result = evaluateSetup(symbol, data);
      results.push(result);
    } catch (err) {
      errors.push({ symbol, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    results,
    errors,
  });
}
