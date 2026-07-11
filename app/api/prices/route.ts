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
const AV_BASE     = "https://www.alphavantage.co/query";

const AV_MAP: Record<string, string> = {
  USOIL:     "WTI",
  WTI:       "WTI",
  UKOIL:     "BRENT",
  BRENT:     "BRENT",
  NGAS:      "NATURAL_GAS",
  COFFEE:    "COFFEE",
  SUGAR:     "SUGAR",
  COTTON:    "COTTON",
  CORN:      "CORN",
  WHEAT:     "WHEAT",
  SOYBEAN:   "CORN",
  COPPER:    "COPPER",
  ALUMINIUM: "ALUMINUM",
  ALUMINUM:  "ALUMINUM",
};

const METALS_AS_FOREX = new Set(["XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD"]);

const FIAT_CURRENCIES = new Set([
  "USD","EUR","GBP","JPY","CHF","AUD","CAD","NZD",
  "SEK","NOK","DKK","SGD","HKD","CNY","CNH","MXN",
  "ZAR","TRY","BRL","INR","KRW","THB","PLN","CZK","HUF",
  "XAU","XAG","XPT","XPD",
]);

type AssetClass = "energy_agri" | "forex" | "crypto" | "us" | "uk" | "hk" | "eu";

interface Classified {
  raw: string;
  clean: string;
  assetClass: AssetClass;
  currency: string;
}

function classifySymbol(sym: string): Classified {
  const upper = sym.toUpperCase();

  if (AV_MAP[upper]) return { raw: upper, clean: upper, assetClass: "energy_agri", currency: "USD" };
  if (["COCOA","RICE","ZINC","NICKEL","LEAD"].includes(upper)) {
    return { raw: upper, clean: upper, assetClass: "energy_agri", currency: "USD" };
  }

  if (METALS_AS_FOREX.has(upper)) {
    return { raw: upper, clean: upper, assetClass: "forex", currency: "USD" };
  }

  if (
    upper.endsWith("USDT") || upper.endsWith("USDC") ||
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

  if (upper.endsWith(".L"))  return { raw: upper, clean: upper.replace(/\.L$/, ""),  assetClass: "uk", currency: "GBp" };
  if (upper.endsWith(".HK")) return { raw: upper, clean: upper.replace(/\.HK$/, ""), assetClass: "hk", currency: "HKD" };
  if (/\.(PA|DE|AMS|AS|MI|MC|BR|VX|ST|CO|OL|HE)$/i.test(upper)) {
    return { raw: upper, clean: upper, assetClass: "eu", currency: "EUR" };
  }

  return { raw: upper, clean: upper, assetClass: "us", currency: "USD" };
}

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

interface AVCommodityResponse {
  data?: Array<{ date: string; value: string }>;
  [k: string]: unknown;
}

async function fetchAVCommodity(entry: Classified, apiKey: string): Promise<PriceQuote | null> {
  const fn = AV_MAP[entry.raw];
  if (!fn) return null;

  let res: AVCommodityResponse;
  try {
    res = await fetch(`${AV_BASE}?function=${fn}&interval=daily&apikey=${apiKey}`).then(r => r.json());
  } catch {
    return null;
  }

  const data = res?.data;
  if (!Array.isArray(data) || data.length < 1) {
    console.warn("[prices] AV no data for", entry.raw, Object.keys(res ?? {}));
    return null;
  }

  const price     = parseFloat(data[0]?.value ?? "");
  const prevClose = data.length > 1 ? parseFloat(data[1]?.value ?? "0") : 0;

  if (isNaN(price) || price <= 0) return null;

  const change    = prevClose > 0 ? price - prevClose : 0;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return { price, change, changePct, prevClose: isNaN(prevClose) ? 0 : prevClose, currency: "USD", shortName: entry.raw };
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols");
  if (!symbols?.trim()) {
    return NextResponse.json({ error: "symbols param required" }, { status: 400 });
  }

  const finageKey = process.env.FINAGE_API_KEY;
  if (!finageKey) {
    return NextResponse.json({ error: "FINAGE_API_KEY not configured" }, { status: 500 });
  }

  const avKey = process.env.ALPHA_VANTAGE_KEY;

  const symbolList = symbols.split(",").map(s => s.trim()).filter(Boolean);
  const classified = symbolList.map(classifySymbol);

  const energyAgriSyms = classified.filter(c => c.assetClass === "energy_agri");
  const finageSymbols  = classified.filter(c => c.assetClass !== "energy_agri");

  const [finageResults, energyAgriResults] = await Promise.all([
    Promise.allSettled(finageSymbols.map(e => fetchViaFinage(e, finageKey).then(q => ({ raw: e.raw, q })))),
    avKey && energyAgriSyms.length
      ? Promise.allSettled(energyAgriSyms.map(e => fetchAVCommodity(e, avKey).then(q => ({ raw: e.raw, q }))))
      : Promise.resolve([] as PromiseSettledResult<{ raw: string; q: PriceQuote | null }>[]),
  ]);

  const prices: Record<string, PriceQuote> = {};

  for (const r of finageResults) {
    if (r.status === "fulfilled" && r.value.q) prices[r.value.raw] = r.value.q;
    else if (r.status === "rejected") console.warn("[prices] finage fetch rejected:", r.reason);
  }

  if (Array.isArray(energyAgriResults)) {
    for (const r of energyAgriResults) {
      if (r.status === "fulfilled" && r.value.q) prices[r.value.raw] = r.value.q;
    }
  }

  if (energyAgriSyms.length && !avKey) {
    console.warn("[prices] ALPHA_VANTAGE_KEY not set — energy/agri symbols skipped:", energyAgriSyms.map(s => s.raw));
  }

  console.log("[prices] resolved:", Object.keys(prices));

  return NextResponse.json({ prices, ts: Date.now() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
