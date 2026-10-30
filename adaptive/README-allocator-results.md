# Regime allocator research — 2026-10-30

## Evidence
GitHub Actions run: 41089084403. Both unit-test and market-research jobs completed successfully.
Data: public Kraken OHLC, XBTEUR / ETHEUR / SOLEUR, 60m / 240m / 1440m. Nine markets, 720 closed candles each, one still-open candle excluded per market.
Window: 2026-09-30 through 2026-10-30 (UTC, exact first/last candles vary by market).
Method: four walk-forward folds, 220-bar warmup, previous closed candle regime controls next-open decisions. Costs are placeholders: 26 bps fee + 2 bps half-spread + 5 bps slippage per side (33 bps per side).

## Aggregate results
Unweighted mean across the nine pair/timeframe markets:

| Allocator | Mean net return | Mean excess vs buy-and-hold | Mean max drawdown | Trades | Active markets | Robust markets |
|---|---:|---:|---:|---:|---:|---:|
| Trend + range | -1.348% | -2.355% | 2.719% | 61 | 6/9 | 0/9 |
| Trend momentum only | -1.348% | -2.355% | 2.719% | 61 | 6/9 | 0/9 |
| Trend breakout only | -1.097% | -2.105% | 1.521% | 17 | 6/9 | 0/9 |

No candidate met the robustness rule in any market. All results are research-only and do not establish a tradable edge.

## Important findings
- The trend-plus-range and trend-momentum-only results are identical across all nine markets. The mean-reversion mapping did not add trades or change the outcome in this sample; it should not be treated as a validated range strategy.
- On 1h, all three allocators stayed in cash across all three assets. That avoided the negative buy-and-hold periods but produced zero active trades and therefore is not strategy evidence.
- 4h and 1d allocations did trade, but returns and benchmark excess were generally negative.
- Breakout had lower average drawdown, but also negative average return and benchmark excess; lower drawdown alone is not sufficient.

## Decision
Do not promote any allocator to paper execution or production. Keep execution disabled.
Next research priorities:
1. Validate mean-reversion signal availability and regime mapping with per-regime signal/trade diagnostics.
2. Add cost sensitivity at lower/base/higher realistic fee tiers only after account fee tier is confirmed.
3. Extend history with independently sourced OHLC if available; Kraken OHLC REST is capped at 720 recent bars.
4. Compare against cash and buy-and-hold with identical fold boundaries and costs.
5. Require out-of-sample stability across assets and timeframes before any paper candidate is selected.

## Safety
`executionEnabled: false`; `ordersSupported: false`. No private endpoints, live orders, Worker deployment, or risk-setting changes.
