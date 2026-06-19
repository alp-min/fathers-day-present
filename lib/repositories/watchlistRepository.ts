import { supabase, type WatchlistRow, type WatchlistItemRow } from "@/lib/supabase";

const DEFAULT_USER = "default";

export type WatchlistWithItems = WatchlistRow & { items: WatchlistItemRow[] };

export type CreateWatchlistItem = {
  symbol: string;
  name: string;
  notes?: string;
  target_price?: number;
  alert_price?: number;
};

export const watchlistRepository = {
  async listAll(): Promise<WatchlistWithItems[]> {
    const { data: lists, error: listErr } = await supabase
      .from("watchlists")
      .select("*")
      .eq("user_id", DEFAULT_USER)
      .order("created_at", { ascending: true });
    if (listErr) throw listErr;
    if (!lists || lists.length === 0) return [];

    const ids = lists.map((l) => l.id);
    const { data: items, error: itemErr } = await supabase
      .from("watchlist_items")
      .select("*")
      .in("watchlist_id", ids)
      .order("added_at", { ascending: true });
    if (itemErr) throw itemErr;

    return lists.map((list) => ({
      ...list,
      items: (items ?? []).filter((item) => item.watchlist_id === list.id),
    }));
  },

  async createWatchlist(name: string): Promise<WatchlistRow> {
    const { data, error } = await supabase
      .from("watchlists")
      .insert({ name, user_id: DEFAULT_USER })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async renameWatchlist(id: string, name: string): Promise<WatchlistRow> {
    const { data, error } = await supabase
      .from("watchlists")
      .update({ name })
      .eq("id", id)
      .eq("user_id", DEFAULT_USER)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteWatchlist(id: string): Promise<void> {
    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("id", id)
      .eq("user_id", DEFAULT_USER);
    if (error) throw error;
  },

  async addItem(watchlistId: string, item: CreateWatchlistItem): Promise<WatchlistItemRow> {
    const { data, error } = await supabase
      .from("watchlist_items")
      .insert({ ...item, watchlist_id: watchlistId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("id", itemId);
    if (error) throw error;
  },

  async updateItem(
    itemId: string,
    updates: Partial<CreateWatchlistItem>
  ): Promise<WatchlistItemRow> {
    const { data, error } = await supabase
      .from("watchlist_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
