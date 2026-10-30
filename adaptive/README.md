# Adaptive strategy competition (research only)

This branch adds a deterministic, read-only competition between three long/cash candidates:
- adaptive momentum: EMA trend regime and pullback continuation;
- filtered mean reversion: RSI oversold entries only above the long-term EMA;
- volatility breakout: prior 20-bar high break with trend/ATR filters.

## Execution and safety
No Kraken private API, order endpoint, credentials, or execution path is included. The module explicitly reports `executionEnabled: false` and `ordersSupported: false`. This is a research simulator, not a trading bot deployment.

## Costs
Defaults are assumptions, not verified account fees: 26 bps fee + 4 bps full spread (half charged per side) + 5 bps slippage per side. Replace these with verified account-tier and instrument-specific measurements before interpreting results. Costs are charged on both entry and exit. No leverage, shorting, funding, or market impact model is included.

## Method
Signals are computed using information through the previous completed candle and filled at the next candle open. Walk-forward windows reserve a 220-bar indicator warmup; warmup bars are not included in each test window's PnL. Each fold starts flat with normalized capital of 1. Strategies are evaluated independently, not selected using future fold results.

## Limitations
- OHLC approximations cannot model queue position, partial fills, gaps inside candles, or order-book depth.
- The simple ATR/RSI/EMA rules are hypotheses, not established edges.
- A positive result on synthetic fixtures or a single asset is not evidence of profitability.
- Require multiple assets, timeframes, market regimes, and conservative costs before any paper deployment.
- Do not merge into production or alter risk settings based on these results.

Run tests:
```sh
node --test tests/adaptive-strategy-engine.test.mjs
```
