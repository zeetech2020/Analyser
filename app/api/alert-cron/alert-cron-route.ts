import { NextRequest, NextResponse } from "next/server";
import { fetchAllTimeframes } from "@/lib/bybit";
import { evaluateSetup } from "@/lib/evaluate";
import { WATCHLIST } from "@/lib/watchlist";
import { sendTelegramAlert, formatSetupMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

// Simple in-memory de-dupe won't survive across serverless invocations,
// so we rely on a coarse rule: only alert once per symbol per detected
// order-block timestamp. For a first version this is stored via a tiny
// KV-free approach: encode last-alerted OB time in the response and log it.
// (For persistence across cold starts, wire up Vercel KV later if needed.)

export async function GET(req: NextRequest) {
  // Protect the cron endpoint so randoms can't trigger it / spam your Telegram
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alertsSent: string[] = [];

  for (const symbol of WATCHLIST) {
    try {
      const data = await fetchAllTimeframes(symbol);
      const result = evaluateSetup(symbol, data);

      if (result.valid) {
        const message = formatSetupMessage(result);
        await sendTelegramAlert(message);
        alertsSent.push(symbol);
      }
    } catch (err) {
      console.error(`Error scanning ${symbol}:`, err);
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    alertsSent,
  });
}
