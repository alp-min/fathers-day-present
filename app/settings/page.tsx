"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Bell, Shield, Database, Palette, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : ""}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("profile");
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

  function toggle(k: keyof typeof prefs) {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
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
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center text-xl">
                      👨‍💼
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Dad</p>
                      <p className="text-xs text-muted">Former Head of Equities · Macquarie</p>
                      <p className="text-2xs text-muted mt-0.5 font-mono">personal@portfolio.os</p>
                    </div>
                  </div>
                  {[
                    { label: "Display Name", value: "Dad", type: "text" },
                    { label: "Base Currency", value: "GBP", type: "select" },
                    { label: "Home Exchange", value: "LSE", type: "select" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between py-1">
                      <label className="text-sm text-secondary">{f.label}</label>
                      <input
                        defaultValue={f.value}
                        className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-primary font-mono focus:outline-none focus:ring-1 focus:ring-accent/40 w-40"
                      />
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button variant="primary" size="sm">Save changes</Button>
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
                  {[
                    { key: "biometric" as const, label: "Biometric unlock", desc: "Use Face ID / fingerprint on supported devices" },
                    { key: "twoFactor" as const, label: "Two-factor authentication", desc: "Add an extra layer of security to your account" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-primary">{label}</p>
                        <p className="text-xs text-muted">{desc}</p>
                      </div>
                      <Toggle value={prefs[key]} onChange={() => toggle(key)} />
                    </div>
                  ))}

                  {/* Hidden easter egg */}
                  <div className="mt-6 p-4 bg-surface-2 rounded-xl border border-border">
                    <p className="text-2xs text-muted font-mono">
                      // Portfolio OS v0.1.0 · Built with ♥
                    </p>
                    <p className="text-2xs text-muted font-mono mt-1">
                      // Former Head of Equities. Still beating the market.
                    </p>
                    <p className="text-2xs text-muted/40 font-mono mt-1">
                      // Macquarie years → Today
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
                    All data is stored locally and in your private Supabase instance. No data is shared with third parties.
                    Market data is fetched from public APIs with a 15-minute delay.
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
