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

const FINAGE_BASE = "https://api.finage.co.uk";
const NINJA_BASE  = "https://api.api-ninjas.com/v1/commodityprice";

// API Ninjas commodity name mapping
// Key = our symbol, value = API Ninjas ?name= value
const NINJA_MAP: Record<string, string> = {
  USOIL:     "crude_oil",
  WTI:       "crude_oil",
  UKOIL:     "crude_oil",   // Ninjas only has crude_oil (WTI), no separate Brent
  BRENT:     "crude_oil",
  NGAS:      "natural_gas",
  COFFEE:    "coffee",
  SUGAR:     "sugar",
  COCOA:     "cocoa",
  COTTON:    "cotton",
  CORN:      "corn",
  WHEAT:     "wheat",
  SOYBEAN:   "wheat",       // no soybean — wheat is closest grain
  COPPER:    "copper",
  ALUMINIUM: "aluminum",
  ALUMINUM:  "aluminum",
  RICE:      "wheat",       // no rice — wheat fallback
  ZINC:      "copper",      // no zinc — copper fallback
  NICKEL:    "copper",      // no nickel — copper fallback
  LEAD:      "copper",      // no lead — copper fallback
};

// Precious metals trade as XAU/XAG/XPT/XPD vs USD on forex markets
const METALS_AS_FOREX = new Set(["XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD"]);

const FIAT_CURRENCIES = new Set([
  "USD","EUR","GBP","JPY","CHF","AUD","CAD","NZD",
  "SEK","NOK","DKK","SGD","HKD","CNY","CNH","MXN",
  "ZAR","TRY","BRL","INR","KRW","THB","PLN","CZK","HUF",
  // Precious metal codes — treated as forex base currencies
  "XAU","XAG","XPT","XPD",
]);

type AssetClass = "commodity" | "forex" | "crypto" | "us" | "uk" | "hk" | "eu";

interface Classified {
  raw: string;
  clean: string;
  assetClass: AssetClass;
  currency: string;
}

function classifySymbol(sym: string): Classified {
  const upper = sym.toUpperCase();

  // Energy, agricultural, industrial metals → API Ninjas
  if (NINJA_MAP[upper]) return { raw: upper, clean: upper, assetClass: "commodity", currency: "USD" };

  // Precious metals → Finage forex endpoint
  if (METALS_AS_FOREX.has(upper)) {
    return { raw: upper, clean: upper, assetClass: "forex", currency: "USD" };
  }

  // Crypto
  if (
    upper.endsWith("USDT") || upper.endsWith("USDC") ||
    (upper.endsWith("USD") && upper.length > 6) ||
    /^(BTC|ETH|BNB|SOL|XRP|ADA|DOGE|DOT|MATIC|AVAX|LINK|LTC|BCH|UNI|ATOM)/.test(upper)
  ) {
    return { raw: upper, clean: upper, assetClass: "crypto", currency: "USD" };
  }

  // Forex: 6-char pair
  if (upper.length === 6) {
    const base = upper.slice(0, 3);
    const quote = upper.slice(3, 6);
    if (FIAT_CURRENCIES.has(base) && FIAT_CURRENCIES.has(quote)) {
      return { raw: upper, clean: upper, assetClass: "forex", currency: quote };
    }
  }
  // Slash-separated pairs like GBP/USD
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(upper)) {
    const [base, quote] = upper.split("/");
    if (FIAT_CURRENCIES.has(base) && FIAT_CURRENCIES.has(quote)) {
      return { raw: upper, clean: base + quote, assetClass: "forex", currency: quote };
    }
  }

  // Equities by exchange suffix
  if (upper.endsWith(".L"))  return { raw: upper, clean: upper.replace(/\.L$/, ""),  assetClass: "uk", currency: "GBp" };
  if (upper.endsWith(".HK")) return { raw: upper, clean: upper.replace(/\.HK$/, ""), assetClass: "hk", currency: "HKD" };
  if (/\.(PA|DE|AMS|AS|MI|MC|BR|VX|ST|CO|OL|HE)$/i.test(upper)) {
    return { raw: upper, clean: upper, assetClass: "eu", currency: "EUR" };
  }

  return { raw: upper, clean: upper, assetClass: "us", currency: "USD" };
}

// ── Finage helpers ─────────────────────────────────────────────────────────────

function finageLastPath(ac: AssetClass): string {
  switch (ac) {
    case "forex":  return "last/forex";
    case "crypto": return "last/crypto";
    case "uk":     return "last/uk-stock";
    case "hk":     return "last/hk-stock";
    default:       return "last/stock";
  }
}

function finagePrevPath(ac: AssetClass): string {
  switch (ac) {
    case "forex":  return "agg/forex/prev-close";
    case "crypto": return "agg/crypto/prev-close";
    case "uk":     return "agg/uk-stock/prev-close";
    case "hk":     return "agg/hk-stock/prev-close";
    default:       return "agg/stock/prev-close";
  }
}

interface FinageLast { price?: number; rate?: number; ask?: number; bid?: number; [k: string]: unknown }
interface FinagePrev { close?: number; [k: string]: unknown }

async function fetchViaFinage(entry: Classified, apiKey: string): Promise<PriceQuote | null> {
  const sym = encodeURIComponent(entry.clean);
  const key = `apikey=${apiKey}`;

  const [lastRes, prevRes] = await Promise.allSettled([
    fetch(`${FINAGE_BASE}/${finageLastPath(entry.assetClass)}/${sym}?${key}`).then(r => r.json() as Promise<FinageLast>),
    fetch(`${FINAGE_BASE}/${finagePrevPath(entry.assetClass)}/${sym}?${key}`).then(r => r.json() as Promise<FinagePrev>),
  ]);

  const last = lastRes.status === "fulfilled" ? lastRes.value : null;
  const prev = prevRes.status === "fulfilled" ? prevRes.value : null;
  if (!last) return null;

  const price =
    last.price ??
    last.rate ??
    (last.ask != null && last.bid != null ? (last.ask + last.bid) / 2 : null) ??
    last.ask ??
    null;

  if (price == null || isNaN(Number(price)) || Number(price) <= 0) return null;

  const numPrice  = Number(price);
  const prevClose = prev?.close != null ? Number(prev.close) : 0;
  const change    = prevClose > 0 ? numPrice - prevClose : 0;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return { price: numPrice, change, changePct, prevClose, currency: entry.currency, shortName: entry.raw };
}

// ── API Ninjas commodity helper ────────────────────────────────────────────────
// Response: { name, price, updated } — single current price, no prev close

interface NinjaResponse { name?: string; price?: number; updated?: number; [k: string]: unknown }

async function fetchViaNinja(entry: Classified, apiKey: string): Promise<PriceQuote | null> {
  const name = NINJA_MAP[entry.raw];
  if (!name) return null;

  let res: NinjaResponse;
  try {
    res = await fetch(`${NINJA_BASE}?name=${encodeURIComponent(name)}`, {
      headers: { "X-Api-Key": apiKey },
    }).then(r => r.json());
  } catch {
    return null;
  }

  const price = res?.price;
  if (price == null || isNaN(Number(price)) || Number(price) <= 0) {
    console.warn("[prices] Ninja no price for", entry.raw, res);
    return null;
  }

  const numPrice = Number(price);

  // API Ninjas does not provide previous close — changePct will show 0 until we have a cached prev
  return {
    price: numPrice,
    change: 0,
    changePct: 0,
    prevClose: 0,
    currency: "USD",
    shortName: entry.raw,
  };
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols");
  if (!symbols?.trim()) {
    return NextResponse.json({ error: "symbols param required" }, { status: 400 });
  }

  const finageKey = process.env.FINAGE_API_KEY;
  if (!finageKey) {
    return NextResponse.json({ error: "FINAGE_API_KEY not configured" }, { status: 500 });
  }

  const ninjaKey = process.env.NINJA_API_KEY;

  const symbolList = symbols.split(",").map(s => s.trim()).filter(Boolean);
  const classified = symbolList.map(classifySymbol);

  const commoditySyms = classified.filter(c => c.assetClass === "commodity");
  const finageSymbols = classified.filter(c => c.assetClass !== "commodity");

  const [finageResults, ninjaResults] = await Promise.all([
    Promise.allSettled(finageSymbols.map(e => fetchViaFinage(e, finageKey).then(q => ({ raw: e.raw, q })))),
    ninjaKey && commoditySyms.length
      ? Promise.allSettled(commoditySyms.map(e => fetchViaNinja(e, ninjaKey).then(q => ({ raw: e.raw, q }))))
      : Promise.resolve([] as PromiseSettledResult<{ raw: string; q: PriceQuote | null }>[]),
  ]);

  const prices: Record<string, PriceQuote> = {};

  for (const r of finageResults) {
    if (r.status === "fulfilled" && r.value.q) prices[r.value.raw] = r.value.q;
    else if (r.status === "rejected") console.warn("[prices] finage fetch rejected:", r.reason);
  }

  if (Array.isArray(ninjaResults)) {
    for (const r of ninjaResults) {
      if (r.status === "fulfilled" && r.value.q) prices[r.value.raw] = r.value.q;
    }
  }

  if (commoditySyms.length && !ninjaKey) {
    console.warn("[prices] NINJA_API_KEY not set — commodity symbols skipped:", commoditySyms.map(s => s.raw));
  }

  console.log("[prices] resolved:", Object.keys(prices));

  return NextResponse.json({ prices, ts: Date.now() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
