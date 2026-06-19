"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, Plus, Bell, Target, StickyNote,
  Pencil, Trash2, Loader2, MoreHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { watchlistRepository, type WatchlistWithItems, type CreateWatchlistItem } from "@/lib/repositories";
import type { WatchlistItemRow } from "@/lib/supabase";

interface AddTickerFormProps {
  onSave: (data: CreateWatchlistItem) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function AddTickerForm({ onSave, onCancel, saving }: AddTickerFormProps) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [alertPrice, setAlertPrice] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) return;
    await onSave({
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || symbol.trim().toUpperCase(),
      notes: notes.trim() || undefined,
      target_price: targetPrice ? parseFloat(targetPrice) : null,
      alert_price: alertPrice ? parseFloat(alertPrice) : null,
    });
  }

  const inputClass = "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Ticker *</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL" required className={`${inputClass} font-mono uppercase`} autoFocus />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Company Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc." className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Target Price</label>
          <input type="number" step="0.01" min="0" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="205.00" className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Alert Price</label>
          <input type="number" step="0.01" min="0" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder="165.00" className={`${inputClass} font-mono`} />
        </div>
      </div>
      <div>
        <label className="text-2xs text-muted uppercase tracking-wider block mb-1.5">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Investment thesis, why you're watching this..." rows={3} className={`${inputClass} resize-none`} />
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>Add to watchlist</Button>
      </div>
    </form>
  );
}

function WatchlistItemCard({ item, onRemove }: { item: WatchlistItemRow; onRemove: () => void; }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="bg-surface border border-border rounded-xl p-4 hover:border-border-subtle hover:shadow-card-hover transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
            <span className="text-xs font-mono text-muted font-semibold">{item.symbol.slice(0, 2)}</span>
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-primary">{item.symbol}</p>
            <p className="text-2xs text-muted">{item.name || item.symbol}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onRemove} className="p-1.5 rounded-lg text-muted hover:text-loss hover:bg-loss-dim transition-colors" title="Remove from watchlist"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {(item.target_price || item.alert_price) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {item.target_price && (<div className="flex items-center gap-1 text-2xs text-accent bg-accent-glow border border-accent/20 rounded-md px-2 py-0.5"><Target className="w-2.5 h-2.5" />Target @ {Number(item.target_price).toFixed(2)}</div>)}
          {item.alert_price && (<div className="flex items-center gap-1 text-2xs text-warn bg-warn-dim border border-warn/20 rounded-md px-2 py-0.5"><Bell className="w-2.5 h-2.5" />Alert @ {Number(item.alert_price).toFixed(2)}</div>)}
        </div>
      )}
      {item.notes && (<div className="flex items-start gap-1.5"><StickyNote className="w-3 h-3 text-muted shrink-0 mt-0.5" /><p className="text-2xs text-muted leading-relaxed line-clamp-2">{item.notes}</p></div>)}
      {!item.target_price && !item.alert_price && !item.notes && (<p className="text-2xs text-muted italic">No target or notes set</p>)}
    </motion.div>
  );
}

function ListButton({ watchlist, active, onClick, onRename, onDelete }: { watchlist: WatchlistWithItems; active: boolean; onClick: () => void; onRename: () => void; onDelete: () => void; }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative">
      <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${active ? "bg-accent-glow border-accent/30 text-primary" : "bg-surface border-border text-muted hover:text-primary hover:bg-surface-2"}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{watchlist.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={active ? "info" : "default"}>{watchlist.items.length}</Badge>
            <button onClick={(e) => { e.stopPropagation(); setShowMenu((s) => !s); }} className="p-0.5 rounded text-muted hover:text-primary transition-colors"><MoreHorizontal className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </button>
      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 z-20 bg-surface-2 border border-border rounded-xl shadow-card-hover py-1 min-w-[140px]">
              <button onClick={() => { setShowMenu(false); onRename(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-secondary hover:text-primary hover:bg-surface-3 transition-colors"><Pencil className="w-3.5 h-3.5" />Rename</button>
              <button onClick={() => { setShowMenu(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-loss hover:bg-loss-dim transition-colors"><Trash2 className="w-3.5 h-3.5" />Delete list</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WatchlistPage() {
  const { toast } = useToast();
  const [watchlists, setWatchlists] = useState<WatchlistWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [showRename, setShowRename] = useState<WatchlistWithItems | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renamingSaving, setRenamingSaving] = useState(false);
  const [deleteList, setDeleteList] = useState<WatchlistWithItems | null>(null);
  const [deletingList, setDeletingList] = useState(false);
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [addingTicker, setAddingTicker] = useState(false);
  const [removeItem, setRemoveItem] = useState<WatchlistItemRow | null>(null);
  const [removingItem, setRemovingItem] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await watchlistRepository.listAll();
      setWatchlists(data);
      if (!activeId && data.length > 0) setActiveId(data[0].id);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, activeId]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = watchlists.find((w) => w.id === activeId) ?? null;

  async function handleCreateList() {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const created = await watchlistRepository.createWatchlist(newListName.trim());
      setWatchlists((prev) => [...prev, { ...created, items: [] }]);
      setActiveId(created.id);
      setShowNewList(false);
      setNewListName("");
      toast(`"${created.name}" created`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setCreatingList(false);
    }
  }

  async function handleRenameList() {
    if (!showRename || !renameName.trim()) return;
    setRenamingSaving(true);
    try {
      const updated = await watchlistRepository.renameWatchlist(showRename.id, renameName.trim());
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? { ...w, name: updated.name } : w)));
      setShowRename(null);
      toast("List renamed", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setRenamingSaving(false);
    }
  }

  async function handleDeleteList() {
    if (!deleteList) return;
    setDeletingList(true);
    try {
      await watchlistRepository.deleteWatchlist(deleteList.id);
      const remaining = watchlists.filter((w) => w.id !== deleteList.id);
      setWatchlists(remaining);
      if (activeId === deleteList.id) setActiveId(remaining[0]?.id ?? null);
      setDeleteList(null);
      toast("List deleted", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setDeletingList(false);
    }
  }

  async function handleAddTicker(data: CreateWatchlistItem) {
    if (!activeId) return;
    setAddingTicker(true);
    try {
      const item = await watchlistRepository.addItem(activeId, data);
      setWatchlists((prev) => prev.map((w) => (w.id === activeId ? { ...w, items: [...w.items, item] } : w)));
      setShowAddTicker(false);
      toast(`${item.symbol} added`, "success");
    } catch (err) {
      const msg = (err as Error).message;
      toast(msg.includes("unique") ? "Ticker already in this list" : msg, "error");
    } finally {
      setAddingTicker(false);
    }
  }

  async function handleRemoveItem() {
    if (!removeItem) return;
    setRemovingItem(true);
    try {
      await watchlistRepository.removeItem(removeItem.id);
      setWatchlists((prev) => prev.map((w) => ({ ...w, items: w.items.filter((i) => i.id !== removeItem.id) })));
      setRemoveItem(null);
      toast(`${removeItem.symbol} removed`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setRemovingItem(false);
    }
  }

  const totalItems = watchlists.reduce((a, w) => a + w.items.length, 0);

  return (
    <AppShell title="Watchlist" subtitle={`${totalItems} items across ${watchlists.length} lists`}>
      <div className="p-5 max-w-[1600px] mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3"><Loader2 className="w-5 h-5 text-muted animate-spin" /><p className="text-sm text-muted">Loading watchlists...</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div className="space-y-2">
              <p className="text-2xs text-muted uppercase tracking-wider px-1 mb-3">My Lists</p>
              <AnimatePresence mode="popLayout">
                {watchlists.map((wl) => (
                  <motion.div key={wl.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                    <ListButton watchlist={wl} active={wl.id === activeId} onClick={() => setActiveId(wl.id)} onRename={() => { setShowRename(wl); setRenameName(wl.name); }} onDelete={() => setDeleteList(wl)} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button variant="ghost" icon={<Plus />} className="w-full justify-start mt-2" size="sm" onClick={() => setShowNewList(true)}>New list</Button>
            </div>
            <div className="lg:col-span-3 space-y-4">
              {current ? (
                <>
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-base font-semibold text-primary">{current.name}</h2><p className="text-xs text-muted">{current.items.length} tickers</p></div>
                    <Button variant="secondary" icon={<Plus />} size="sm" onClick={() => setShowAddTicker(true)}>Add ticker</Button>
                  </div>
                  {current.items.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-border rounded-2xl">
                      <Star className="w-10 h-10 text-muted mx-auto mb-3" />
                      <p className="text-sm text-muted mb-4">No tickers in this list yet.</p>
                      <Button variant="secondary" icon={<Plus />} onClick={() => setShowAddTicker(true)}>Add your first ticker</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <AnimatePresence mode="popLayout">
                        {current.items.map((item) => (<WatchlistItemCard key={item.id} item={item} onRemove={() => setRemoveItem(item)} />))}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-24">
                  <Star className="w-10 h-10 text-muted mx-auto mb-3" />
                  <p className="text-sm text-muted mb-4">Create a watchlist to get started.</p>
                  <Button variant="secondary" icon={<Plus />} onClick={() => setShowNewList(true)}>Create first list</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Modal open={showNewList} onClose={() => setShowNewList(false)} title="New Watchlist" size="sm">
        <div className="space-y-4">
          <input value={newListName} onChange={(e) => setNewListName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateList()} placeholder="e.g. High Conviction, UK Opportunities..." autoFocus className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowNewList(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={creatingList} onClick={handleCreateList}>Create list</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!showRename} onClose={() => setShowRename(null)} title="Rename List" size="sm">
        <div className="space-y-4">
          <input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRenameList()} autoFocus className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40" />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowRename(null)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={renamingSaving} onClick={handleRenameList}>Save</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!deleteList} onClose={() => setDeleteList(null)} title="Delete Watchlist" size="sm">
        {deleteList && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">Delete <span className="font-semibold text-primary">"{deleteList.name}"</span> and all {deleteList.items.length} tickers in it? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDeleteList(null)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={deletingList} onClick={handleDeleteList}>Delete list</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={showAddTicker} onClose={() => setShowAddTicker(false)} title={`Add ticker to "${current?.name}"`} size="md">
        <AddTickerForm onSave={handleAddTicker} onCancel={() => setShowAddTicker(false)} saving={addingTicker} />
      </Modal>
      <Modal open={!!removeItem} onClose={() => setRemoveItem(null)} title="Remove Ticker" size="sm">
        {removeItem && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">Remove <span className="font-mono font-semibold text-primary">{removeItem.symbol}</span> from this watchlist?</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setRemoveItem(null)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={removingItem} onClick={handleRemoveItem}>Remove</Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
