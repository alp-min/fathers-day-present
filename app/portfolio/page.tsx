"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, StickyNote, AlertCircle, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { PriceStatusBar } from "@/components/ui/PriceStatusBar";
import { formatCurrency, formatPct, formatDate } from "@/lib/utils";
import { positionRepository, type UpsertPosition } from "@/lib/repositories";
import { useLivePrices } from "@/lib/hooks/useLivePrices";
import type { Position, Currency, AllocationSlice, AssetClass } from "@/lib/types";
import type { PositionRow } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

// ─── Geography helpers ────────────────────────────────────────────────────────

function inferCountry(ticker: string, stored: string): string {
  if (stored && stored !== "United States") return stored; // respect stored value
  const t = ticker.toUpperCase();
  if (t.endsWith(".L")) return "United Kingdom";
  if (t.endsWith(".AX")) return "Australia";
  if (t.endsWith(".TO") || t.endsWith(".TSX")) return "Canada";
  if (t.endsWith(".HK")) return "China";
  if (t.endsWith(".PA") || t.endsWith(".DE") || t.endsWith(".MI") ||
      t.endsWith(".AS") || t.endsWith(".MC") || t.endsWith(".SW") ||
      t.endsWith(".ST") || t.endsWith(".OL") || t.endsWith(".BR")) return "Europe";
  if (t.endsWith("=F")) return "Global"; // futures / commodities
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

// ─── Convert Supabase row → Position ─────────────────────────────────────────

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

// ─── Allocation helpers ───────────────────────────────────────────────────────

function buildGeoAlloc(positions: Position[]): AllocationSlice[] {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const map: Record<string, number> = {};
  for (const p of positions) {
    map[p.geography] = (map[p.geography] ?? 0) + p.marketValue;
  }
  return Object.entries(map)
    .map(([name, val], i) => ({
      name,
      value: parseFloat(((val / totalValue) * 100).toFixed(1)),
      color: geoColor(name, i),
    }))
    .sort((a, b) => b.value - a.value);
}

function buildAssetAlloc(positions: Position[]): AllocationSlice[] {
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const map: Record<string, number> = {};
  for (const p of positions) {
    map[p.assetClass] = (map[p.assetClass] ?? 0) + p.marketValue;
  }
  const ASSET_COLORS: Record<string, string> = {
    stock: "#3b82f6",
    etf: "#10b981",
    fund: "#8b5cf6",
    cash: "#6b7280",
    bond: "#f59e0b",
    crypto: "#ec4899",
    commodity: "#f97316",
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
  return positions.map((p, i) => ({
    name: p.ticker,
    value: parseFloat(((p.marketValue / totalValue) * 100).toFixed(1)),
    color: `hsl(${(p.ticker.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
  }));
}

// ─── Net Exposure Card ────────────────────────────────────────────────────────

function NetExposureCard({ positions }: { positions: Position[] }) {
  const longPositions = positions.filter((p) => (p.direction ?? "long") === "long");
  const shortPositions = positions.filter((p) => p.direction === "short");
  const longValue = longPositions.reduce((s, p) => s + p.marketValue, 0);
  const shortValue = shortPositions.reduce((s, p) => s + p.marketValue, 0);
  const grossValue = longValue + shortValue;
  const netValue = longValue - shortValue;
  const netPct = grossValue > 0 ? (netValue / grossValue) * 100 : 100;
  const longPct = grossValue > 0 ? (longValue / grossValue) * 100 : 100;
  const shortPct = grossValue > 0 ? (shortValue / grossValue) * 100 : 0;

  return (
    <Card delay={0.1}>
      <CardHeader><CardTitle>Net Exposure</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xs text-muted uppercase tracking-wider mb-1">Long</p>
            <p className="text-base font-mono font-semibold text-gain">
              {formatCurrency(longValue, "GBP", true)}
            </p>
            <p className="text-xs font-mono text-muted">{longPct.toFixed(1)}% gross</p>
            <p className="text-2xs text-muted">{longPositions.length} positions</p>
          </div>
          <div>
            <p className="text-2xs text-muted uppercase tracking-wider mb-1">Short</p>
            <p className="text-base font-mono font-semibold text-loss">
              {shortValue > 0 ? `-${formatCurrency(shortValue, "GBP", true)}` : "—"}
            </p>
            <p className="text-xs font-mono text-muted">{shortPct.toFixed(1)}% gross</p>
            <p className="text-2xs text-muted">{shortPositions.length} positions</p>
          </div>
          <div>
            <p className="text-2xs text-muted uppercase tracking-wider mb-1">Net</p>
            <p className={`text-base font-mono font-semibold ${netValue >= 0 ? "text-primary" : "text-loss"}`}>
              {netValue >= 0 ? "" : "-"}{formatCurrency(Math.abs(netValue), "GBP", true)}
            </p>
            <p className="text-xs font-mono text-muted">{netPct.toFixed(1)}% net long</p>
          </div>
        </div>
        {/* Exposure bar */}
        {grossValue > 0 && (
          <div className="mt-4">
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              <div
                className="bg-gain rounded-l-full transition-all"
                style={{ width: `${longPct}%` }}
              />
              {shortPct > 0 && (
                <div
                  className="bg-loss rounded-r-full transition-all"
                  style={{ width: `${shortPct}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-2xs text-gain">Long {longPct.toFixed(0)}%</span>
              {shortPct > 0 && <span className="text-2xs text-loss">Short {shortPct.toFixed(0)}%</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

const CURRENCIES = ["GBP", "USD", "EUR", "AUD"];
const ACCOUNTS = ["General", "ISA", "SIPP", "IG Index", "Interactive Brokers", "Hargreaves Lansdown"];
const ASSET_CLASSES = ["stock", "etf", "fund", "cash", "bond", "crypto", "commodity"];

function EditForm({
  pos,
  onSave,
  onCancel,
  saving,
}: {
  pos: Position;
  onSave: (data: UpsertPosition) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [quantity, setQuantity] = useState(String(pos.quantity));
  const [avgCost, setAvgCost] = useState(String(pos.avgCostBasis));
  const [currentPrice, setCurrentPrice] = useState(String(pos.currentPrice));
  const [currency, setCurrency] = useState(pos.currency);
  const [name, setName] = useState(pos.name);
  const [notes, setNotes] = useState(pos.notes ?? "");
  const [direction, setDirection] = useState<"long" | "short">(pos.direction ?? "long");
  const [account, setAccount] = useState(pos.account ?? "General");
  const [country, setCountry] = useState(pos.geography ?? "United States");
  const [assetClass, setAssetClass] = useState(pos.assetClass ?? "stock");
  const [beta, setBeta] = useState(pos.beta != null ? String(pos.beta) : "");

  const inputClass =
    "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      ticker: pos.ticker,
      name: name.trim() || pos.ticker,
      quantity: parseFloat(quantity),
      avg_cost: parseFloat(avgCost),
      current_price: parseFloat(currentPrice),
      currency,
      direction,
      account: account.trim() || "General",
      country: country.trim() || "United States",
      asset_class: assetClass,
      beta: beta ? parseFloat(beta) : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Direction toggle */}
      <div>
        <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Direction</label>
        <div className="flex gap-2">
          {(["long", "short"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                direction === d
                  ? d === "long"
                    ? "bg-gain/20 border-gain/40 text-gain"
                    : "bg-loss/20 border-loss/40 text-loss"
                  : "bg-surface border-border text-muted hover:text-primary"
              }`}
            >
              {d === "long" ? "▲ Long" : "▼ Short"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Ticker</label>
          <input value={pos.ticker} disabled className={`${inputClass} font-mono opacity-50 cursor-not-allowed`} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Company Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Quantity *</label>
          <input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Avg Cost *</label>
          <input type="number" step="any" min="0" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} required className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Current Price *</label>
          <input type="number" step="any" min="0" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} required className={`${inputClass} font-mono`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)} className={inputClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Asset Class</label>
          <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)} className={inputClass}>
            {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Beta</label>
          <input type="number" step="0.01" value={beta} onChange={(e) => setBeta(e.target.value)} placeholder="e.g. 1.25" className={`${inputClass} font-mono`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Account</label>
          <input list="accounts-list" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="General" className={inputClass} />
          <datalist id="accounts-list">
            {ACCOUNTS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Country / Region</label>
          <input list="country-list" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" className={inputClass} />
          <datalist id="country-list">
            {["United States","United Kingdom","Europe","Australia","Canada","China","Japan","Global","Emerging Markets"].map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      <div>
        <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className={inputClass} />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>Save changes</Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { toast } = useToast();
  const [rawRows, setRawRows] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Position | null>(null);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [deletingPos, setDeletingPos] = useState<Position | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const tickers = rawRows.map((r) => r.ticker);
  const { prices: livePrices, loading: priceLoading, lastUpdated, error: priceError, refresh: refreshPrices } =
    useLivePrices(tickers);

  const loadRows = useCallback(async () => {
    try {
      const data = await positionRepository.list();
      setRawRows(data);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadRows(); }, [loadRows]);

  async function handleEditSave(data: UpsertPosition) {
    setSavingEdit(true);
    try {
      const saved = await positionRepository.upsert(data);
      setRawRows((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
        return prev;
      });
      setEditingPos(null);
      toast(`${saved.ticker} updated`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingPos) return;
    setDeletingId(deletingPos.id);
    try {
      await positionRepository.delete(deletingPos.id);
      setRawRows((prev) => prev.filter((r) => r.id !== deletingPos.id));
      setDeletingPos(null);
      toast("Position removed", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setDeletingId(null);
    }
  }

  const usingRealData = rawRows.length > 0;

  const allPositions: Position[] = usingRealData
    ? rowsToPositions(rawRows, livePrices)
    : [];

  // Unique accounts for filter dropdown
  const accounts = useMemo(() => {
    const set = new Set(allPositions.map((p) => p.account ?? "General").filter(Boolean));
    return Array.from(set).sort();
  }, [allPositions]);

  // Filtered positions for display
  const positions = useMemo(() =>
    accountFilter === "all"
      ? allPositions
      : allPositions.filter((p) => (p.account ?? "General") === accountFilter),
    [allPositions, accountFilter]
  );

  // Summary stats from filtered positions
  const longPositions = positions.filter((p) => (p.direction ?? "long") === "long");
  const totalValue = longPositions.reduce((s, p) => s + p.marketValue, 0);
  const totalCost = longPositions.reduce((s, p) => s + p.quantity * p.avgCostBasis, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const dailyPL = positions.reduce((s, p) => s + p.quantity * p.dayChange * ((p.direction ?? "long") === "short" ? -1 : 1), 0);
  const dailyPLPct = totalValue > 0 ? (dailyPL / (totalValue - dailyPL)) * 100 : 0;

  const summaryStats = [
    { label: "Market Value", value: formatCurrency(totalValue, "GBP"), changePct: dailyPLPct, changeLabel: "today" },
    { label: "Unrealised P&L", value: `${totalPL >= 0 ? "+" : ""}${formatCurrency(totalPL, "GBP", true)}`, changePct: totalPLPct, changeLabel: "total return" },
    { label: "Day Change", value: `${dailyPL >= 0 ? "+" : ""}${formatCurrency(dailyPL, "GBP")}`, changePct: dailyPLPct, changeLabel: "vs yesterday" },
    { label: "Positions", value: String(positions.filter(p => p.assetClass !== "cash").length), changeLabel: `${positions.filter(p => p.direction === "short").length} short` },
  ];

  // Allocation slices
  const geoAlloc = buildGeoAlloc(positions);
  const assetAlloc = buildAssetAlloc(positions);
  const sectorAlloc = buildTickerAlloc(positions);

  const hasShorts = positions.some((p) => p.direction === "short");

  return (
    <AppShell
      title="Portfolio"
      subtitle={usingRealData ? `${positions.filter(p => p.assetClass !== "cash").length} positions · live data` : "No positions yet"}
    >
      <div className="p-5 max-w-[1600px] mx-auto space-y-5">

        {!loading && !usingRealData && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
              <StickyNote className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm font-semibold text-primary mb-1">No positions yet</p>
            <p className="text-xs text-muted mb-4">Import a CSV or add positions manually to get started.</p>
            <a href="/import" className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-dim transition-colors">
              Import positions
            </a>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
            <p className="text-sm text-muted">Loading portfolio…</p>
          </div>
        ) : (
          <>
            {/* Account filter */}
            {usingRealData && accounts.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Account:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {["all", ...accounts].map((acc) => (
                    <button
                      key={acc}
                      onClick={() => setAccountFilter(acc)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                        accountFilter === acc
                          ? "bg-accent/20 border-accent/40 text-accent"
                          : "bg-surface border-border text-muted hover:text-primary"
                      }`}
                    >
                      {acc === "all" ? "All Accounts" : acc}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {summaryStats.map((s, i) => (
                <Card key={s.label} delay={i * 0.05} className="p-5">
                  <Stat {...s} size="sm" />
                </Card>
              ))}
            </div>

            {/* Net exposure (only shown when there are short positions or multiple accounts) */}
            {usingRealData && (hasShorts || positions.length > 0) && (
              <NetExposureCard positions={positions} />
            )}

            {/* Live price status bar */}
            {usingRealData && (
              <PriceStatusBar
                loading={priceLoading}
                lastUpdated={lastUpdated}
                error={priceError}
                onRefresh={refreshPrices}
                count={tickers.length}
              />
            )}

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <div className="lg:col-span-3">
                <HoldingsTable
                  positions={positions}
                  onSelect={setSelected}
                  onEdit={usingRealData ? setEditingPos : undefined}
                  onDelete={usingRealData ? setDeletingPos : undefined}
                  livePrices={livePrices}
                  isLive={usingRealData && lastUpdated !== null}
                />
              </div>

              {/* Right rail */}
              <div className="space-y-4">
                <AllocationChart
                  sector={sectorAlloc}
                  geography={geoAlloc}
                  assetClass={assetAlloc}
                />

                <Card delay={0.3}>
                  <CardHeader>
                    <CardTitle>Top Positions</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {[...positions]
                      .sort((a, b) => b.marketValue - a.marketValue)
                      .slice(0, 5)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-1.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-mono font-medium text-primary">{p.ticker}</p>
                              {p.direction === "short" && (
                                <span className="text-2xs font-mono text-loss bg-loss/10 px-1 rounded">SHORT</span>
                              )}
                            </div>
                            <p className="text-2xs text-muted">{p.account ?? "General"}</p>
                          </div>
                          <Badge variant={p.unrealisedPL >= 0 ? "gain" : "loss"}>
                            {p.unrealisedPL >= 0 ? "+" : ""}{p.unrealisedPLPct.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    {positions.length === 0 && (
                      <p className="text-xs text-muted py-2">No positions yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Position detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border z-50 overflow-y-auto"
            >
              <div className="p-5 space-y-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {selected.logoUrl && (
                      <img src={selected.logoUrl} alt={selected.name}
                        className="w-10 h-10 rounded-xl object-contain bg-surface-3"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-semibold text-lg text-primary">{selected.ticker}</p>
                        {selected.direction === "short" && (
                          <span className="text-xs font-mono text-loss bg-loss/10 px-1.5 py-0.5 rounded border border-loss/20">SHORT</span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{selected.name}</p>
                      {selected.account && <p className="text-2xs text-accent mt-0.5">{selected.account}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-2 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-surface-2 rounded-xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-2xs text-muted uppercase tracking-wider">Current Price</p>
                    {livePrices[selected.ticker] && (
                      <span className="flex items-center gap-1 text-2xs text-gain">
                        <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-mono font-semibold text-primary">
                    {selected.currentPrice > 100
                      ? formatCurrency(selected.currentPrice, selected.currency)
                      : `${selected.currentPrice.toFixed(4)}`}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-sm font-mono ${selected.dayChangePct >= 0 ? "text-gain" : "text-loss"}`}>
                    <span>{selected.dayChangePct >= 0 ? "▲" : "▼"}</span>
                    <span>
                      {selected.dayChangePct >= 0 ? "+" : ""}{selected.dayChange.toFixed(2)}{" "}
                      ({formatPct(selected.dayChangePct)}) today
                    </span>
                  </div>
                </div>

                {/* P&L highlight */}
                <div className={`rounded-xl p-4 border ${selected.unrealisedPL >= 0 ? "bg-gain/5 border-gain/20" : "bg-loss/5 border-loss/20"}`}>
                  <p className="text-2xs text-muted uppercase tracking-wider mb-1">Unrealised P&L</p>
                  <p className={`text-2xl font-mono font-semibold ${selected.unrealisedPL >= 0 ? "text-gain" : "text-loss"}`}>
                    {selected.unrealisedPL >= 0 ? "+" : ""}{formatCurrency(selected.unrealisedPL, "GBP", true)}
                  </p>
                  <p className={`text-sm font-mono mt-0.5 ${selected.unrealisedPLPct >= 0 ? "text-gain" : "text-loss"}`}>
                    {selected.unrealisedPLPct >= 0 ? "+" : ""}{selected.unrealisedPLPct.toFixed(2)}% total return
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Market Value", value: formatCurrency(selected.marketValue, "GBP", true) },
                    { label: "Quantity", value: selected.quantity.toLocaleString() },
                    { label: "Avg. Cost", value: formatCurrency(selected.avgCostBasis, selected.currency) },
                    { label: "Portfolio Weight", value: `${selected.weight.toFixed(1)}%` },
                  ].map((item) => (
                    <div key={item.label} className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-2xs text-muted">{item.label}</p>
                      <p className="text-sm font-mono font-medium mt-0.5 text-primary">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-2xs text-muted uppercase tracking-wider">Details</p>
                  {[
                    { label: "Currency", value: selected.currency },
                    { label: "Asset Class", value: selected.assetClass },
                    { label: "Geography", value: selected.geography },
                    { label: "Account", value: selected.account ?? "General" },
                    selected.beta != null && { label: "Beta", value: selected.beta.toFixed(2) },
                    { label: "Added", value: formatDate(selected.addedDate, "medium") },
                  ].filter(Boolean).map((item) => (
                    <div key={(item as {label:string}).label}
                      className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                      <span className="text-xs text-muted">{(item as {label:string}).label}</span>
                      <span className="text-xs font-mono text-primary">{(item as {value:string}).value}</span>
                    </div>
                  ))}
                </div>

                {selected.notes && (
                  <div className="bg-surface-2 rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StickyNote className="w-3.5 h-3.5 text-accent" />
                      <p className="text-2xs text-muted uppercase tracking-wider">Notes</p>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{selected.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <Modal open={!!editingPos} onClose={() => setEditingPos(null)} title={`Edit ${editingPos?.ticker ?? "Position"}`} size="md">
        {editingPos && (
          <EditForm pos={editingPos} onSave={handleEditSave} onCancel={() => setEditingPos(null)} saving={savingEdit} />
        )}
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deletingPos} onClose={() => setDeletingPos(null)} title="Delete Position" size="sm">
        {deletingPos && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Are you sure you want to remove{" "}
              <span className="font-mono font-semibold text-primary">{deletingPos.ticker}</span>{" "}
              ({deletingPos.name}) from your portfolio?
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setDeletingPos(null)}>Cancel</Button>
              <Button variant="primary" size="sm" loading={deletingId === deletingPos.id}
                onClick={handleDeleteConfirm} className="bg-loss hover:bg-loss/80 border-loss/40">
                Delete position
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
