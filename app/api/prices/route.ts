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

const COMMODITY_SYMBOLS = new Set([
  "XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD",
  "USOIL", "UKOIL", "BRENT", "WTI", "NGAS",
  "COFFEE", "SUGAR", "COCOA", "COTTON",
  "CORN", "WHEAT", "SOYBEAN", "RICE",
  "COPPER", "ALUMINIUM", "ZINC", "NICKEL", "LEAD",
]);

const FIAT_CURRENCIES = new Set([
  "USD","EUR","GBP","JPY","CHF","AUD","CAD","NZD",
  "SEK","NOK","DKK","SGD","HKD","CNY","CNH","MXN",
  "ZAR","TRY","BRL","INR","KRW","THB","PLN","CZK","HUF",
]);

type AssetClass = "forex" | "commodity" | "crypto" | "us" | "uk" | "hk" | "eu";

interface Classified {
  raw: string;
  clean: string;
  assetClass: AssetClass;
  currency: string;
}

function classifySymbol(sym: string): Classified {
  const upper = sym.toUpperCase();

  if (COMMODITY_SYMBOLS.has(upper)) {
    return { raw: upper, clean: upper, assetClass: "commodity", currency: "USD" };
  }

  if (
    (upper.endsWith("USDT") || upper.endsWith("USDC")) ||
    (upper.endsWith("USD") && upper.length > 6) ||
    /^(BTC|ETH|BNB|SOL|XRP|ADA|DOGE|DOT|MATIC|AVAX|LINK|LTC|BCH|UNI|ATOM)/.test(upper)
  ) {
    return { raw: upper, clean: upper, assetClass: "crypto", currency: "USD" };
  }

  if (upper.length === 6) {
    const base = upper.slice(0, 3);
    const quote = upper.slice(3, 6);
    if (FIAT_CURRENCIES.has(base) && FIAT_CURRENCIES.has(quote)) {
      return { raw: upper, clean: upper, assetClass: "forex", currency: quote };
    }
  }

  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(upper)) {
    const [base, quote] = upper.split("/");
    if (FIAT_CURRENCIES.has(base) && FIAT_CURRENCIES.has(quote)) {
      return { raw: upper, clean: base + quote, assetClass: "forex", currency: quote };
    }
  }

  if (upper.endsWith(".L")) return { raw: upper, clean: upper.replace(/\.L$/, ""), assetClass: "uk", currency: "GBp" };
  if (upper.endsWith(".HK")) return { raw: upper, clean: upper.replace(/\.HK$/, ""), assetClass: "hk", currency: "HKD" };
  if (/\.(PA|DE|AMS|AS|MI|MC|BR|VX|ST|CO|OL|HE)$/i.test(upper)) {
    return { raw: upper, clean: upper, assetClass: "eu", currency: "EUR" };
  }

  return { raw: upper, clean: upper, assetClass: "us", currency: "USD" };
}

function lastPath(ac: AssetClass): string {
  switch (ac) {
    case "forex":     return "last/forex";
    case "commodity": return "last/commodity";
    case "crypto":    return "last/crypto";
    case "uk":        return "last/uk-stock";
    case "hk":        return "last/hk-stock";
    default:          return "last/stock";
  }
}

function prevClosePath(ac: AssetClass): string {
  switch (ac) {
    case "forex":     return "agg/forex/prev-close";
    case "commodity": return "agg/commodity/prev-close";
    case "crypto":    return "agg/crypto/prev-close";
    case "uk":        return "agg/uk-stock/prev-close";
    case "hk":        return "agg/hk-stock/prev-close";
    default:          return "agg/stock/prev-close";
  }
}

interface FinageLastResponse {
  symbol?: string;
  ask?: number;
  bid?: number;
  price?: number;
  rate?: number;
  timestamp?: number;
  [k: string]: unknown;
}

interface FinagePrevCloseResponse {
  symbol?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp?: number;
  [k: string]: unknown;
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
  const classified = symbolList.map(classifySymbol);

  const fetchPair = async (entry: Classified) => {
    const sym = encodeURIComponent(entry.clean);
    const key = `apikey=${apiKey}`;

    const [lastRes, prevRes] = await Promise.allSettled([
      fetch(`${BASE}/${lastPath(entry.assetClass)}/${sym}?${key}`)
        .then((r) => r.json() as Promise<FinageLastResponse>),
      fetch(`${BASE}/${prevClosePath(entry.assetClass)}/${sym}?${key}`)
        .then((r) => r.json() as Promise<FinagePrevCloseResponse>),
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

    const price =
      last.price ??
      last.rate ??
      (last.ask != null && last.bid != null ? (last.ask + last.bid) / 2 : null) ??
      last.ask ??
      null;

    if (price == null || isNaN(Number(price)) || Number(price) <= 0) {
      console.warn("[prices] invalid price for", entry.raw, last);
      continue;
    }

    const numPrice = Number(price);
    const prevClose = prev?.close != null ? Number(prev.close) : 0;
    const change = prevClose > 0 ? numPrice - prevClose : 0;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    prices[entry.raw] = {
      price: numPrice,
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
