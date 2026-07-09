import { NextResponse } from "next/server";
import { fetchAllTimeframes } from "@/lib/bybit";
import { evaluateSetup } from "@/lib/evaluate";
import { WATCHLIST } from "@/lib/watchlist";
import { SetupResult } from "@/lib/types";
import { saveScanResults } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const results: SetupResult[] = [];
  const errors: { symbol: string; error: string }[] = [];

  for (const symbol of WATCHLIST) {
    try {
      const data = await fetchAllTimeframes(symbol);
      const result = evaluateSetup(symbol, data);
      results.push(result);
    } catch (err) {
      errors.push({ symbol, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Refresh the cache too, so a manual scan on the website also updates
  // what the Telegram bot will report on the next /validSetup or /formingSetup.
  try {
    await saveScanResults(results);
  } catch (err) {
    console.error("Failed to cache scan results:", err);
  }

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    results,
    errors,
  });
}
