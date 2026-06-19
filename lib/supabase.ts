import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type JournalEntryRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: "trade" | "thesis" | "lesson" | "market" | "note";
  mood: "bullish" | "bearish" | "neutral" | null;
  tags: string[];
  tickers: string[];
  created_at: string;
  updated_at: string;
};

export type WatchlistRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type WatchlistItemRow = {
  id: string;
  watchlist_id: string;
  symbol: string;
  name: string;
  notes: string | null;
  target_price: number | null;
  alert_price: number | null;
  added_at: string;
};

export type PositionRow = {
  id: string;
  user_id: string;
  ticker: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
