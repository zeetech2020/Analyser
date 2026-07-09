"use client";

import { useState } from "react";
import { SetupResult } from "@/lib/types";

interface ScanResponse {
  scannedAt: string;
  results: SetupResult[];
  errors: { symbol: string; error: string }[];
}

export default function Home() {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function runScan() {
    setLoading(true);
    try {
      const res = await fetch("/api/scan");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  const valid = data?.results.filter((r) => r.valid) ?? [];
  const forming = data?.results.filter((r) => !r.valid && r.sweep) ?? [];
  const quiet = data?.results.filter((r) => !r.valid && !r.sweep) ?? [];

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-10 border-b border-[var(--line)] pb-6 flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Sweep / OB Scanner</h1>
          <p className="text-[var(--neutral)] text-sm mt-1">
            Weekly → Daily → 4h bias, 1h sweep + structure + order block
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="border border-[var(--line)] px-4 py-2 text-sm hover:border-[var(--amber)] hover:text-[var(--amber)] transition-colors disabled:opacity-40"
        >
          {loading ? "Scanning…" : "Run scan"}
        </button>
      </header>

      {!data && !loading && (
        <p className="text-[var(--neutral)] text-sm">
          Press &ldquo;Run scan&rdquo; to check the watchlist for valid setups right now.
        </p>
      )}

      {data && (
        <div className="space-y-10">
          <p className="text-xs text-[var(--neutral)]">
            Last scanned: {new Date(data.scannedAt).toLocaleString()}
          </p>

          <Section
            title="Valid setups"
            subtitle="Bias aligned, sweep confirmed, structure shifted, OB identified"
            accent="var(--long)"
            items={valid}
          />

          <Section
            title="Forming"
            subtitle="Sweep detected but not fully confirmed — watch, don't enter"
            accent="var(--amber)"
            items={forming}
          />

          <details className="text-sm text-[var(--neutral)]">
            <summary className="cursor-pointer hover:text-[var(--paper)]">
              Quiet pairs ({quiet.length}) — no sweep detected
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {quiet.map((r) => (
                <span key={r.symbol} className="border border-[var(--line)] px-2 py-1 text-xs">
                  {r.symbol}
                </span>
              ))}
            </div>
          </details>

          {data.errors.length > 0 && (
            <details className="text-sm text-[var(--short)]">
              <summary className="cursor-pointer">Errors ({data.errors.length})</summary>
              <div className="mt-3 space-y-1 text-xs">
                {data.errors.map((e) => (
                  <div key={e.symbol}>
                    {e.symbol}: {e.error}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  subtitle,
  accent,
  items,
}: {
  title: string;
  subtitle: string;
  accent: string;
  items: SetupResult[];
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-xl" style={{ color: accent }}>
          {title} <span className="text-[var(--neutral)] text-sm font-normal">({items.length})</span>
        </h2>
        <p className="text-xs text-[var(--neutral)]">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--neutral)] italic">None right now.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <SetupCard key={r.symbol} setup={r} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}

function SetupCard({ setup, accent }: { setup: SetupResult; accent: string }) {
  return (
    <div
      className="border p-4 flex items-center justify-between"
      style={{ borderColor: accent + "55" }}
    >
      <div>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg">{setup.symbol}</span>
          {setup.overallDirection && (
            <span
              className="text-xs uppercase tracking-wide"
              style={{ color: setup.overallDirection === "long" ? "var(--long)" : "var(--short)" }}
            >
              {setup.overallDirection}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--neutral)] mt-1">
          W: {setup.timeframeBias.weekly} · D: {setup.timeframeBias.daily} · 4h: {setup.timeframeBias["4h"]}
        </p>
      </div>

      <div className="text-right text-xs text-[var(--neutral)]">
        {setup.entryZone && (
          <p>
            OB: {setup.entryZone.low.toFixed(4)}–{setup.entryZone.high.toFixed(4)}
          </p>
        )}
        {setup.stopLoss && <p>SL: {setup.stopLoss.toFixed(4)}</p>}
        <p>Price: {setup.currentPrice.toFixed(4)}</p>
      </div>
    </div>
  );
}
