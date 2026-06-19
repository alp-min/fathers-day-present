"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

function useSecondsAgo(date: Date | null) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!date) return;
    const tick = () => setSecs(Math.floor((Date.now() - date.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);
  return date ? secs : null;
}

interface PriceStatusBarProps {
  loading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  onRefresh: () => void;
  count: number;
}

export function PriceStatusBar({ loading, lastUpdated, error, onRefresh, count }: PriceStatusBarProps) {
  const secsAgo = useSecondsAgo(lastUpdated);
  if (count === 0) return null;
  const label =
    secsAgo === null ? "Fetching prices..."
    : secsAgo < 5 ? "Just updated"
    : secsAgo < 60 ? `Updated ${secsAgo}s ago`
    : `Updated ${Math.floor(secsAgo / 60)}m ago`;
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs">
      {error ? (
        <>
          <WifiOff className="w-3.5 h-3.5 text-loss shrink-0" />
          <span className="text-loss flex-1">Price feed error — {error}</span>
        </>
      ) : (
        <>
          <div className="relative shrink-0">
            <Wifi className="w-3.5 h-3.5 text-gain" />
            {loading && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            )}
          </div>
          <span className="text-muted flex-1">
            <span className="text-gain font-medium">Live</span> · Yahoo Finance · {label} · auto-refreshes every 60s
          </span>
        </>
      )}
      <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1.5 text-muted hover:text-primary transition-colors disabled:opacity-40">
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </div>
  );
}
