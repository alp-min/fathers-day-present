import { supabase, type WatchlistRow, type WatchlistItemRow } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";

export type WatchlistWithItems = WatchlistRow & { items: WatchlistItemRow[] };

export type CreateWatchlistItem = {
  symbol: string;
  name?: string;
  notes?: string;
  target_price?: number | null;
  alert_price?: number | null;
};

export const watchlistRepository = {
  async listAll(): Promise<WatchlistWithItems[]> {
    const userId = await getCurrentUserId();
    const { data: watchlists, error: wErr } = await supabase
      .from("watchlists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (wErr) throw new Error(wErr.message);
    if (!watchlists?.length) return [];

    const { data: items, error: iErr } = await supabase
      .from("watchlist_items")
      .select("*")
      .in("watchlist_id", watchlists.map((w) => w.id))
      .order("added_at", { ascending: true });

    if (iErr) throw new Error(iErr.message);

    return watchlists.map((wl) => ({
      ...wl,
      items: (items ?? []).filter((i) => i.watchlist_id === wl.id),
    }));
  },

  async createWatchlist(name: string): Promise<WatchlistWithItems> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("watchlists")
      .insert({ user_id: userId, name })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...data, items: [] };
  },

  async renameWatchlist(id: string, name: string): Promise<WatchlistRow> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("watchlists")
      .update({ name })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteWatchlist(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  },

  async addItem(watchlistId: string, item: CreateWatchlistItem): Promise<WatchlistItemRow> {
    const { data, error } = await supabase
      .from("watchlist_items")
      .insert({
        watchlist_id: watchlistId,
        symbol: item.symbol.toUpperCase().trim(),
        name: item.name ?? item.symbol.toUpperCase().trim(),
        notes: item.notes ?? null,
        target_price: item.target_price ?? null,
        alert_price: item.alert_price ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("id", itemId);

    if (error) throw new Error(error.message);
  },

  async updateItem(itemId: string, updates: Partial<CreateWatchlistItem>): Promise<WatchlistItemRow> {
    const { data, error } = await supabase
      .from("watchlist_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
};
