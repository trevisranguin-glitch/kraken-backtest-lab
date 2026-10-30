// Independent mean-reversion entry study. Research-only; no exchange order APIs.
import { ema, rsi, atr } from "./strategy-engine.mjs";
import { detectMarketRegimes } from "./regime-engine.mjs";

export const MEAN_REVERSION_VARIANTS = Object.freeze({
  classic_reclaim: "RSI crosses back above 30 after oversold; no EMA100 filter",
  trend_pullback: "Close above EMA100 and RSI crosses back above 35",
  range_reclaim: "Prior closed regime is RANGE and RSI crosses back above 35"
});

function buildSignals(bars, variant, labels) {
  const close = bars.map(b => b.c);
  const e100 = ema(close, 100), strength = rsi(close, 14), volatility = atr(bars, 14);
  const buy = Array(bars.length).fill(false), sell = Array(bars.length).fill(false);
  for (let i = 200; i < bars.length; i++) {
    const p = i - 1;
    if (![close[p], e100[p], strength[p], strength[p - 1], volatility[p]].every(Number.isFinite)) continue;
    const reclaim30 = strength[p - 1] < 30 && strength[p] >= 30;
    const reclaim35 = strength[p - 1] < 35 && strength[p] >= 35;
    if (variant === "classic_reclaim") buy[i] = reclaim30;
    if (variant === "trend_pullback") buy[i] = close[p] > e100[p] && reclaim35;
    if (variant === "range_reclaim") buy[i] = labels[p] === "RANGE" && reclaim35;
    sell[i] = strength[p] >= 60 || close[p] < e100[p];
  }
  return { buy, sell };
}

export function evaluateMeanReversionVariant(bars, variant, options = {}) {
  if (!Array.isArray(bars) || bars.length < 260) throw new Error("At least 260 OHLC bars are required");
  if (!Object.hasOwn(MEAN_REVERSION_VARIANTS, variant)) throw new Error("Unknown mean-reversion variant");
  for (const b of bars) if (![b.o,b.h,b.l,b.c].every(Number.isFinite) || b.o <= 0 || b.c <= 0 || b.h < b.l) throw new Error("Invalid OHLC bar");
  const feeBps = options.feeBps ?? 26, spreadBps = options.spreadBps ?? 4, slippageBps = options.slippageBps ?? 5;
  if (![feeBps,spreadBps,slippageBps].every(x => Number.isFinite(x) && x >= 0)) throw new Error("Invalid costs");
  const cost = (feeBps + spreadBps / 2 + slippageBps) / 10000;
  const labels = detectMarketRegimes(bars, options.regimeOptions).regimes.map(x => x.regime);
  const { buy, sell } = buildSignals(bars, variant, labels);
  let cash = 1, units = 0, entry = 0, trades = 0, wins = 0, peak = 1, maxDD = 0;
  const start = 220;
  for (let i = start; i < bars.length; i++) {
    const px = bars[i].o;
    if (units && sell[i]) {
      cash = units * px * (1 - cost);
      if (cash > entry) wins++;
      units = 0; entry = 0; trades++;
    } else if (!units && buy[i]) {
      entry = cash;
      units = cash * (1 - cost) / px;
      cash = 0;
    }
    const equity = cash + units * bars[i].c * (1 - cost);
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, (peak - equity) / peak);
  }
  if (units) {
    cash = units * bars.at(-1).c * (1 - cost);
    if (cash > entry) wins++;
    trades++;
  }
  const buyHold = (bars.at(-1).c * (1 - cost)) / (bars[start].o * (1 + cost));
  return {
    variant, description: MEAN_REVERSION_VARIANTS[variant],
    signalCount: buy.slice(start).filter(Boolean).length,
    trades, winRatePct: trades ? wins / trades * 100 : 0,
    returnPct: (cash - 1) * 100,
    buyHoldReturnPct: (buyHold - 1) * 100,
    excessVsBuyHoldPct: (cash - buyHold) * 100,
    maxDrawdownPct: maxDD * 100,
    costsBpsPerSide: feeBps + spreadBps / 2 + slippageBps,
    executionEnabled: false, ordersSupported: false
  };
}

export function compareMeanReversionVariants(bars, options = {}) {
  return {
    mode: "read-only-mean-reversion-entry-study",
    executionEnabled: false, ordersSupported: false,
    variants: Object.keys(MEAN_REVERSION_VARIANTS).map(name => evaluateMeanReversionVariant(bars, name, options))
  };
}
