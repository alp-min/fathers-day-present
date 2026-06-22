"use client";

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PortfolioValueCard } from "@/components/dashboard/PortfolioValueCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { MarketSnapshot } from "@/components/dashboard/MarketSnapshot";
import { TopMovers } from "@/components/dashboard/TopMovers";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InsightCards } from "@/components/dashboard/InsightCards";
import { WatchlistWidget } from "@/components/dashboard/WatchlistWidget";
import { positionRepository } from "@/lib/repositories";
import { useLivePrices } from "@/lib/hooks/useLivePrices";
import {
  mockPerformanceHistory,
  mockMarketIndices,
  mockNews,
  mockTransactions,
  mockInsights,
  mockWatchlists,
  mockPositions,
  mockSectorAllocation,
  mockGeographyAllocation,
  mockAssetClassAllocation,
} from "@/lib/mock-data";
import type { Position, Currency, AllocationSlice, PortfolioSummary, TopMover } from "@/lib/types";
import type { PositionRow } from "@/lib/supabase";

// ─── Shared helpers (same as portfolio page) ──────────────────────────────────

function inferCountry(ticker: string, stored: string): string {
  if (stored && stored !== "United States") return stored;
  const t = ticker.toUpperCase();
  if (t.endsWith(".L")) return "United Kingdom";
  if (t.endsWith(".AX")) return "Australia";
  if (t.endsWith(".TO") || t.endsWith(".TSX")) return "Canada";
  if (t.endsWith(".HK")) return "China";
  if (t.endsWith(".PA") || t.endsWith(".DE") || t.endsWith(".MI") ||
      t.endsWith(".AS") || t.endsWith(".MC") || t.endsWith(".SW") ||
      t.endsWith(".ST") || t.endsWith(".OL") || t.endsWith(".BR")) return "Europe";
  if (t.endsWith("=F")) return "Global";
  if (t === "BTC" || t === "ETH" || t.endsWith("-USD")) return "Global";
  return stored || "United States";
}

const GEO_COLORS: Record<string, string> = {
  "United States": "#3b82f6",
  "United Kingdom": "#ef4444",
  "Europe": "#8b5cf6",
  "Australia": "#10b981",
  "China": "#f59e0b",
  "Canada": "#f97316",
  "Japan": "#ec4899",
  "Global": "#6b7280",
  "Emerging Markets": "#06b6d4",
};

function geoColor(country: string, i: number): string {
  return GEO_COLORS[country] ?? `hsl(${(i * 67) % 360}, 55%, 55%)`;
}

function rowsToPositions(
  rows: PositionRow[],
  liveMap: Record<string, { price: number; changePct: number; change: number }>
): Position[] {
  const totalValue = rows.reduce((sum, r) => {
    const price = liveMap[r.ticker]?.price ?? r.current_price;
    return sum + r.quantity * price;
  }, 0);

  return rows.map((r) => {
    const live = liveMap[r.ticker];
    const price = live?.price ?? r.current_price;
    const isShort = r.direction === "short";
    const marketValue = r.quantity * price;
    const cost = r.quantity * r.avg_cost;
    const unrealisedPL = isShort ? cost - marketValue : marketValue - cost;
    const unrealisedPLPct = cost > 0 ? (unrealisedPL / cost) * 100 : 0;
    const dayChangePct = live?.changePct ?? 0;
    const dayChange = live?.change ?? 0;
    const weight = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;

    return {
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      assetClass: (r.asset_class as Position["assetClass"]) ?? "stock",
      sector: "Communication Services",
      geography: inferCountry(r.ticker, r.country ?? "United States"),
      exchange: "OTHER",
      currency: r.currency as Currency,
      quantity: r.quantity,
      avgCostBasis: r.avg_cost,
      currentPrice: price,
      previousClose: price - dayChange,
      marketValue,
      unrealisedPL,
      unrealisedPLPct,
      dayChange,
      dayChangePct,
      weight,
      direction: (r.direction ?? "long") as "long" | "short",
      account: r.account ?? "General",
      beta: r.beta ?? undefined,
      addedDate: r.created_at,
      notes: r.notes ?? undefined,
    } satisfies Position;
  });
}

function buildGeoAlloc(positions: Position[]): AllocationSlice[] {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const map: Record<string, number> = {};
  for (const p of positions) map[p.geography] = (map[p.geography] ?? 0) + p.marketValue;
  return Object.entries(map)
    .map(([name, val], i) => ({ name, value: parseFloat(((val / totalValue) * 100).toFixed(1)), color: geoColor(name, i) }))
    .sort((a, b) => b.value - a.value);
}

function buildAssetAlloc(positions: Position[]): AllocationSlice[] {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const map: Record<string, number> = {};
  for (const p of positions) map[p.assetClass] = (map[p.assetClass] ?? 0) + p.marketValue;
  const ASSET_COLORS: Record<string, string> = {
    stock: "#3b82f6", etf: "#10b981", fund: "#8b5cf6",
    cash: "#6b7280", bond: "#f59e0b", crypto: "#ec4899", commodity: "#f97316",
  };
  return Object.entries(map)
    .map(([name, val]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(((val / totalValue) * 100).toFixed(1)),
      color: ASSET_COLORS[name] ?? "#6b7280",
    }))
    .sort((a, b) => b.value - a.value);
}

function buildTickerAlloc(positions: Position[]): AllocationSlice[] {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  return positions.map((p) => ({
    name: p.ticker,
    value: parseFloat(((p.marketValue / totalValue) * 100).toFixed(1)),
    color: `hsl(${(p.ticker.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loaded, setLoaded] = useState(false);
  const [rawRows, setRawRows] = useState<PositionRow[]>([]);

  useEffect(() => {
    positionRepository.list().then(setRawRows).catch(console.error);
  }, []);

  const tickers = useMemo(() => rawRows.map((r) => r.ticker), [rawRows]);
  const { prices: livePrices } = useLivePrices(tickers);

  const usingRealData = rawRows.length > 0;

  const positions: Position[] = useMemo(
    () => usingRealData ? rowsToPositions(rawRows, livePrices) : mockPositions,
    [rawRows, livePrices, usingRealData]
  );

  const summary = useMemo((): PortfolioSummary => {
    const longPositions = positions.filter((p) => (p.direction ?? "long") === "long");
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
    const totalCost = longPositions.reduce((s, p) => s + p.quantity * p.avgCostBasis, 0);
    const totalUnrealisedPL = totalValue - totalCost;
    const totalUnrealisedPLPct = totalCost > 0 ? (totalUnrealisedPL / totalCost) * 100 : 0;
    const dailyPL = positions.reduce(
      (s, p) => s + p.quantity * p.dayChange * ((p.direction ?? "long") === "short" ? -1 : 1), 0
    );
    const dailyPLPct = totalValue > 0 ? (dailyPL / (totalValue - dailyPL)) * 100 : 0;
    const cashPositions = positions.filter((p) => p.assetClass === "cash");
    const cashBalance = cashPositions.reduce((s, p) => s + p.marketValue, 0);
    const cashPct = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalUnrealisedPL,
      totalUnrealisedPLPct,
      dailyPL,
      dailyPLPct,
      cashBalance,
      cashPct,
      positions,
      currency: "GBP",
      lastUpdated: new Date().toISOString(),
    };
  }, [positions]);

  const topMovers = useMemo((): TopMover[] =>
    [...positions]
      .filter((p) => p.dayChangePct !== 0)
      .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
      .slice(0, 5)
      .map((p) => ({
        ticker: p.ticker,
        name: p.name,
        change: p.dayChange,
        changePct: p.dayChangePct,
        logoUrl: p.logoUrl,
      })),
    [positions]
  );

  const geoAlloc = usingRealData ? buildGeoAlloc(positions) : mockGeographyAllocation;
  const assetAlloc = usingRealData ? buildAssetAlloc(positions) : mockAssetClassAllocation;
  const sectorAlloc = usingRealData ? buildTickerAlloc(positions) : mockSectorAllocation;

  const watchlistItems = mockWatchlists[0].items;
  const nonCashCount = positions.filter((p) => p.assetClass !== "cash").length;

  return (
    <>
      <AnimatePresence>
        {!loaded && <LoadingScreen onComplete={() => setLoaded(true)} />}
      </AnimatePresence>

      {loaded && (
        <AppShell
          title="Dashboard"
          subtitle={`${nonCashCount} positions · ${usingRealData ? "live data" : "demo mode"}`}
        >
          <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
            {/* Row 1: Value + Market */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PortfolioValueCard summary={summary} />
              <MarketSnapshot indices={mockMarketIndices.slice(0, 4)} />
            </div>

            {/* Row 2: Performance chart */}
            <div className="grid grid-cols-1 gap-4">
              <PerformanceChart data={mockPerformanceHistory} />
            </div>

            {/* Row 3: Allocation + Top Movers + Watchlist */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <AllocationChart
                sector={sectorAlloc}
                geography={geoAlloc}
                assetClass={assetAlloc}
              />
              <TopMovers movers={usingRealData ? topMovers : []} />
              <div className="lg:col-span-2">
                <WatchlistWidget items={watchlistItems} />
              </div>
            </div>

            {/* Row 4: News + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <NewsFeed news={mockNews} />
              <RecentActivity transactions={mockTransactions} />
            </div>

            {/* Row 5: Insights */}
            <InsightCards insights={mockInsights} />
          </div>
        </AppShell>
      )}
    </>
  );
}
