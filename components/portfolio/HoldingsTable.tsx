"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Search, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPct, formatNumber, cn } from "@/lib/utils";
import type { Position } from "@/lib/types";
import type { PriceQuote } from "@/app/api/prices/route";

type SortKey = keyof Pick<Position, "name" | "marketValue" | "unrealisedPL" | "unrealisedPLPct" | "dayChangePct" | "weight">;

interface HoldingsTableProps {
  positions: Position[];
  onSelect?: (pos: Position) => void;
  onEdit?: (pos: Position) => void;
  onDelete?: (pos: Position) => void;
  livePrices?: Record<string, PriceQuote>;
  isLive?: boolean;
}

export function HoldingsTable({ positions, onSelect, onEdit, onDelete, livePrices = {}, isLive = false }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<string>("all");

  const enriched = useMemo(() =>
    positions.map((pos) => {
      const live = livePrices[pos.ticker];
      if (!live) return pos;
      const price = live.price;
      const marketValue = pos.quantity * price;
      const cost = pos.quantity * pos.avgCostBasis;
      const unrealisedPL = marketValue - cost;
      const unrealisedPLPct = cost > 0 ? (unrealisedPL / cost) * 100 : 0;
      const totalValue = positions.reduce((s, p) => {
        const lp = livePrices[p.ticker]?.price ?? p.currentPrice;
        return s + p.quantity * lp;
      }, 0);
      return {
        ...pos,
        currentPrice: price,
        marketValue,
        unrealisedPL,
        unrealisedPLPct,
        weight: totalValue > 0 ? (marketValue / totalValue) * 100 : pos.weight,
        dayChangePct: live.changePct,
        dayChange: live.change,
      };
    }),
    [positions, livePrices]
  );

  const sorted = useMemo(() => {
    let rows = enriched.filter((p) => {
      const q = query.toLowerCase();
      return (
        (p.ticker.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) &&
        (assetFilter === "all" || p.assetClass === assetFilter)
      );
    });
    rows = [...rows].sort((a, b) => {
      const aVal = a[sortKey] as number | string;
      const bVal = b[sortKey] as number | string;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      }
      return sortDir === "desc"
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
    return rows;
  }, [enriched, sortKey, sortDir, query, assetFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-muted opacity-30" />;
    return sortDir === "desc"
      ? <ChevronDown className="w-3 h-3 text-accent" />
      : <ChevronUp className="w-3 h-3 text-accent" />;
  }

  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "name", label: "Name" },
    { key: "marketValue", label: "Value", align: "right" },
    { key: "weight", label: "Weight", align: "right" },
    { key: "unrealisedPL", label: "P&L", align: "right" },
    { key: "unrealisedPLPct", label: "Return", align: "right" },
    { key: "dayChangePct", label: "Today", align: "right" },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search holdings..."
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
          />
        </div>
        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
        >
          <option value="all">All Assets</option>
          <option value="stock">Stocks</option>
          <option value="etf">ETFs</option>
          <option value="fund">Funds</option>
          <option value="cash">Cash</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {cols.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "px-4 py-3 text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-primary transition-colors",
                      col.align === "right" ? "text-right" : "text-left"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon k={col.key} />
                    </span>
                  </th>
                ))}
                {/* Live price column header */}
                <th className="px-4 py-3 text-right text-muted uppercase tracking-wider font-medium whitespace-nowrap">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse inline-block" />
                      Live Price
                    </span>
                  ) : "Price"}
                </th>
                <th className="px-4 py-3 text-right text-muted uppercase tracking-wider font-medium">Sector</th>
                {(onEdit || onDelete) && <th className="px-4 py-3 w-16" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pos, i) => {
                const isUp = pos.unrealisedPL >= 0;
                const dayUp = pos.dayChangePct >= 0;
                const live = livePrices[pos.ticker];
                const displayPrice = live?.price ?? pos.currentPrice;
                const hasLive = !!live;

                return (
                  <motion.tr
                    key={pos.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => onSelect?.(pos)}
                    className="group border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {pos.logoUrl ? (
                          <img
                            src={pos.logoUrl}
                            alt={pos.name}
                            className="w-6 h-6 rounded-md object-contain bg-surface-3 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-surface-3 flex items-center justify-center shrink-0">
                            <span className="text-2xs font-mono text-muted">{pos.ticker.slice(0, 2)}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-mono font-semibold text-primary">{pos.ticker}</p>
                          <p className="text-muted text-2xs truncate max-w-[120px]">{pos.name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3 text-right">
                      <p className="font-mono font-medium text-primary">
                        {formatCurrency(pos.marketValue, "GBP", true)}
                      </p>
                      <p className="text-muted text-2xs font-mono">{formatNumber(pos.quantity, 0)} units</p>
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-primary">{pos.weight.toFixed(1)}%</span>
                        <div className="w-12 h-1 bg-surface-3 rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(pos.weight * 4, 100)}%` }} />
                        </div>
                      </div>
                    </td>

                    {/* P&L */}
                    <td className="px-4 py-3 text-right">
                      <p className={`font-mono font-medium ${isUp ? "text-gain" : "text-loss"}`}>
                        {isUp ? "+" : ""}{formatCurrency(pos.unrealisedPL, "GBP", true)}
                      </p>
                    </td>

                    {/* Return */}
                    <td className="px-4 py-3 text-right">
                      <Badge variant={isUp ? "gain" : "loss"}>{formatPct(pos.unrealisedPLPct)}</Badge>
                    </td>

                    {/* Today */}
                    <td className="px-4 py-3 text-right">
                      {hasLive ? (
                        <div className={`inline-flex items-center gap-1 font-mono font-medium ${dayUp ? "text-gain" : "text-loss"}`}>
                          {dayUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {dayUp ? "+" : ""}{pos.dayChangePct.toFixed(2)}%
                        </div>
                      ) : (
                        <span className={`font-mono text-xs ${dayUp ? "text-gain" : "text-loss"}`}>
                          {formatPct(pos.dayChangePct)}
                        </span>
                      )}
                    </td>

                    {/* Live Price */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-mono font-semibold ${hasLive ? "text-primary" : "text-muted"}`}>
                          {displayPrice > 100
                            ? formatCurrency(displayPrice, pos.currency)
                            : displayPrice.toFixed(4)}
                        </span>
                        {hasLive ? (
                          <span className={`text-2xs font-mono ${live.change >= 0 ? "text-gain" : "text-loss"}`}>
                            {live.change >= 0 ? "+" : ""}{live.change.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-2xs text-muted italic">stored</span>
                        )}
                      </div>
                    </td>

                    {/* Sector */}
                    <td className="px-4 py-3 text-right">
                      <Badge variant="ghost">{pos.sector.split(" ")[0]}</Badge>
                    </td>

                    {/* Edit / Delete */}
                    {(onEdit || onDelete) && (
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onEdit && (
                            <button
                              onClick={() => onEdit(pos)}
                              className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Edit position"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(pos)}
                              className="p-1.5 rounded-lg text-muted hover:text-loss hover:bg-loss/10 transition-colors"
                              title="Delete position"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-2xs text-muted px-1">
        {sorted.length} of {positions.length} holdings ·{" "}
        {isLive ? "Prices live via Yahoo Finance" : "Prices from last import"}
      </p>
    </div>
  );
}
