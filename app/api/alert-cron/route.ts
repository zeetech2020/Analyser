import { NextRequest, NextResponse } from "next/server";
import { fetchAllTimeframes } from "@/lib/bybit";
import { evaluateSetup } from "@/lib/evaluate";
import { WATCHLIST } from "@/lib/watchlist";
import { sendTelegramAlert, formatSetupMessage } from "@/lib/telegram";
import { saveScanResults } from "@/lib/cache";
import { SetupResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Protect the cron endpoint so randoms can't trigger it / spam your Telegram
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alertsSent: string[] = [];
  const results: SetupResult[] = [];

  for (const symbol of WATCHLIST) {
    try {
      const data = await fetchAllTimeframes(symbol);
      const result = evaluateSetup(symbol, data);
      results.push(result);

      if (result.valid) {
        const message = formatSetupMessage(result);
        await sendTelegramAlert(message);
        alertsSent.push(symbol);
      }
    } catch (err) {
      console.error(`Error scanning ${symbol}:`, err);
    }
  }

  // Save this run's results (even if some symbols failed) so /validSetup and
  // /formingSetup on Telegram can answer instantly from cache instead of
  // re-scanning live every time someone sends a command.
  try {
    await saveScanResults(results);
  } catch (err) {
    console.error("Failed to cache scan results:", err);
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    alertsSent,
    cached: results.length,
  });
}
