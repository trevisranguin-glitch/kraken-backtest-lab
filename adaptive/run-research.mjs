import { writeFile } from "node:fs/promises";
import { fetchClosedOHLC } from "./kraken-data.mjs";
import { walkForward, DEFAULT_COSTS } from "./strategy-engine.mjs";

const pairs = ["XBTEUR","ETHEUR","SOLEUR"];
const intervals = [60,240,1440];
const report = {
  generatedAt: new Date().toISOString(),
  mode: "public-market-data-read-only",
  executionEnabled: false,
  ordersSupported: false,
  costs: DEFAULT_COSTS,
  methodology: "Four rolling walk-forward test windows per pair/timeframe; 220-bar indicator warmup excluded from each test window; each fold starts flat; next-open fills; fee + half spread + slippage on both sides.",
  results: []
};
for (const pair of pairs) {
  for (const interval of intervals) {
    try {
      const market = await fetchClosedOHLC({ pair, interval });
      if (market.bars.length < 340) throw new Error("Insufficient closed candles for four folds: " + market.bars.length);
      const result = walkForward(market.bars, { folds: 4, warmupBars: 220 });
      report.results.push({
        pair, intervalMinutes: interval, resultKey: market.resultKey,
        bars: market.bars.length, excludedOpenCandles: market.excludedOpenCandles,
        firstCandle: new Date(market.bars[0].t).toISOString(),
        lastCandle: new Date(market.bars.at(-1).t).toISOString(),
        ...result
      });
    } catch (error) {
      report.results.push({ pair, intervalMinutes: interval, error: String(error?.message || error) });
    }
    await new Promise(resolve => setTimeout(resolve, 1300));
  }
}
const successful = report.results.filter(x => x.results);
await writeFile("adaptive-research-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  successfulMarkets: successful.length,
  failedMarkets: report.results.length-successful.length,
  results: successful.map(m => ({
    pair:m.pair,intervalMinutes:m.intervalMinutes,bars:m.bars,
    candidates:Object.entries(m.results).map(([name,r])=>({
      name,meanReturnPct:r.meanReturnPct,meanExcessVsBuyHoldPct:r.meanExcessVsBuyHoldPct,
      meanMaxDrawdownPct:r.meanMaxDrawdownPct,positiveWindows:r.positiveWindows,
      benchmarkWinningWindows:r.benchmarkWinningWindows,totalTrades:r.totalTrades,
      researchScore:r.researchScore,robust:r.robust
    }))
  })),
  errors:report.results.filter(x=>x.error)
},null,2));
if (!successful.length) process.exitCode = 1;
