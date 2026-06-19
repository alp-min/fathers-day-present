"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, BookOpen, TrendingUp, TrendingDown, Minus,
  Tag, X, Pencil, Trash2, Loader2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { journalRepository, type CreateJournalEntry } from "@/lib/repositories";
import type { JournalEntryRow } from "@/lib/supabase";

const TYPE_ICONS = { trade: "📊", thesis: "🎯", lesson: "💡", market: "🌍", note: "📝" } as const;
const TYPE_LABELS = { trade: "Trade", thesis: "Thesis", lesson: "Lesson", market: "Market", note: "Note" } as const;
const MOOD_CONFIG = {
  bullish: { icon: TrendingUp, color: "text-gain", label: "Bullish" },
  bearish: { icon: TrendingDown, color: "text-loss", label: "Bearish" },
  neutral: { icon: Minus, color: "text-muted", label: "Neutral" },
} as const;

type EntryType = JournalEntryRow["type"];
type EntryMood = JournalEntryRow["mood"];

interface EntryFormProps {
  initial?: JournalEntryRow;
  onSave: (data: CreateJournalEntry) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function EntryForm({ initial, onSave, onCancel, saving }: EntryFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [type, setType] = useState<EntryType>(initial?.type ?? "note");
  const [mood, setMood] = useState<EntryMood>(initial?.mood ?? null);
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [tickersRaw, setTickersRaw] = useState((initial?.tickers ?? []).join(", "));

  function parseCsv(raw: string) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    await onSave({
      title: title.trim(),
      content: content.trim(),
      type,
      mood: mood ?? undefined,
      tags: parseCsv(tagsRaw),
      tickers: parseCsv(tickersRaw).map((t) => t.toUpperCase()),
    });
  }

  const inputClass = "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title..." required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as EntryType)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Mood</label>
          <select value={mood ?? ""} onChange={(e) => setMood((e.target.value as EntryMood) || null)} className={inputClass}>
            <option value="">— None —</option>
            <option value="bullish">🟢 Bullish</option>
            <option value="neutral">⚪ Neutral</option>
            <option value="bearish">🔴 Bearish</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Content *</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your thoughts..." required rows={8} className={`${inputClass} resize-none font-sans leading-relaxed`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Tickers (comma separated)</label>
          <input value={tickersRaw} onChange={(e) => setTickersRaw(e.target.value)} placeholder="AAPL, MSFT, NVDA" className={inputClass} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Tags (comma separated)</label>
          <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="AI, macro, conviction" className={inputClass} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>{initial ? "Save changes" : "Create entry"}</Button>
      </div>
    </form>
  );
}

interface EntryCardProps {
  entry: JournalEntryRow;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function EntryCard({ entry, onClick, onEdit, onDelete }: EntryCardProps) {
  const Mood = entry.mood ? MOOD_CONFIG[entry.mood] : null;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} onClick={onClick} className="bg-surface border border-border rounded-xl p-5 cursor-pointer hover:border-border-subtle hover:shadow-card-hover transition-all group">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-lg shrink-0">{TYPE_ICONS[entry.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-primary leading-snug line-clamp-2 flex-1">{entry.title}</h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={onEdit} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent-glow transition-colors"><Pencil className="w-3 h-3" /></button>
              <button onClick={onDelete} className="p-1.5 rounded-lg text-muted hover:text-loss hover:bg-loss-dim transition-colors"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-2xs text-muted">{formatDate(entry.created_at, "medium")}</p>
            {Mood && (<div className={`flex items-center gap-1 text-2xs font-medium ${Mood.color}`}><Mood.icon className="w-3 h-3" /><span>{Mood.label}</span></div>)}
          </div>
        </div>
      </div>
      <p className="text-xs text-secondary leading-relaxed line-clamp-3 mb-3">{entry.content}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="default">{TYPE_LABELS[entry.type]}</Badge>
        {entry.tickers?.map((t) => <Badge key={t} variant="info">{t}</Badge>)}
        {entry.tags?.slice(0, 3).map((tag) => (<div key={tag} className="flex items-center gap-1 text-2xs text-muted"><Tag className="w-2.5 h-2.5" />{tag}</div>))}
      </div>
    </motion.div>
  );
}

function EntryDetail({ entry, onClose, onEdit }: { entry: JournalEntryRow; onClose: () => void; onEdit: () => void; }) {
  const Mood = entry.mood ? MOOD_CONFIG[entry.mood] : null;
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} className="fixed inset-x-4 top-16 bottom-16 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-surface border border-border rounded-2xl z-50 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-border bg-surface/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-2"><span className="text-xl">{TYPE_ICONS[entry.type]}</span><Badge variant="default">{TYPE_LABELS[entry.type]}</Badge></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Pencil />} onClick={onEdit}>Edit</Button>
            <button onClick={onClose} className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-2 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-primary leading-snug mb-1">{entry.title}</h2>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted">{formatDate(entry.created_at, "long")}</p>
              {Mood && (<div className={`flex items-center gap-1 text-xs ${Mood.color}`}><Mood.icon className="w-3 h-3" />{Mood.label}</div>)}
            </div>
          </div>
          <div>{entry.content.split("\n\n").map((para, i) => (<p key={i} className="text-sm text-secondary leading-relaxed mb-3 last:mb-0">{para}</p>))}</div>
          {(entry.tickers?.length > 0 || entry.tags?.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
              {entry.tickers?.map((t) => <Badge key={t} variant="info">{t}</Badge>)}
              {entry.tags?.map((tag) => (<div key={tag} className="flex items-center gap-1 text-xs text-muted bg-surface-2 border border-border rounded-md px-2 py-0.5"><Tag className="w-2.5 h-2.5" />{tag}</div>))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

export default function JournalPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<JournalEntryRow | null>(null);
  const [viewing, setViewing] = useState<JournalEntryRow | null>(null);
  const [deleting, setDeleting] = useState<JournalEntryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await journalRepository.list();
      setEntries(data);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: CreateJournalEntry) {
    setSaving(true);
    try {
      const created = await journalRepository.create(data);
      setEntries((prev) => [created, ...prev]);
      setCreating(false);
      toast("Entry created", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(data: CreateJournalEntry) {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await journalRepository.update(editing.id, data);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditing(null);
      setViewing(updated);
      toast("Entry updated", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setConfirmingDelete(true);
    try {
      await journalRepository.delete(deleting.id);
      setEntries((prev) => prev.filter((e) => e.id !== deleting.id));
      setDeleting(null);
      setViewing(null);
      toast("Entry deleted", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setConfirmingDelete(false);
    }
  }

  const filtered = entries.filter((e) => typeFilter === "all" || e.type === typeFilter);
  const typeCounts = entries.reduce<Record<string, number>>((acc, e) => { acc[e.type] = (acc[e.type] ?? 0) + 1; return acc; }, {});

  return (
    <AppShell title="Journal" subtitle={`${entries.length} entries`} actions={<Button variant="primary" icon={<Plus />} size="sm" onClick={() => setCreating(true)}>New Entry</Button>}>
      <div className="p-5 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {["all", "thesis", "trade", "lesson", "market", "note"].map((f) => (
            <button key={f} onClick={() => setTypeFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === f ? "bg-accent text-white" : "bg-surface border border-border text-muted hover:text-primary"}`}>
              {f === "all" ? `All (${entries.length})` : `${TYPE_LABELS[f as EntryType]} (${typeCounts[f] ?? 0})`}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3"><Loader2 className="w-5 h-5 text-muted animate-spin" /><p className="text-sm text-muted">Loading journal...</p></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-sm text-muted mb-4">{typeFilter === "all" ? "No journal entries yet." : `No ${TYPE_LABELS[typeFilter as EntryType]} entries yet.`}</p>
            <Button variant="secondary" icon={<Plus />} onClick={() => setCreating(true)}>Write your first entry</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onClick={() => setViewing(entry)} onEdit={(e) => { e.stopPropagation(); setEditing(entry); }} onDelete={(e) => { e.stopPropagation(); setDeleting(entry); }} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="New Journal Entry" size="lg">
        <EntryForm onSave={handleCreate} onCancel={() => setCreating(false)} saving={saving} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Entry" size="lg">
        {editing && <EntryForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} saving={saving} />}
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Entry" size="sm">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">Are you sure you want to delete <span className="font-semibold text-primary">"{deleting.title}"</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={confirmingDelete} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
      <AnimatePresence>
        {viewing && !editing && <EntryDetail entry={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
      </AnimatePresence>
    </AppShell>
  );
}
