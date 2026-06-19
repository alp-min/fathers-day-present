"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PriceQuote } from "@/app/api/prices/route";

export type { PriceQuote };

export function useLivePrices(tickers: string[], intervalMs = 60_000) {
  const [prices, setPrices] = useState<Record<string, PriceQuote>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const symbolsKey = [...tickers].sort().join(",");

  const refresh = useCallback(async () => {
    if (!symbolsKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbolsKey)}`);
      if (!res.ok) throw new Error(`Price fetch failed (${res.status})`);
      const data: { prices: Record<string, PriceQuote>; ts: number } = await res.json();
      setPrices(data.prices);
      setLastUpdated(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbolsKey]);

  useEffect(() => {
    if (!symbolsKey) return;
    refresh();
    timerRef.current = setInterval(refresh, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, intervalMs]);

  return { prices, loading, lastUpdated, error, refresh };
}
