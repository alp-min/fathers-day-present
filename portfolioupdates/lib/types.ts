// ─── Core Domain Types ────────────────────────────────────────────────────────

export type AssetClass = "stock" | "etf" | "fund" | "cash" | "bond" | "crypto" | "commodity";
export type Currency = "GBP" | "USD" | "EUR" | "AUD";
export type Exchange = "LSE" | "NYSE" | "NASDAQ" | "ASX" | "XETRA" | "OTHER";
export type Sector =
  | "Technology"
  | "Financials"
  | "Healthcare"
  | "Consumer Discretionary"
  | "Consumer Staples"
  | "Energy"
  | "Materials"
  | "Industrials"
  | "Utilities"
  | "Real Estate"
  | "Communication Services"
  | "Cash & Equivalents";

// Geography is open-ended to support any country/region name
export type Geography = string;

export interface Position {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  sector: Sector;
  geography: Geography;
  exchange: Exchange;
  currency: Currency;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  previousClose: number;
  marketValue: number;
  unrealisedPL: number;
  unrealisedPLPct: number;
  dayChange: number;
  dayChangePct: number;
  weight: number;
  direction?: "long" | "short";
  account?: string;
  dividendYield?: number;
  beta?: number;
  peRatio?: number;
  analystTarget?: number;
  logoUrl?: string;
  notes?: string;
  addedDate: string;
}

export interface Transaction {
  id: string;
  positionId: string;
  ticker: string;
  name: string;
  type: "buy" | "sell" | "dividend" | "corporate_action";
  quantity: number;
  price: number;
  total: number;
  currency: Currency;
  date: string;
  broker: string;
  notes?: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  currentPrice: number;
  dayChange: number;
  dayChangePct: number;
  targetPrice?: number;
  alertPrice?: number;
  notes?: string;
  addedDate: string;
  logoUrl?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  tags: string[];
  tickers?: string[];
  type: "trade" | "thesis" | "lesson" | "market" | "note";
  date: string;
  mood?: "bullish" | "bearish" | "neutral";
}

export interface MarketIndex {
  name: string;
  ticker: string;
  value: number;
  change: number;
  changePct: number;
  currency: Currency;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  tickers?: string[];
  sentiment?: "positive" | "negative" | "neutral";
  summary?: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  dailyPL: number;
  totalPL: number;
  totalPLPct: number;
  cash: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  benchmark?: number;
}

export interface AllocationSlice {
  name: string;
  value: number;
  color: string;
}

export interface InsightCard {
  id: string;
  type: "warning" | "info" | "success" | "opportunity";
  title: string;
  body: string;
  metric?: string;
  change?: string;
  ticker?: string;
  date: string;
}

// ─── Broker Adapter Interface ─────────────────────────────────────────────────

export interface BrokerConnection {
  id: string;
  name: string;
  type: "ig_index" | "manual" | "csv" | "interactive_brokers" | "hargreaves";
  isConnected: boolean;
  lastSync?: string;
  accountId?: string;
}

export interface BrokerAdapter {
  connect(credentials?: Record<string, string>): Promise<boolean>;
  getPositions(): Promise<Position[]>;
  getTransactions(from?: Date, to?: Date): Promise<Transaction[]>;
  getBalances(): Promise<{ currency: Currency; amount: number }[]>;
  disconnect(): Promise<void>;
}

// ─── Portfolio Summary ────────────────────────────────────────────────────────

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalUnrealisedPL: number;
  totalUnrealisedPLPct: number;
  dailyPL: number;
  dailyPLPct: number;
  cashBalance: number;
  cashPct: number;
  positions: Position[];
  currency: Currency;
  lastUpdated: string;
}

export interface TopMover {
  ticker: string;
  name: string;
  change: number;
  changePct: number;
  logoUrl?: string;
}
