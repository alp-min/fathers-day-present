"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, Zap, BarChart2, TrendingUp, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { positionRepository } from "@/lib/repositories";
import type { PositionRow } from "@/lib/supabase";

function RiskMeter({ value, label }: { value: number; label: string }) {
  const pct = Math.min((value / 2) * 100, 100);
  const color = value < 0.8 ? "#10b981" : value < 1.2 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xs font-mono text-primary">{value.toFixed(2)}</p>
      </div>
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [rows, setRows] = useState<PositionRow[]>([]);

  useEffect(() => {
    positionRepository.list().then(setRows).catch(console.error);
  }, []);

  if (rows.length === 0) {
    return (
      <AppShell title="Insights" subtitle="Portfolio analytics">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 text-muted" />
          </div>
          <p className="text-sm font-semibold text-primary mb-1">No data to analyse</p>
          <p className="text-xs text-muted mb-4">Import your positions first to see portfolio insights.</p>
          <Link href="/import" className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-dim transition-colors">
            Import positions
          </Link>
        </div>
      </AppShell>
    );
  }

  // Derived metrics from real positions
  const totalValue = rows.reduce((s, r) => s + r.quantity * r.current_price, 0);
  const positions = rows.map((r) => ({
    ...r,
    marketValue: r.quantity * r.current_price,
    weight: totalValue > 0 ? (r.quantity * r.current_price / totalValue) * 100 : 0,
    unrealisedPL: r.direction === "short"
      ? r.quantity * r.avg_cost - r.quantity * r.current_price
      : r.quantity * r.current_price - r.quantity * r.avg_cost,
    unrealisedPLPct: r.avg_cost > 0
      ? ((r.current_price - r.avg_cost) / r.avg_cost) * 100 * (r.direction === "short" ? -1 : 1)
      : 0,
  }));

  const sorted = [...positions].sort((a, b) => b.unrealisedPLPct - a.unrealisedPLPct);
  const topPerformer = sorted[0];
  const worstPerformer = sorted[sorted.length - 1];
  const avgBeta = positions.reduce((acc, p) => acc + (p.beta ?? 1) * p.weight, 0) / 100;
  const byWeight = [...positions].sort((a, b) => b.weight - a.weight);

  // Simple derived insights from real data
  const insights = [
    topPerformer && {
      id: "top",
      type: "success" as const,
      title: `${topPerformer.ticker} is your best performer`,
      body: `Up ${topPerformer.unrealisedPLPct.toFixed(1)}% — ${formatCurrency(topPerformer.unrealisedPL, "GBP", true)} unrealised gain.`,
      metric: `+${topPerformer.unrealisedPLPct.toFixed(1)}%`,
    },
    worstPerformer && worstPerformer.unrealisedPLPct < 0 && {
      id: "worst",
      type: "warning" as const,
      title: `${worstPerformer.ticker} is dragging returns`,
      body: `Down ${Math.abs(worstPerformer.unrealisedPLPct).toFixed(1)}% — ${formatCurrency(worstPerformer.unrealisedPL, "GBP", true)} unrealised loss.`,
      metric: `${worstPerformer.unrealisedPLPct.toFixed(1)}%`,
    },
    byWeight[0] && byWeight[0].weight > 25 && {
      id: "concentration",
      type: "warning" as const,
      title: `${byWeight[0].ticker} is highly concentrated`,
      body: `${byWeight[0].weight.toFixed(1)}% of your portfolio is in a single position. Consider diversifying.`,
      metric: `${byWeight[0].weight.toFixed(1)}%`,
    },
    avgBeta > 1.3 && {
      id: "beta",
      type: "info" as const,
      title: "High market sensitivity",
      body: `Portfolio beta of ${avgBeta.toFixed(2)} means larger swings than the market in both directions.`,
      metric: avgBeta.toFixed(2),
    },
    positions.length >= 10 && {
      id: "diversified",
      type: "success" as const,
      title: "Well diversified",
      body: `${positions.length} positions across your portfolio provides meaningful diversification.`,
      metric: `${positions.length} positions`,
    },
  ].filter(Boolean);

  const INSIGHT_CONFIG = {
    warning: { icon: AlertTriangle, color: "text-warn", bg: "bg-warn-dim", border: "border-warn/20", label: "Warning" },
    info: { icon: Info, color: "text-accent", bg: "bg-accent-glow", border: "border-accent/20", label: "Info" },
    success: { icon: CheckCircle, color: "text-gain", bg: "bg-gain-dim", border: "border-gain/20", label: "Positive" },
    opportunity: { icon: Zap, color: "text-chart2", bg: "bg-surface-3", border: "border-chart2/20", label: "Opportunity" },
  } as const;

  return (
    <AppShell title="Insights" subtitle="Portfolio analytics">
      <div className="p-5 max-w-[1600px] mx-auto space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card delay={0}>
            <CardHeader><CardTitle>Risk Profile</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <RiskMeter value={avgBeta} label="Portfolio Beta" />
            </CardContent>
          </Card>

          <Card delay={0.05}>
            <CardHeader><CardTitle>Performance Leaders</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-3">
              {topPerformer && (
                <div>
                  <p className="text-2xs text-muted uppercase tracking-wider mb-2">Best performer</p>
                  <div className="bg-gain-dim border border-gain/20 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono font-semibold text-primary">{topPerformer.ticker}</p>
                      <Badge variant="gain">+{topPerformer.unrealisedPLPct.toFixed(1)}%</Badge>
                    </div>
                    <p className="text-xs text-muted mt-1">{topPerformer.name}</p>
                    <p className="text-xs font-mono text-gain mt-1">
                      +{formatCurrency(topPerformer.unrealisedPL, "GBP", true)} unrealised
                    </p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-2xs text-muted uppercase tracking-wider mb-2">Most exposure</p>
                <div className="bg-accent-glow border border-accent/20 rounded-xl p-3">
                  {byWeight.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      <p className="text-xs font-mono text-primary">{p.ticker}</p>
                      <p className="text-xs font-mono text-accent">{p.weight.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card delay={0.1}>
            <CardHeader><CardTitle>Portfolio Health</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { label: "Diversification", score: Math.min(positions.length * 7, 100), icon: BarChart2 },
                { label: "Risk-adjusted return", score: avgBeta < 1 ? 80 : avgBeta < 1.5 ? 65 : 40, icon: TrendingUp },
                { label: "Positions with gains", score: Math.round((positions.filter(p => p.unrealisedPL > 0).length / positions.length) * 100), icon: ShieldCheck },
              ].map(({ label, score, icon: Icon }) => {
                const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="w-3.5 h-3.5 text-muted shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-2xs text-muted">{label}</span>
                        <span className="text-2xs font-mono" style={{ color }}>{score}/100</span>
                      </div>
                      <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                          initial={{ width: 0 }} animate={{ width: `${score}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {insights.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((ins, i) => {
                if (!ins) return null;
                const cfg = INSIGHT_CONFIG[ins.type];
                const Icon = cfg.icon;
                return (
                  <motion.div key={ins.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    className={`rounded-xl border p-5 ${cfg.bg} ${cfg.border}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg bg-canvas/30 ${cfg.color} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-primary">{ins.title}</p>
                          <Badge variant={ins.type === "success" ? "gain" : ins.type === "warning" ? "warn" : "info"} size="sm">
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">{ins.body}</p>
                        {ins.metric && (
                          <span className={`mt-3 inline-block text-xl font-mono font-semibold ${cfg.color}`}>{ins.metric}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
