import { supabase, type JournalEntryRow } from "@/lib/supabase";

const DEFAULT_USER = "default";

export type CreateJournalEntry = {
  title: string;
  content: string;
  type: JournalEntryRow["type"];
  mood?: JournalEntryRow["mood"];
  tags?: string[];
  tickers?: string[];
};

export type UpdateJournalEntry = Partial<CreateJournalEntry>;

export const journalRepository = {
  async list(): Promise<JournalEntryRow[]> {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", DEFAULT_USER)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(entry: CreateJournalEntry): Promise<JournalEntryRow> {
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ ...entry, user_id: DEFAULT_USER })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, entry: UpdateJournalEntry): Promise<JournalEntryRow> {
    const { data, error } = await supabase
      .from("journal_entries")
      .update({ ...entry, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", DEFAULT_USER)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", DEFAULT_USER);
    if (error) throw error;
  },
};
