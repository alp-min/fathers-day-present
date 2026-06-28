"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Bell, Shield, Database, Palette, ChevronRight, Loader2, CheckCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

const SECTIONS = [
  { id: "profile", icon: User, label: "Profile" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "appearance", icon: Palette, label: "Appearance" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "data", icon: Database, label: "Data & Privacy" },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${value ? "bg-accent" : "bg-surface-3"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : ""}`} />
    </button>
  );
}

const inputClass = "bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-primary font-mono focus:outline-none focus:ring-1 focus:ring-accent/40 w-52";

export default function SettingsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<Section>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile fields — initialised from Supabase user metadata
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("GBP");

  const [prefs, setPrefs] = useState({
    darkMode: true,
    compactMode: false,
    animations: true,
    emailDigest: true,
    priceAlerts: true,
    weeklyReport: false,
    biometric: false,
    twoFactor: false,
  });

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : document.documentElement.classList.contains("dark");
    setPrefs((p) => ({ ...p, darkMode: isDark }));
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Load saved metadata on mount
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    setDisplayName(meta.display_name ?? "");
    setJobTitle(meta.job_title ?? "");
    setBaseCurrency(meta.base_currency ?? "GBP");
  }, [user]);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName, job_title: jobTitle, base_currency: baseCurrency },
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  function toggle(k: keyof typeof prefs) {
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      if (k === "darkMode") {
        if (next.darkMode) {
          document.documentElement.classList.add("dark");
          localStorage.setItem("theme", "dark");
        } else {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("theme", "light");
        }
      }
      return next;
    });
  }

  return (
    <AppShell title="Settings">
      <div className="p-5 max-w-[900px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Nav */}
          <nav className="space-y-1">
            {SECTIONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active === id
                    ? "bg-accent-glow text-accent border border-accent/20"
                    : "text-muted hover:text-primary hover:bg-surface-2"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active === id && <ChevronRight className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="md:col-span-3 space-y-4">
            {active === "profile" && (
              <Card delay={0}>
                <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* Avatar + email */}
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center text-lg">
                      {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">{displayName || "—"}</p>
                      <p className="text-xs text-muted font-mono">{user?.email}</p>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-1">
                      <label className="text-sm text-secondary">Display Name</label>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <label className="text-sm text-secondary">Job Title</label>
                      <input
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Head of Equities"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <label className="text-sm text-secondary">Base Currency</label>
                      <select
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value)}
                        className={inputClass}
                      >
                        {["GBP", "USD", "EUR", "AUD"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <Button variant="primary" size="sm" onClick={saveProfile} disabled={saving}>
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                      Save changes
                    </Button>
                    {saved && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-xs text-gain"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Saved
                      </motion.span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "appearance" && (
              <Card delay={0}>
                <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {[
                    { key: "darkMode" as const, label: "Dark mode", desc: "Premium dark theme (recommended)" },
                    { key: "compactMode" as const, label: "Compact layout", desc: "Reduce spacing for more data density" },
                    { key: "animations" as const, label: "Animations", desc: "Smooth motion effects throughout the app" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-primary">{label}</p>
                        <p className="text-xs text-muted">{desc}</p>
                      </div>
                      <Toggle value={prefs[key]} onChange={() => toggle(key)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {active === "notifications" && (
              <Card delay={0}>
                <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {[
                    { key: "emailDigest" as const, label: "Daily digest", desc: "Morning summary of portfolio performance" },
                    { key: "priceAlerts" as const, label: "Price alerts", desc: "Notify when watchlist targets are hit" },
                    { key: "weeklyReport" as const, label: "Weekly report", desc: "Performance summary every Sunday" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-primary">{label}</p>
                        <p className="text-xs text-muted">{desc}</p>
                      </div>
                      <Toggle value={prefs[key]} onChange={() => toggle(key)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {active === "security" && (
              <Card delay={0}>
                <CardHeader><CardTitle>Security</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium text-primary">Email</p>
                      <p className="text-xs text-muted font-mono">{user?.email}</p>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted leading-relaxed">
                      To change your password, sign out and use the "Forgot password" link on the login page.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "data" && (
              <Card delay={0}>
                <CardHeader><CardTitle>Data & Privacy</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <p className="text-xs text-muted leading-relaxed">
                    All data is stored in your private Supabase instance. No data is shared with third parties.
                    Market data is fetched from Twelve Data API.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="secondary" size="sm">Export all data</Button>
                    <Button variant="danger" size="sm">Delete account</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
