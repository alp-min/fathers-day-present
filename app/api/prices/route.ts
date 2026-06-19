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

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY not configured" }, { status: 500 });
  }

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Twelve Data returned ${res.status}` }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON from Twelve Data" }, { status: 502 });
  }

  const prices: Record<string, PriceQuote> = {};

  function parseQuote(sym: string, q: Record<string, unknown>) {
    if (q.status === "error" || !q.close) return;
    const close = parseFloat(q.close as string);
    const prevClose = parseFloat(q.previous_close as string);
    const change = close - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    prices[sym.toUpperCase()] = {
      price: close,
      change,
      changePct,
      prevClose,
      currency: (q.currency as string) ?? "",
      shortName: (q.name as string) ?? sym,
    };
  }

  const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase());

  if (symbolList.length === 1) {
    parseQuote(symbolList[0], body as Record<string, unknown>);
  } else {
    const map = body as Record<string, Record<string, unknown>>;
    for (const sym of symbolList) {
      const q = map[sym] ?? map[sym.toLowerCase()];
      if (q) parseQuote(sym, q);
    }
  }

  return NextResponse.json({ prices, ts: Date.now() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
