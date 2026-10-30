// Public Kraken OHLC ingestion only. No private API or order capability.
const ALLOWED_INTERVALS = new Set([60, 240, 1440]);
export async function fetchClosedOHLC({ pair = "XBTEUR", interval = 240, fetchImpl = fetch, now = Date.now() } = {}) {
  const symbol = String(pair).toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(symbol)) throw new Error("Invalid Kraken pair");
  if (!ALLOWED_INTERVALS.has(Number(interval))) throw new Error("Allowed intervals: 60, 240, 1440");
  const url = new URL("https://api.kraken.com/0/public/OHLC");
  url.searchParams.set("pair", symbol);
  url.searchParams.set("interval", String(interval));
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Kraken HTTP " + response.status);
  const payload = await response.json();
  if (payload.error?.length) throw new Error(payload.error.join(", "));
  const key = Object.keys(payload.result || {}).find(k => k !== "last");
  if (!key) throw new Error("Kraken returned no OHLC pair");
  const intervalMs = Number(interval) * 60_000;
  const all = payload.result[key].map(row => ({
    t: Number(row[0]) * 1000,
    o: Number(row[1]), h: Number(row[2]), l: Number(row[3]),
    c: Number(row[4]), v: Number(row[6])
  }));
  const bars = all.filter(bar => bar.t + intervalMs <= now);
  if (bars.some(bar => ![bar.t,bar.o,bar.h,bar.l,bar.c,bar.v].every(Number.isFinite) || bar.o<=0 || bar.c<=0 || bar.h<bar.l)) {
    throw new Error("Invalid OHLC data returned by Kraken");
  }
  return { pair: symbol, resultKey: key, intervalMinutes: Number(interval), bars, receivedBars: all.length, excludedOpenCandles: all.length-bars.length, limitNote: "Kraken public OHLC endpoint returns at most 720 recent candles; this is not a full-history archive." };
}
