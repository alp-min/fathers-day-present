"use client";

import { useState } from "react";
import { TrendingUp, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Check your email to confirm your account, then sign in.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all";

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-glow mb-4">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-primary">Portfolio OS</h1>
          <p className="text-sm text-muted mt-1">Your personal investment command centre</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
          {/* Mode tabs */}
          <div className="flex bg-surface-2 rounded-lg p-1 gap-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-primary"
                }`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-gain bg-gain/10 border border-gain/20 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-dim text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-2xs text-muted mt-6">
          Portfolio OS · Personal use only
        </p>
      </div>
    </div>
  );
}
