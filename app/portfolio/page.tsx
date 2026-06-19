"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, StickyNote, AlertCircle, Loader2, Pencil, Trash2 } from "lucide-react";
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
import {
  mockPositions,
  mockPortfolioSummary,
  mockSectorAllocation,
  mockGeographyAllocation,
  mockAssetClassAllocation,
} from "@/lib/mock-data";
import type { Position, Currency } from "@/lib/types";
import type { PositionRow } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

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
    const marketValue = r.quantity * price;
    const cost = r.quantity * r.avg_cost;
    const unrealisedPL = marketValue - cost;
    const unrealisedPLPct = cost > 0 ? (unrealisedPL / cost) * 100 : 0;
    const dayChangePct = live?.changePct ?? 0;
    const dayChange = live?.change ?? 0;
    const weight = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;

    return {
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      assetClass: "stock",
      sector: "Communication Services",
      geography: "Global",
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
      addedDate: r.created_at,
      notes: r.notes ?? undefined,
    } satisfies Position;
  });
}

const CURRENCIES = ["GBP", "USD", "EUR", "AUD"];

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
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)} className={inputClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className={inputClass} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>Save changes</Button>
      </div>
    </form>
  );
}

export default function PortfolioPage() {
  const { toast } = useToast();
  const [rawRows, setRawRows] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Position | null>(null);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [deletingPos, setDeletingPos] = useState<Position | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const positions: Position[] = usingRealData
    ? rowsToPositions(rawRows, livePrices)
    : mockPositions;

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalCost = positions.reduce((s, p) => s + p.quantity * p.avgCostBasis, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const dailyPL = positions.reduce((s, p) => s + p.quantity * p.dayChange, 0);
  const dailyPLPct = totalValue > 0 ? (dailyPL / (totalValue - dailyPL)) * 100 : 0;

  const totalDividendYield = positions.reduce((acc, p) => {
    if (p.dividendYield) return acc + (p.marketValue / totalValue) * p.dividendYield;
    return acc;
  }, 0);

  const summaryStats = [
    { label: "Market Value", value: formatCurrency(totalValue, "GBP"), changePct: dailyPLPct, changeLabel: "today" },
    { label: "Unrealised P&L", value: `${totalPL >= 0 ? "+" : ""}${formatCurrency(totalPL, "GBP", true)}`, changePct: totalPLPct, changeLabel: "total return" },
    { label: "Day Change", value: `${dailyPL >= 0 ? "+" : ""}${formatCurrency(dailyPL, "GBP")}`, changePct: dailyPLPct, changeLabel: "vs yesterday" },
    { label: "Blended Yield", value: `${totalDividendYield.toFixed(2)}%` },
  ];

  const sectorAlloc = usingRealData
    ? positions.map((p, _, arr) => ({
        name: p.ticker,
        value: parseFloat(((p.marketValue / arr.reduce((s, x) => s + x.marketValue, 0)) * 100).toFixed(1)),
        color: `hsl(${(p.ticker.charCodeAt(0) * 47) % 360}, 60%, 55%)`,
      }))
    : mockSectorAllocation;

  return (
    <AppShell
      title="Portfolio"
      subtitle={`${positions.filter(p => p.assetClass !== "cash").length} positions · ${usingRealData ? "live data" : "sample data"}`}
    >
      <div className="p-5 max-w-[1600px] mx-auto space-y-5">

        {!loading && !usingRealData && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 bg-surface-2 border border-warn/30 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 text-warn shrink-0" />
            <p className="text-xs text-muted flex-1">
              Showing <span className="text-warn font-medium">sample data</span> — go to{" "}
              <a href="/import" className="text-accent underline underline-offset-2">Import Data</a>{" "}
              to add your real portfolio positions.
            </p>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
            <p className="text-sm text-muted">Loading portfolio…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {summaryStats.map((s, i) => (
                <Card key={s.label} delay={i * 0.05} className="p-5">
                  <Stat {...s} size="sm" />
                </Card>
              ))}
            </div>

            {usingRealData && (
              <PriceStatusBar
                loading={priceLoading}
                lastUpdated={lastUpdated}
                error={priceError}
                onRefresh={refreshPrices}
                count={tickers.length}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <div className="lg:col-span-3">
                <HoldingsTable
                  positions={usingRealData ? positions : mockPositions}
                  onSelect={setSelected}
                  onEdit={usingRealData ? setEditingPos : undefined}
                  onDelete={usingRealData ? setDeletingPos : undefined}
                  livePrices={usingRealData ? livePrices : {}}
                  isLive={usingRealData && lastUpdated !== null}
                />
              </div>

              <div className="space-y-4">
                <AllocationChart
                  sector={sectorAlloc}
                  geography={usingRealData ? sectorAlloc : mockGeographyAllocation}
                  assetClass={usingRealData ? sectorAlloc : mockAssetClassAllocation}
                />

                <Card delay={0.3}>
                  <CardHeader>
                    <CardTitle>{usingRealData ? "Top Positions" : "Top Dividends"}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {usingRealData
                      ? [...positions]
                          .sort((a, b) => b.marketValue - a.marketValue)
                          .slice(0, 5)
                          .map((p) => (
                            <div key={p.id} className="flex items-center justify-between py-1.5">
                              <div>
                                <p className="text-xs font-mono font-medium text-primary">{p.ticker}</p>
                                <p className="text-2xs text-muted">{p.name.split(" ").slice(0, 2).join(" ")}</p>
                              </div>
                              <Badge variant={p.unrealisedPL >= 0 ? "gain" : "loss"}>
                                {p.unrealisedPL >= 0 ? "+" : ""}{p.unrealisedPLPct.toFixed(1)}%
                              </Badge>
                            </div>
                          ))
                      : mockPositions
                          .filter((p) => p.dividendYield && p.dividendYield > 1)
                          .sort((a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0))
                          .map((p) => (
                            <div key={p.id} className="flex items-center justify-between py-1.5">
                              <div>
                                <p className="text-xs font-mono font-medium text-primary">{p.ticker}</p>
                                <p className="text-2xs text-muted">{p.name.split(" ").slice(0, 2).join(" ")}</p>
                              </div>
                              <Badge variant="gain">{p.dividendYield?.toFixed(1)}% yield</Badge>
                            </div>
                          ))}
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
                      <img
                        src={selected.logoUrl}
                        alt={selected.name}
                        className="w-10 h-10 rounded-xl object-contain bg-surface-3"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div>
                      <p className="font-mono font-semibold text-lg text-primary">{selected.ticker}</p>
                      <p className="text-xs text-muted">{selected.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-2 transition-colors"
                  >
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

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Market Value", value: formatCurrency(selected.marketValue, "GBP", true) },
                    { label: "Quantity", value: selected.quantity.toLocaleString() },
                    { label: "Avg. Cost", value: formatCurrency(selected.avgCostBasis, selected.currency) },
                    { label: "Portfolio Weight", value: `${selected.weight.toFixed(1)}%` },
                    {
                      label: "Unrealised P&L",
                      value: `${selected.unrealisedPL >= 0 ? "+" : ""}${formatCurrency(selected.unrealisedPL, "GBP", true)}`,
                      color: selected.unrealisedPL >= 0 ? "text-gain" : "text-loss",
                    },
                    {
                      label: "Total Return",
                      value: formatPct(selected.unrealisedPLPct),
                      color: selected.unrealisedPLPct >= 0 ? "text-gain" : "text-loss",
                    },
                  ].map((item) => (
                    <div key={item.label} className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-2xs text-muted">{item.label}</p>
                      <p className={`text-sm font-mono font-medium mt-0.5 ${item.color ?? "text-primary"}`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-2xs text-muted uppercase tracking-wider">Key Metrics</p>
                  {[
                    { label: "Currency", value: selected.currency },
                    { label: "Added", value: formatDate(selected.addedDate, "medium") },
                    selected.peRatio && { label: "P/E Ratio", value: `${selected.peRatio}x` },
                    selected.beta && { label: "Beta", value: selected.beta.toFixed(2) },
                    selected.dividendYield && { label: "Div. Yield", value: `${selected.dividendYield}%` },
                    selected.analystTarget && {
                      label: "Analyst Target",
                      value: formatCurrency(selected.analystTarget, selected.currency),
                    },
                  ]
                    .filter(Boolean)
                    .map((item) => (
                      <div
                        key={(item as { label: string }).label}
                        className="flex justify-between items-center py-1.5 border-b border-border last:border-0"
                      >
                        <span className="text-xs text-muted">{(item as { label: string }).label}</span>
                        <span className="text-xs font-mono text-primary">{(item as { value: string }).value}</span>
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
      <Modal
        open={!!editingPos}
        onClose={() => setEditingPos(null)}
        title={`Edit ${editingPos?.ticker ?? "Position"}`}
        size="md"
      >
        {editingPos && (
          <EditForm
            pos={editingPos}
            onSave={handleEditSave}
            onCancel={() => setEditingPos(null)}
            saving={savingEdit}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deletingPos}
        onClose={() => setDeletingPos(null)}
        title="Delete Position"
        size="sm"
      >
        {deletingPos && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Are you sure you want to remove{" "}
              <span className="font-mono font-semibold text-primary">{deletingPos.ticker}</span>{" "}
              ({deletingPos.name}) from your portfolio? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setDeletingPos(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                loading={deletingId === deletingPos.id}
                onClick={handleDeleteConfirm}
                className="bg-loss hover:bg-loss/80 border-loss/40"
              >
                Delete position
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
