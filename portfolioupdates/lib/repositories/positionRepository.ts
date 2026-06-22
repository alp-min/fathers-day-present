import { supabase, type PositionRow } from "@/lib/supabase";

const DEFAULT_USER = "default";

export type UpsertPosition = {
  ticker: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  currency: string;
  direction?: string;
  account?: string;
  country?: string;
  asset_class?: string;
  beta?: number | null;
  notes?: string | null;
};

export const positionRepository = {
  async list(): Promise<PositionRow[]> {
    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", DEFAULT_USER)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async upsert(position: UpsertPosition): Promise<PositionRow> {
    const { data, error } = await supabase
      .from("positions")
      .upsert(
        {
          direction: "long",
          account: "General",
          country: "United States",
          asset_class: "stock",
          beta: null,
          ...position,
          user_id: DEFAULT_USER,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,ticker" }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async upsertMany(positions: UpsertPosition[]): Promise<PositionRow[]> {
    const rows = positions.map((p) => ({
      direction: "long",
      account: "General",
      country: "United States",
      asset_class: "stock",
      beta: null,
      ...p,
      user_id: DEFAULT_USER,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from("positions")
      .upsert(rows, { onConflict: "user_id,ticker" })
      .select();
    if (error) throw error;
    return data ?? [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("positions")
      .delete()
      .eq("id", id)
      .eq("user_id", DEFAULT_USER);
    if (error) throw error;
  },
};
