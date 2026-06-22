"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Plug, CheckCircle, AlertCircle,
  Plus, Trash2, Loader2, Download, X, RefreshCw,
  TrendingUp, TrendingDown, Pencil,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PriceStatusBar } from "@/components/ui/PriceStatusBar";
import { positionRepository, type UpsertPosition } from "@/lib/repositories";
import type { PositionRow } from "@/lib/supabase";
import { useLivePrices } from "@/lib/hooks/useLivePrices";

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

type ParsedRow = {
  ticker: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  currency: string;
  direction: string;
  account: string;
  asset_class: string;
  country: string;
  beta: number | null;
  _error?: string;
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  return lines.slice(1).map((line) => {
    const vals: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur.trim());

    const get = (key: string) => vals[headers.indexOf(key)]?.trim() ?? "";
    const ticker = get("ticker").toUpperCase();
    const name = get("name") || ticker;
    const quantity = parseFloat(get("quantity"));
    const avg_cost = parseFloat(get("avg_cost"));
    const current_price = parseFloat(get("current_price"));
    const currency = (get("currency") || "GBP").toUpperCase();
    const direction = get("direction") || "long";
    const account = get("account") || "General";
    const asset_class = get("asset_class") || "stock";
    const country = get("country") || "United States";
    const betaRaw = get("beta");
    const beta = betaRaw ? parseFloat(betaRaw) : null;

    const errors: string[] = [];
    if (!ticker) errors.push("missing ticker");
    if (isNaN(quantity) || quantity <= 0) errors.push("invalid quantity");
    if (isNaN(avg_cost) || avg_cost < 0) errors.push("invalid avg_cost");
    if (isNaN(current_price) || current_price < 0) errors.push("invalid current_price");

    return {
      ticker, name,
      quantity: isNaN(quantity) ? 0 : quantity,
      avg_cost: isNaN(avg_cost) ? 0 : avg_cost,
      current_price: isNaN(current_price) ? 0 : current_price,
      currency, direction, account, asset_class, country,
      beta: beta != null && isNaN(beta) ? null : beta,
      _error: errors.length ? errors.join(", ") : undefined,
    };
  });
}

const CSV_TEMPLATE =
  "ticker,name,quantity,avg_cost,current_price,currency,direction,account,asset_class,country,beta\n" +
  "AAPL,Apple Inc.,50,145.20,189.50,USD,long,General,stock,United States,1.25\n" +
  "LLOY.L,Lloyds Banking Group,2000,0.52,0.56,GBP,long,ISA,stock,United Kingdom,0.92\n" +
  "GLD,SPDR Gold Trust,20,165.00,185.00,USD,long,General,etf,Global,\n" +
  "TSLA,Tesla Inc.,10,220.00,180.00,USD,short,IG Index,stock,United States,2.30\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Manual Entry Form ────────────────────────────────────────────────────────

const CURRENCIES = ["GBP", "USD", "EUR", "AUD"];
const ACCOUNTS = ["General", "ISA", "SIPP", "IG Index", "Interactive Brokers", "Hargreaves Lansdown"];
const ASSET_CLASSES = ["stock", "etf", "fund", "cash", "bond", "crypto", "commodity"];
const COUNTRIES = ["United States", "United Kingdom", "Europe", "Australia", "Canada", "China", "Japan", "Global", "Emerging Markets"];

interface ManualFormProps {
  initial?: Partial<UpsertPosition>;
  onSave: (data: UpsertPosition) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ManualForm({ initial, onSave, onCancel, saving }: ManualFormProps) {
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : "");
  const [avgCost, setAvgCost] = useState(initial?.avg_cost != null ? String(initial.avg_cost) : "");
  const [currentPrice, setCurrentPrice] = useState(initial?.current_price != null ? String(initial.current_price) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? "GBP");
  const [direction, setDirection] = useState<"long" | "short">((initial?.direction as "long" | "short") ?? "long");
  const [account, setAccount] = useState(initial?.account ?? "General");
  const [assetClass, setAssetClass] = useState(initial?.asset_class ?? "stock");
  const [country, setCountry] = useState(initial?.country ?? "United States");
  const [beta, setBeta] = useState(initial?.beta != null ? String(initial.beta) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({
      ticker: ticker.trim().toUpperCase(),
      name: name.trim() || ticker.trim().toUpperCase(),
      quantity: parseFloat(quantity),
      avg_cost: parseFloat(avgCost),
      current_price: parseFloat(currentPrice),
      currency,
      direction,
      account: account.trim() || "General",
      asset_class: assetClass,
      country: country.trim() || "United States",
      beta: beta ? parseFloat(beta) : null,
      notes: notes.trim() || null,
    });
  }

  const inputClass =
    "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Direction */}
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

      {/* Ticker + Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Ticker *</label>
          <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" required
            className={`${inputClass} font-mono uppercase`} autoFocus={!initial} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Company Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc." className={inputClass} />
        </div>
      </div>

      {/* Qty / Cost / Price */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Quantity *</label>
          <input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            placeholder="100" required className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Avg Cost *</label>
          <input type="number" step="any" min="0" value={avgCost} onChange={(e) => setAvgCost(e.target.value)}
            placeholder="145.20" required className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Current Price *</label>
          <input type="number" step="any" min="0" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="189.50" required className={`${inputClass} font-mono`} />
        </div>
      </div>

      {/* Currency / Asset Class / Beta */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Asset Class</label>
          <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)} className={inputClass}>
            {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Beta</label>
          <input type="number" step="0.01" value={beta} onChange={(e) => setBeta(e.target.value)}
            placeholder="e.g. 1.25" className={`${inputClass} font-mono`} />
        </div>
      </div>

      {/* Account / Country */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Account</label>
          <input list="accounts-list-form" value={account} onChange={(e) => setAccount(e.target.value)}
            placeholder="General" className={inputClass} />
          <datalist id="accounts-list-form">
            {ACCOUNTS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Country / Region</label>
          <input list="country-list-form" value={country} onChange={(e) => setCountry(e.target.value)}
            placeholder="United States" className={inputClass} />
          <datalist id="country-list-form">
            {COUNTRIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Notes</label>
        <input value={notes ?? ""} onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..." className={inputClass} />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>Save position</Button>
      </div>
    </form>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({ row, onConfirm, onCancel, deleting }: {
  row: PositionRow; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">
        Are you sure you want to remove{" "}
        <span className="font-mono font-semibold text-primary">{row.ticker}</span>{" "}
        ({row.name}) from your portfolio? This cannot be undone.
      </p>
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" loading={deleting} onClick={onConfirm}
          className="bg-loss hover:bg-loss/80 border-loss/40">
          Delete position
        </Button>
      </div>
    </div>
  );
}

// ─── Positions Table ──────────────────────────────────────────────────────────

function PositionsTable({ positions, livePrices, onEdit, onDelete }: {
  positions: PositionRow[];
  livePrices: ReturnType<typeof useLivePrices>["prices"];
  onEdit: (row: PositionRow) => void;
  onDelete: (row: PositionRow) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {["Ticker", "Name", "Dir", "Account", "Qty", "Avg Cost", "Live Price", "Day", "P&L", "Value", ""].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-2xs text-muted uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((row) => {
            const live = livePrices[row.ticker];
            const price = live?.price ?? row.current_price;
            const isShort = row.direction === "short";
            const value = row.quantity * price;
            const cost = row.quantity * row.avg_cost;
            const pl = isShort ? cost - value : value - cost;
            const plPct = cost > 0 ? (pl / cost) * 100 : 0;
            const isGain = pl >= 0;
            const dayChange = live?.changePct ?? null;
            const dayUp = dayChange !== null && dayChange >= 0;

            return (
              <tr key={row.id} className="group border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-primary">{row.ticker}</span>
                    {isShort && <span className="text-2xs font-mono text-loss bg-loss/10 px-1 rounded">S</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-secondary max-w-[120px] truncate">{row.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-2xs font-mono font-medium ${isShort ? "text-loss" : "text-gain"}`}>
                    {isShort ? "SHORT" : "LONG"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{row.account ?? "General"}</td>
                <td className="px-4 py-3 font-mono text-secondary">{row.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-secondary">{fmt(row.avg_cost)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-primary">{fmt(price)}</span>
                    {live && <span className="text-2xs text-muted">{row.currency}</span>}
                    {!live && <span className="text-2xs text-muted italic">stored</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {dayChange !== null ? (
                    <div className={`flex items-center gap-1 font-mono font-medium text-xs ${dayUp ? "text-gain" : "text-loss"}`}>
                      {dayUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {dayUp ? "+" : ""}{fmt(dayChange, 2)}%
                    </div>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono font-semibold ${isGain ? "text-gain" : "text-loss"}`}>
                    {isGain ? "+" : ""}{pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className={`block text-2xs font-mono ${isGain ? "text-gain" : "text-loss"}`}>
                    {isGain ? "+" : ""}{fmt(plPct, 1)}%
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-primary">
                  {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(row)}
                      className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(row)}
                      className="p-1.5 rounded-lg text-muted hover:text-loss hover:bg-loss/10 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        {positions.length > 0 && (
          <tfoot>
            <tr className="border-t border-border bg-surface-2">
              <td colSpan={8} className="px-4 py-3 text-2xs text-muted uppercase tracking-wider font-medium">Portfolio Total</td>
              <td className="px-4 py-3">
                {(() => {
                  const totalCost = positions.reduce((s, r) => s + r.quantity * r.avg_cost, 0);
                  const totalValue = positions.reduce((s, r) => {
                    const price = livePrices[r.ticker]?.price ?? r.current_price;
                    const isShort = r.direction === "short";
                    const mv = r.quantity * price;
                    const cost = r.quantity * r.avg_cost;
                    return s + (isShort ? cost - mv : mv - cost);
                  }, 0);
                  const pct = totalCost > 0 ? (totalValue / totalCost) * 100 : 0;
                  const up = totalValue >= 0;
                  return (
                    <span className={`font-mono font-semibold ${up ? "text-gain" : "text-loss"}`}>
                      {up ? "+" : ""}{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className={`block text-2xs font-mono ${up ? "text-gain" : "text-loss"}`}>
                        {up ? "+" : ""}{fmt(pct, 1)}%
                      </span>
                    </span>
                  );
                })()}
              </td>
              <td className="px-4 py-3 font-mono font-semibold text-primary">
                {positions.reduce((sum, row) => {
                  const price = livePrices[row.ticker]?.price ?? row.current_price;
                  return sum + row.quantity * price;
                }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Broker Cards ─────────────────────────────────────────────────────────────

const BROKERS = [
  { id: "ig", name: "IG Index", logo: "🏦", status: "placeholder", description: "API integration in development. Use CSV export from IG for now." },
  { id: "manual", name: "Manual Entry", logo: "✏️", status: "active", description: "Add positions and transactions by hand." },
  { id: "csv", name: "CSV Import", logo: "📄", status: "active", description: "Import from any broker using our CSV template." },
  { id: "ib", name: "Interactive Brokers", logo: "🌐", status: "coming", description: "IBKR API integration — coming soon." },
  { id: "hl", name: "Hargreaves Lansdown", logo: "🇬🇧", status: "coming", description: "HL integration — coming soon." },
];

const STATUS_CONFIG = {
  active: { label: "Active", variant: "gain" as const },
  placeholder: { label: "Placeholder", variant: "warn" as const },
  coming: { label: "Coming Soon", variant: "default" as const },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);

  const [showManual, setShowManual] = useState(false);
  const [editingRow, setEditingRow] = useState<PositionRow | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  const [deletingRow, setDeletingRow] = useState<PositionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);

  const tickers = positions.map((p) => p.ticker);
  const { prices: livePrices, loading: priceLoading, lastUpdated, error: priceError, refresh: refreshPrices } =
    useLivePrices(tickers);

  const loadPositions = useCallback(async () => {
    try {
      const data = await positionRepository.list();
      setPositions(data);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoadingPositions(false);
    }
  }, [toast]);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { toast("Please upload a .csv file", "error"); return; }
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { toast("No data rows found in CSV", "error"); return; }
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleImport() {
    if (!parsedRows) return;
    const valid = parsedRows.filter((r) => !r._error);
    if (valid.length === 0) { toast("No valid rows to import", "error"); return; }
    setImporting(true);
    try {
      await positionRepository.upsertMany(valid);
      setImportResult({ count: valid.length });
      setParsedRows(null);
      setFileName("");
      toast(`${valid.length} position${valid.length !== 1 ? "s" : ""} imported`, "success");
      await loadPositions();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }

  async function handleManualSave(data: UpsertPosition) {
    setSavingManual(true);
    try {
      const saved = await positionRepository.upsert(data);
      setPositions((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
        return [saved, ...prev];
      });
      setShowManual(false);
      setEditingRow(null);
      toast(`${saved.ticker} saved`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSavingManual(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingRow) return;
    setDeletingId(deletingRow.id);
    try {
      await positionRepository.delete(deletingRow.id);
      setPositions((prev) => prev.filter((p) => p.id !== deletingRow.id));
      toast("Position removed", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setDeletingId(null);
      setDeletingRow(null);
    }
  }

  function handleBrokerAction(id: string) {
    if (id === "manual") setShowManual(true);
    if (id === "csv") document.getElementById("csv-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const errorRows = parsedRows?.filter((r) => r._error) ?? [];
  const validRows = parsedRows?.filter((r) => !r._error) ?? [];

  const editInitial: Partial<UpsertPosition> | undefined = editingRow
    ? {
        ticker: editingRow.ticker, name: editingRow.name,
        quantity: editingRow.quantity, avg_cost: editingRow.avg_cost,
        current_price: editingRow.current_price, currency: editingRow.currency,
        direction: editingRow.direction, account: editingRow.account,
        asset_class: editingRow.asset_class, country: editingRow.country,
        beta: editingRow.beta, notes: editingRow.notes,
      }
    : undefined;

  return (
    <AppShell title="Import Data" subtitle="Connect brokers and import portfolio data">
      <div className="p-5 max-w-[1100px] mx-auto space-y-6">

        {/* Broker connections */}
        <div>
          <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">Broker Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BROKERS.map((broker, i) => {
              const cfg = STATUS_CONFIG[broker.status as keyof typeof STATUS_CONFIG];
              return (
                <motion.div key={broker.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-surface border border-border rounded-xl p-4 flex items-start gap-4 hover:border-border-subtle transition-all"
                >
                  <span className="text-2xl shrink-0">{broker.logo}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-primary">{broker.name}</p>
                      <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted">{broker.description}</p>
                  </div>
                  <Button variant={broker.status === "active" ? "secondary" : "ghost"} size="sm"
                    disabled={broker.status === "coming" || broker.status === "placeholder"}
                    icon={broker.status === "active" ? <Plug /> : undefined}
                    onClick={() => handleBrokerAction(broker.id)}>
                    {broker.status === "active" ? "Connect" : broker.status === "coming" ? "Soon" : "Setup"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CSV Import */}
        <div id="csv-section" />
        <Card delay={0.3}>
          <CardHeader><CardTitle>CSV Import</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-4">
            <p className="text-xs text-muted">
              Required columns:{" "}
              <span className="font-mono text-accent">ticker, name, quantity, avg_cost, current_price, currency</span>
              {" "}— optional:{" "}
              <span className="font-mono text-accent">direction, account, asset_class, country, beta</span>
            </p>

            <AnimatePresence>
              {importResult && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 p-3 bg-gain-dim border border-gain/30 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-gain shrink-0" />
                  <p className="text-sm text-gain font-medium">{importResult.count} position{importResult.count !== 1 ? "s" : ""} imported successfully.</p>
                  <button onClick={() => setImportResult(null)} className="ml-auto text-muted hover:text-primary"><X className="w-4 h-4" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {!parsedRows && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                  dragging ? "border-accent bg-accent-glow" : "border-border hover:border-border-subtle hover:bg-surface-2"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-10 h-10 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-primary">Drop CSV file here</p>
                    <p className="text-xs text-muted mt-1">or click to browse</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
                </div>
              </div>
            )}

            <AnimatePresence>
              {parsedRows && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-primary">{fileName}</p>
                      <Badge variant="gain">{validRows.length} valid</Badge>
                      {errorRows.length > 0 && <Badge variant="loss">{errorRows.length} errors</Badge>}
                    </div>
                    <button onClick={() => { setParsedRows(null); setFileName(""); }}
                      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-2 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="border-b border-border bg-surface-2">
                          {["Ticker", "Name", "Dir", "Account", "Qty", "Avg Cost", "Current", "Currency", "Status"].map((h) => (
                            <th key={h} className="text-left px-3 py-2.5 text-2xs text-muted uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, i) => (
                          <tr key={i} className={`border-b border-border last:border-0 ${row._error ? "bg-loss-dim/30" : ""}`}>
                            <td className="px-3 py-2 font-mono font-semibold text-primary">{row.ticker || "—"}</td>
                            <td className="px-3 py-2 text-secondary max-w-[100px] truncate">{row.name}</td>
                            <td className="px-3 py-2">
                              <span className={`font-mono text-2xs ${row.direction === "short" ? "text-loss" : "text-gain"}`}>
                                {row.direction?.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted">{row.account}</td>
                            <td className="px-3 py-2 font-mono text-secondary">{row.quantity}</td>
                            <td className="px-3 py-2 font-mono text-secondary">{row.avg_cost}</td>
                            <td className="px-3 py-2 font-mono text-secondary">{row.current_price}</td>
                            <td className="px-3 py-2 text-muted">{row.currency}</td>
                            <td className="px-3 py-2">
                              {row._error
                                ? <span className="text-loss text-2xs">{row._error}</span>
                                : <CheckCircle className="w-3.5 h-3.5 text-gain" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="ghost" size="sm" onClick={() => { setParsedRows(null); setFileName(""); }}>Cancel</Button>
                    <Button variant="primary" size="sm" loading={importing} disabled={validRows.length === 0}
                      icon={<Upload />} onClick={handleImport}>
                      Import {validRows.length} position{validRows.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg border border-border">
              <AlertCircle className="w-4 h-4 text-accent shrink-0" />
              <p className="text-xs text-muted flex-1">Download the template to see all supported columns including direction, account, and beta.</p>
              <Button variant="ghost" size="sm" icon={<Download />} onClick={downloadTemplate}>Download template</Button>
            </div>
          </CardContent>
        </Card>

        {/* Positions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
              Imported Positions
              {positions.length > 0 && <span className="ml-2 text-muted normal-case font-normal">({positions.length})</span>}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={<RefreshCw />} onClick={loadPositions}>Refresh</Button>
              <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => setShowManual(true)}>Add manually</Button>
            </div>
          </div>

          {positions.length > 0 && (
            <div className="mb-3">
              <PriceStatusBar loading={priceLoading} lastUpdated={lastUpdated} error={priceError}
                onRefresh={refreshPrices} count={positions.length} />
            </div>
          )}

          {loadingPositions ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 text-muted animate-spin" />
              <p className="text-sm text-muted">Loading positions...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted mb-4">No positions imported yet.</p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" icon={<Upload />} onClick={() => fileInputRef.current?.click()}>Import CSV</Button>
                <Button variant="ghost" icon={<Plus />} onClick={() => setShowManual(true)}>Add manually</Button>
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <PositionsTable positions={positions} livePrices={livePrices}
                onEdit={setEditingRow} onDelete={setDeletingRow} />
            </motion.div>
          )}
        </div>
      </div>

      <Modal open={showManual} onClose={() => setShowManual(false)} title="Add Position Manually" size="md">
        <ManualForm onSave={handleManualSave} onCancel={() => setShowManual(false)} saving={savingManual} />
      </Modal>

      <Modal open={!!editingRow} onClose={() => setEditingRow(null)}
        title={`Edit ${editingRow?.ticker ?? "Position"}`} size="md">
        {editingRow && (
          <ManualForm key={editingRow.id} initial={editInitial}
            onSave={handleManualSave} onCancel={() => setEditingRow(null)} saving={savingManual} />
        )}
      </Modal>

      <Modal open={!!deletingRow} onClose={() => setDeletingRow(null)} title="Delete Position" size="sm">
        {deletingRow && (
          <ConfirmDeleteModal row={deletingRow} onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingRow(null)} deleting={deletingId === deletingRow.id} />
        )}
      </Modal>
    </AppShell>
  );
}
