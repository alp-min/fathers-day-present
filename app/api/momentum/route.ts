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

const BASE = "https://api.finage.co.uk";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const apiKey = process.env.FINAGE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "FINAGE_API_KEY not set" }, { status: 500 });

  const sym = encodeURIComponent(symbol.toUpperCase());
  const key = `apikey=${apiKey}`;

  const [detailRes, rsiRes, ma50Res, ma200Res] = await Promise.allSettled([
    fetch(`${BASE}/detail/stock/${sym}?${key}`).then((r) => r.json()),
    fetch(`${BASE}/indicator/rsi/${sym}?period=14&interval=1day&${key}`).then((r) => r.json()),
    fetch(`${BASE}/indicator/ema/${sym}?period=50&interval=1day&${key}`).then((r) => r.json()),
    fetch(`${BASE}/indicator/ema/${sym}?period=200&interval=1day&${key}`).then((r) => r.json()),
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

  if (detailRes.status === "fulfilled") {
    const d = detailRes.value as Record<string, unknown>;
    if (!d.error) {
      const high52 = parseFloat((d.week52High ?? d.fiftyTwoWeekHigh ?? d["52WeekHigh"]) as string);
      const low52 = parseFloat((d.week52Low ?? d.fiftyTwoWeekLow ?? d["52WeekLow"]) as string);
      const price = parseFloat((d.price ?? d.close ?? d.ask) as string);
      const vol = parseInt((d.volume) as string);
      const avgVol = parseInt((d.avgVolume ?? d.averageVolume) as string);

      if (!isNaN(high52)) result.fiftyTwoWeekHigh = high52;
      if (!isNaN(low52)) result.fiftyTwoWeekLow = low52;
      if (!isNaN(vol)) result.volume = vol;
      if (!isNaN(avgVol)) result.avgVolume = avgVol;
      if (result.fiftyTwoWeekHigh && !isNaN(price) && price > 0) {
        result.fromHighPct = ((price - result.fiftyTwoWeekHigh) / result.fiftyTwoWeekHigh) * 100;
      }
    }
  }

  if (rsiRes.status === "fulfilled") {
    const d = rsiRes.value as Record<string, unknown>;
    const results = d.results as Array<Record<string, unknown>> | undefined;
    const rsiVal = results?.[0]?.rsi ?? d.rsi;
    if (rsiVal != null) result.rsi14 = parseFloat(rsiVal as string);
  }

  if (ma50Res.status === "fulfilled") {
    const d = ma50Res.value as Record<string, unknown>;
    const results = d.results as Array<Record<string, unknown>> | undefined;
    const emaVal = results?.[0]?.ema ?? results?.[0]?.value ?? d.ema;
    if (emaVal != null) result.ma50 = parseFloat(emaVal as string);
  }

  if (ma200Res.status === "fulfilled") {
    const d = ma200Res.value as Record<string, unknown>;
    const results = d.results as Array<Record<string, unknown>> | undefined;
    const emaVal = results?.[0]?.ema ?? results?.[0]?.value ?? d.ema;
    if (emaVal != null) result.ma200 = parseFloat(emaVal as string);
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=300" } });
}
