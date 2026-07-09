import { NextRequest, NextResponse } from "next/server";
import { formatSetupMessage } from "@/lib/telegram";
import { loadScanResults } from "@/lib/cache";
import { SetupResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 15; // just reading from cache now, should be fast

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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
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

  if (command === "/validsetup" || command === "/formingsetup") {
    const cached = await loadScanResults();

    if (!cached) {
      await replyToTelegram(
        chatId,
        "No scan data yet — the cron job hasn't completed a run. Try again in a few minutes."
      );
      return NextResponse.json({ ok: true });
    }

    const age = timeAgo(cached.scannedAt);

    if (command === "/validsetup") {
      const valid = cached.results.filter((r) => r.valid);
      if (valid.length === 0) {
        await replyToTelegram(chatId, `No valid setups right now. (as of ${age})`);
      } else {
        for (const setup of valid) {
          await replyToTelegram(chatId, formatSetupMessage(setup));
        }
      }
    } else {
      const forming = cached.results.filter((r) => r.sweep && !r.valid);
      if (forming.length === 0) {
        await replyToTelegram(chatId, `Nothing forming right now. (as of ${age})`);
      } else {
        const lines = forming.map((s) => formatFormingMessage(s)).join("\n\n");
        await replyToTelegram(chatId, `Forming setups (as of ${age}):\n\n${lines}`);
      }
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
