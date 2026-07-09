import { NextRequest, NextResponse } from "next/server";
import { fetchAllTimeframes } from "@/lib/bybit";
import { evaluateSetup } from "@/lib/evaluate";
import { WATCHLIST } from "@/lib/watchlist";
import { formatSetupMessage } from "@/lib/telegram";
import { SetupResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // scanning the full watchlist takes a while

async function replyToTelegram(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Missing TELEGRAM_BOT_TOKEN");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.error("Telegram reply failed:", await res.text());
  }
}

function formatFormingMessage(setup: SetupResult): string {
  const dir = setup.overallDirection === "long" ? "LONG 🟢" : setup.overallDirection === "short" ? "SHORT 🔴" : "—";
  return [
    `<b>${setup.symbol}</b> — Forming`,
    `Direction: ${dir}`,
    `W: ${setup.timeframeBias.weekly} · D: ${setup.timeframeBias.daily} · 4h: ${setup.timeframeBias["4h"]}`,
    `Price: ${setup.currentPrice.toFixed(4)}`,
  ].join("\n");
}

async function runScan(): Promise<SetupResult[]> {
  const results: SetupResult[] = [];
  for (const symbol of WATCHLIST) {
    try {
      const data = await fetchAllTimeframes(symbol);
      results.push(evaluateSetup(symbol, data));
    } catch (err) {
      console.error(`Error scanning ${symbol}:`, err);
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  // Optional but recommended: verify Telegram's secret token header
  // (set this when you register the webhook, see setWebhook ?secret_token=)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const update = await req.json();
  const message = update?.message;
  const chatId = message?.chat?.id;
  const text: string | undefined = message?.text;

  if (!chatId || !text) {
    // Not a plain text message (could be an edited message, sticker, etc.) — ignore.
    return NextResponse.json({ ok: true });
  }

  const command = text.trim().toLowerCase();

  if (command === "/validsetup") {
    const results = await runScan();
    const valid = results.filter((r) => r.valid);

    if (valid.length === 0) {
      await replyToTelegram(chatId, "No valid setups right now.");
    } else {
      for (const setup of valid) {
        await replyToTelegram(chatId, formatSetupMessage(setup));
      }
    }
  } else if (command === "/formingsetup") {
    const results = await runScan();
    // "Forming" = sweep detected but not (yet) a fully valid setup
    const forming = results.filter((r) => r.sweep && !r.valid);

    if (forming.length === 0) {
      await replyToTelegram(chatId, "Nothing forming right now.");
    } else {
      const lines = forming.map((s) => formatFormingMessage(s)).join("\n\n");
      await replyToTelegram(chatId, lines);
    }
  } else if (command === "/start" || command === "/help") {
    await replyToTelegram(
      chatId,
      ["Commands:", "/validSetup — fully confirmed setups", "/formingSetup — sweep detected, not yet confirmed"].join("\n")
    );
  }
  // Unrecognized commands are silently ignored so the bot doesn't spam replies
  // to every random message sent in the chat.

  return NextResponse.json({ ok: true });
}
