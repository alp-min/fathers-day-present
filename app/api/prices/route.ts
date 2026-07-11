import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export type PriceQuote = {
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  currency: string;
  shortName: string;
};

const BASE = "https://api.finage.co.uk";

type Market = "us" | "uk" | "hk" | "eu";

function classifySymbol(sym: string): { clean: string; market: Market; currency: string } {
  const upper = sym.toUpperCase();
  if (upper.endsWith(".L")) return { clean: upper.replace(/\.L$/, ""), market: "uk", currency: "GBp" };
  if (upper.endsWith(".HK")) return { clean: upper.replace(/\.HK$/, ""), market: "hk", currency: "HKD" };
  if (/\.(PA|DE|AMS|AS|MI|MC|BR|VX|ST|CO|OL|HE)$/i.test(upper)) {
    return { clean: upper, market: "eu", currency: "EUR" };
  }
  return { clean: upper, market: "us", currency: "USD" };
}

function marketPath(market: Market) {
  switch (market) {
    case "uk": return "uk-stock";
    case "hk": return "hk-stock";
    default:   return "stock";
  }
}

function prevClosePath(market: Market) {
  switch (market) {
    case "uk": return "agg/uk-stock/prev-close";
    case "hk": return "agg/hk-stock/prev-close";
    default:   return "agg/stock/prev-close";
  }
}

interface FinageLastResponse {
  symbol?: string;
  ask?: number;
  bid?: number;
  price?: number;
  timestamp?: number;
}

interface FinagePrevCloseResponse {
  symbol?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp?: number;
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols");
  if (!symbols?.trim()) {
    return NextResponse.json({ error: "symbols param required" }, { status: 400 });
  }

  const apiKey = process.env.FINAGE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FINAGE_API_KEY not configured" }, { status: 500 });
  }

  const symbolList = symbols.split(",").map((s) => s.trim()).filter(Boolean);
  const classified = symbolList.map((s) => ({ raw: s.toUpperCase(), ...classifySymbol(s) }));

  const fetchPair = async (entry: ReturnType<typeof classifySymbol> & { raw: string }) => {
    const path = marketPath(entry.market);
    const pcPath = prevClosePath(entry.market);
    const sym = encodeURIComponent(entry.clean);
    const key = `apikey=${apiKey}`;

    const [lastRes, prevRes] = await Promise.allSettled([
      fetch(`${BASE}/last/${path}/${sym}?${key}`).then((r) => r.json() as Promise<FinageLastResponse>),
      fetch(`${BASE}/${pcPath}/${sym}?${key}`).then((r) => r.json() as Promise<FinagePrevCloseResponse>),
    ]);

    return { entry, lastRes, prevRes };
  };

  const results = await Promise.allSettled(classified.map(fetchPair));

  const prices: Record<string, PriceQuote> = {};

  for (const result of results) {
    if (result.status === "rejected") continue;
    const { entry, lastRes, prevRes } = result.value;

    const last = lastRes.status === "fulfilled" ? lastRes.value : null;
    const prev = prevRes.status === "fulfilled" ? prevRes.value : null;

    if (!last) {
      console.warn("[prices] no last data for", entry.raw);
      continue;
    }

    const price = last.price ?? (last.ask != null && last.bid != null ? (last.ask + last.bid) / 2 : last.ask ?? null);
    if (price == null || isNaN(price) || price <= 0) {
      console.warn("[prices] invalid price for", entry.raw, last);
      continue;
    }

    const prevClose = prev?.close ?? 0;
    const change = prevClose > 0 ? price - prevClose : 0;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    prices[entry.raw] = {
      price,
      change,
      changePct,
      prevClose,
      currency: entry.currency,
      shortName: entry.raw,
    };
  }

  console.log("[prices] resolved:", Object.keys(prices));

  return NextResponse.json({ prices, ts: Date.now() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
