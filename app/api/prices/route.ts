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

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols");
  if (!symbols?.trim()) {
    return NextResponse.json({ error: "symbols param required" }, { status: 400 });
  }

  const fields = [
    "regularMarketPrice",
    "regularMarketChange",
    "regularMarketChangePercent",
    "regularMarketPreviousClose",
    "shortName",
    "currency",
  ].join(",");

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${fields}`;

  let res: Response;
  try {
    res = await fetch(yahooUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON from Yahoo Finance" }, { status: 502 });
  }

  const results =
    (body as { quoteResponse?: { result?: unknown[] } })?.quoteResponse?.result ?? [];

  const prices: Record<string, PriceQuote> = {};
  for (const q of results as Record<string, unknown>[]) {
    const sym = q.symbol as string;
    if (!sym) continue;
    prices[sym] = {
      price: (q.regularMarketPrice as number) ?? 0,
      change: (q.regularMarketChange as number) ?? 0,
      changePct: (q.regularMarketChangePercent as number) ?? 0,
      prevClose: (q.regularMarketPreviousClose as number) ?? 0,
      currency: (q.currency as string) ?? "",
      shortName: (q.shortName as string) ?? sym,
    };
  }

  return NextResponse.json({ prices, ts: Date.now() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
