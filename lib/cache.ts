import { Redis } from "@upstash/redis";
import { SetupResult } from "./types";

const SCAN_RESULTS_KEY = "scan:latest";

export interface CachedScan {
  scannedAt: string;
  results: SetupResult[];
}

function getRedis(): Redis {
  // Support either naming convention depending on how the integration was installed:
  // Vercel KV / older Upstash integration uses KV_REST_API_URL / KV_REST_API_TOKEN.
  // Direct Upstash integration uses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing Redis credentials. Expected KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN env vars."
    );
  }

  return new Redis({ url, token });
}

export async function saveScanResults(results: SetupResult[]): Promise<void> {
  const redis = getRedis();
  const payload: CachedScan = {
    scannedAt: new Date().toISOString(),
    results,
  };
  await redis.set(SCAN_RESULTS_KEY, JSON.stringify(payload));
}

export async function loadScanResults(): Promise<CachedScan | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(SCAN_RESULTS_KEY);
  if (!raw) return null;

  // The SDK sometimes auto-parses JSON values, sometimes returns the raw string
  // depending on how it was stored — handle both to be safe.
  if (typeof raw === "string") {
    return JSON.parse(raw) as CachedScan;
  }
  return raw as unknown as CachedScan;
}
