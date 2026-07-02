import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export type MomentumStats = {
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fromHighPct: number | null;
  volume: number | null;
  avgVolume: number | null;
  rsi14: number | null;
  ma50: number | null;
  ma200: number | null;
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TWELVE_DATA_API_KEY not set" }, { status: 500 });

  const sym = encodeURIComponent(symbol.toUpperCase());
  const key = `apikey=${apiKey}`;
  const base = "https://api.twelvedata.com";

  const [quoteRes, rsiRes, ma50Res, ma200Res] = await Promise.allSettled([
    fetch(`${base}/quote?symbol=${sym}&${key}`).then((r) => r.json()),
    fetch(`${base}/rsi?symbol=${sym}&interval=1day&time_period=14&outputsize=1&${key}`).then((r) => r.json()),
    fetch(`${base}/ema?symbol=${sym}&interval=1day&time_period=50&outputsize=1&${key}`).then((r) => r.json()),
    fetch(`${base}/ema?symbol=${sym}&interval=1day&time_period=200&outputsize=1&${key}`).then((r) => r.json()),
  ]);

  const result: MomentumStats = {
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    fromHighPct: null,
    volume: null,
    avgVolume: null,
    rsi14: null,
    ma50: null,
    ma200: null,
  };

  if (quoteRes.status === "fulfilled") {
    const q = quoteRes.value as Record<string, unknown>;
    if (q.status !== "error") {
      const fw = q.fifty_two_week as Record<string, string> | undefined;
      if (fw?.high) result.fiftyTwoWeekHigh = parseFloat(fw.high);
      if (fw?.low) result.fiftyTwoWeekLow = parseFloat(fw.low);
      if (q.volume) result.volume = parseInt(q.volume as string);
      if (q.average_volume) result.avgVolume = parseInt(q.average_volume as string);
      const close = parseFloat(q.close as string);
      if (result.fiftyTwoWeekHigh && close > 0) {
        result.fromHighPct = ((close - result.fiftyTwoWeekHigh) / result.fiftyTwoWeekHigh) * 100;
      }
    }
  }

  if (rsiRes.status === "fulfilled") {
    const d = rsiRes.value as Record<string, unknown>;
    const values = d.values as Array<Record<string, string>> | undefined;
    if (values?.[0]?.rsi) result.rsi14 = parseFloat(values[0].rsi);
  }

  if (ma50Res.status === "fulfilled") {
    const d = ma50Res.value as Record<string, unknown>;
    const values = d.values as Array<Record<string, string>> | undefined;
    if (values?.[0]?.ema) result.ma50 = parseFloat(values[0].ema);
  }

  if (ma200Res.status === "fulfilled") {
    const d = ma200Res.value as Record<string, unknown>;
    const values = d.values as Array<Record<string, string>> | undefined;
    if (values?.[0]?.ema) result.ma200 = parseFloat(values[0].ema);
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=300" } });
}
