// Walk-forward competition for regime-conditioned strategy allocation. Research only.
import { detectMarketRegimes } from "./regime-engine.mjs";
import { simulate, diagnoseStrategySignals } from "./strategy-engine.mjs";

export const REGIME_ALLOCATORS = Object.freeze({
  "trend-plus-range": {
    TREND_UP: "adaptive-momentum",
    RANGE: "filtered-mean-reversion"
  },
  "trend-momentum-only": {
    TREND_UP: "adaptive-momentum"
  },
  "trend-breakout-only": {
    TREND_UP: "volatility-breakout"
  }
});

export function walkForwardRegimeCompetition(bars, options = {}) {
  if (!Array.isArray(bars)) throw new Error("Bars must be an array");
  const warmup = options.warmupBars ?? 220;
  const folds = options.folds ?? 4;
  if (!Number.isInteger(warmup) || warmup < 220) throw new Error("warmupBars must be an integer >= 220");
  if (!Number.isInteger(folds) || folds < 2) throw new Error("At least two folds are required");
  const foldSize = Math.floor((bars.length - warmup) / folds);
  if (foldSize < 30) throw new Error("Insufficient data for regime walk-forward folds");

  const detected = detectMarketRegimes(bars, options.regimeOptions);
  const labels = detected.regimes.map(x => x.regime);
  const allocators = options.allocators ?? REGIME_ALLOCATORS;
  const results = {};
  for (const [name, mapping] of Object.entries(allocators)) {
    const windows = [];
    for (let fold = 0; fold < folds; fold++) {
      const start = warmup + fold * foldSize;
      const end = fold === folds - 1 ? bars.length : warmup + (fold + 1) * foldSize;
      const segment = bars.slice(start - warmup, end);
      const regimeLabels = labels.slice(start - warmup, end);
      const result = simulate(segment, "adaptive-momentum", {
        ...options.costs,
        startIndex: warmup,
        regimeStrategyMap: mapping,
        regimeLabels
      });
      windows.push({ ...result, window: fold + 1, testBars: end - start });
    }
    const meanReturnPct = windows.reduce((s, x) => s + x.returnPct, 0) / folds;
    const meanExcessVsBuyHoldPct = windows.reduce((s, x) => s + x.excessVsBuyHoldPct, 0) / folds;
    const meanMaxDrawdownPct = windows.reduce((s, x) => s + x.maxDrawdownPct, 0) / folds;
    const positiveWindows = windows.filter(x => x.returnPct > 0).length;
    const benchmarkWinningWindows = windows.filter(x => x.excessVsBuyHoldPct > 0).length;
    const activeWindows = windows.filter(x => x.trades > 0).length;
    const totalTrades = windows.reduce((s, x) => s + x.trades, 0);
    const robust = positiveWindows >= Math.ceil(folds * 0.75) &&
      benchmarkWinningWindows >= Math.ceil(folds * 0.75) &&
      activeWindows >= Math.ceil(folds * 0.75) &&
      meanReturnPct > 0 && meanExcessVsBuyHoldPct > 0 && totalTrades >= 3;
    results[name] = {
      windows, meanReturnPct, meanExcessVsBuyHoldPct, meanMaxDrawdownPct,
      positiveWindows, benchmarkWinningWindows, activeWindows, totalTrades,
      folds, researchScore: meanReturnPct - 0.5 * meanMaxDrawdownPct, robust
    };
  }
  return {
    mode: "read-only-regime-walk-forward",
    executionEnabled: false,
    ordersSupported: false,
    regimeCounts: Object.fromEntries([...new Set(labels)].map(label => [label, labels.filter(x => x === label).length])),
    signalDiagnostics: diagnoseStrategySignals(bars, labels),
    results
  };
}
