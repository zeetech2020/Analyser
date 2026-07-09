import { SetupResult } from "./types";

export async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Telegram send failed:", body);
  }
}

export function formatSetupMessage(setup: SetupResult): string {
  const dir = setup.overallDirection === "long" ? "LONG 🟢" : "SHORT 🔴";
  const entry = setup.entryZone
    ? `${setup.entryZone.low.toFixed(4)} - ${setup.entryZone.high.toFixed(4)}`
    : "N/A";
  const sl = setup.stopLoss ? setup.stopLoss.toFixed(4) : "N/A";

  return [
    `<b>${setup.symbol}</b> — Valid setup detected`,
    `Direction: ${dir}`,
    `Bias — Weekly: ${setup.timeframeBias.weekly}, Daily: ${setup.timeframeBias.daily}, 4h: ${setup.timeframeBias["4h"]}`,
    `Entry zone (OB): ${entry}`,
    `Suggested SL: ${sl}`,
    `Current price: ${setup.currentPrice.toFixed(4)}`,
    ``,
    `⚠️ Verify manually before entering. This is pattern detection, not a signal guarantee.`,
  ].join("\n");
}
