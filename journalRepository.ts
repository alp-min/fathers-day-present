import { supabase, type JournalEntryRow } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth";

const TABLE = "journal_entries";

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
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async create(entry: CreateJournalEntry): Promise<JournalEntryRow> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        title: entry.title,
        content: entry.content,
        type: entry.type,
        mood: entry.mood ?? null,
        tags: entry.tags ?? [],
        tickers: entry.tickers ?? [],
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id: string, entry: UpdateJournalEntry): Promise<JournalEntryRow> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...(entry.title !== undefined && { title: entry.title }),
        ...(entry.content !== undefined && { content: entry.content }),
        ...(entry.type !== undefined && { type: entry.type }),
        ...(entry.mood !== undefined && { mood: entry.mood }),
        ...(entry.tags !== undefined && { tags: entry.tags }),
        ...(entry.tickers !== undefined && { tickers: entry.tickers }),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  },
};
