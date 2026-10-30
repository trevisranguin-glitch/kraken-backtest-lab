// Research-only execution accounting. No exchange API and no order capability.
export function simulateLongOnlyAccounting({ bars, buySignals, sellSignals, startIndex = 0, endIndex = bars?.length - 1, feeBps = 26, spreadBps = 4, slippageBps = 5, exitReasons = {} }) {
  if (!Array.isArray(bars) || bars.length < 2) throw new Error("At least two bars are required");
  if (!Array.isArray(buySignals) || !Array.isArray(sellSignals) || buySignals.length !== bars.length || sellSignals.length !== bars.length) throw new Error("Signal arrays must match bars");
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= bars.length) throw new Error("Invalid startIndex");
  if (!Number.isInteger(endIndex) || endIndex < startIndex || endIndex >= bars.length) throw new Error("Invalid endIndex");
  for (const b of bars) if (![b.o,b.h,b.l,b.c].every(Number.isFinite) || b.o <= 0 || b.c <= 0 || b.h < b.l) throw new Error("Invalid OHLC bar");
  for (const x of [feeBps,spreadBps,slippageBps]) if (!Number.isFinite(x) || x < 0) throw new Error("Invalid transaction costs");
  const costRate = (feeBps + spreadBps / 2 + slippageBps) / 10000;
  if (costRate >= 1) throw new Error("Transaction cost rate must be below 100%");
  let cash = 1, units = 0, entryCash = 0, entryPrice = 0, entryIndex = -1, entryCosts = 0;
  let peak = 1, maxDrawdownPct = 0;
  const trades = [], equityCurve = [];
  const markEquity = close => cash + (units > 0 ? units * close * (1 - costRate) : 0);
  const closePosition = (price, index, reason) => {
    const exitGross = units * price;
    const exitCosts = exitGross * costRate;
    const exitNet = exitGross - exitCosts;
    const netPnl = exitNet - entryCash;
    trades.push({
      entryIndex, exitIndex: index, entryTime: bars[entryIndex].t ?? null, exitTime: bars[index].t ?? null,
      entryPrice, exitPrice: price, units,
      entryGrossNotional: units * entryPrice, entryCosts,
      exitGrossNotional: exitGross, exitCosts,
      grossPnl: exitGross - units * entryPrice,
      netPnl, netReturnPct: entryCash ? netPnl / entryCash * 100 : 0,
      holdingBars: index - entryIndex, exitReason: reason
    });
    cash = exitNet; units = 0; entryCash = 0; entryPrice = 0; entryIndex = -1; entryCosts = 0;
  };
  for (let i = startIndex; i <= endIndex; i++) {
    const open = bars[i].o;
    if (units > 0 && sellSignals[i]) {
      closePosition(open, i, exitReasons[i] ?? "signal");
    } else if (units === 0 && buySignals[i]) {
      entryCash = cash;
      // Cash is the complete debit: notional + entry transaction costs.
      units = cash / (open * (1 + costRate));
      entryPrice = open; entryIndex = i;
      entryCosts = units * open * costRate;
      cash = 0;
    }
    const equity = markEquity(bars[i].c);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (peak - equity) / peak * 100);
    equityCurve.push({ index: i, time: bars[i].t ?? null, equity, cash, units });
  }
  if (units > 0) closePosition(bars[endIndex].c, endIndex, "end_of_test_liquidation");
  const finalEquity = cash;
  return {
    mode: "read-only-accounting-research", executionEnabled: false, ordersSupported: false,
    initialEquity: 1, finalEquity, returnPct: (finalEquity - 1) * 100,
    maxDrawdownPct, trades, tradeCount: trades.length,
    costsBpsPerSide: feeBps + spreadBps / 2 + slippageBps,
    equityCurve
  };
}
