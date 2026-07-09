# Sweep / OB Scanner

Multi-timeframe liquidity sweep + order block detection across a fixed
watchlist of Bybit USDT perpetuals, with an on-demand web dashboard and
optional Telegram alerts.

## What it actually does

- Pulls weekly, daily, 4h, 1h, and 30m candles from Bybit's **public** API
  (no API key needed for market data).
- Determines bias on weekly/daily/4h using swing structure (higher highs/lows
  vs lower highs/lows).
- On the 1h: detects a liquidity sweep (wick through a prior swing point that
  closes back inside), checks for a structure shift afterward, finds the
  order block (per your rule: the last opposing candle before the impulsive
  move), and locates a minor inducement swing between the sweep and the OB.
- A setup is only flagged **valid** if bias is aligned across all three
  higher timeframes AND every pattern piece (sweep, structure shift, OB) is
  present and pointing the same direction.
- The 30m timeframe is fetched but only meant for you to manually refine
  entry — it does not gate validity.

## What it does NOT do

- **It does not predict outcomes.** It automates the shape-matching you were
  doing by eye. It has no verified win rate yet — that only comes from you
  logging real outcomes over time (see "Closing the loop" below).
- **It does not manage risk for you.** No position sizing, no auto-placed
  stop loss, no trade execution. You still calculate size from the $10
  fixed-risk rule and place the SL yourself.
- **It is not immune to false positives**, especially on choppy/low-liquidity
  pairs. The swing-detection method is a simplification — treat every alert
  as "worth checking the chart," not "worth entering."

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET in .env.local
npm run dev
```

Visit http://localhost:3000 and click "Run scan."

## Deploying (free)

1. Push this folder to a new GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. In Vercel's Project Settings → Environment Variables, add:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID` (yours is `8648521776`)
   - `CRON_SECRET` (any random string)
4. Deploy. Vercel will automatically pick up `vercel.json` and schedule
   `/api/alert-cron` to run every 15 minutes on the free tier.

That's it — the dashboard is live at your Vercel URL, and Telegram alerts
fire automatically whenever a pair flips to a valid setup.

## Adjusting the watchlist

Edit `lib/watchlist.ts` — it's a plain array of Bybit symbols
(e.g. `"BTCUSDT"`). Add or remove pairs any time.

## Adjusting cron frequency

Edit the `schedule` in `vercel.json` (cron syntax). `*/15 * * * *` = every
15 minutes. Vercel's free tier supports cron but check current limits in
their docs before going more frequent than every few minutes across many
pairs, since each run makes 5 API calls per symbol (16 pairs × 5 = 80 calls
per run).

## Closing the loop: turning this into a real backtest

Right now this tool tells you when the pattern *currently* matches. To find
out if the pattern is actually profitable, the highest-value next step is
logging every alert this bot fires (valid setups only) into a simple sheet:
symbol, date, direction, entry, SL, outcome. After 30-50 logged instances
you'll have a real win rate and R:R — that's the number that tells you
whether to trust this, tighten the rules, or rethink the setup entirely.
We can build that logging step directly into the app next if useful.
