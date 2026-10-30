# Mean-reversion entry study — results and decision

Date: 2026-10-30
Branch: `research/mean-reversion-entry-study`
Research commit tested: `227923506e435bdf7dffaf73719086ec0e3afff6`
GitHub Actions run: [41092840274](https://github.com/trevisranguin-glitch/kraken-backtest-lab/actions/runs/41092840274)

## Validation

- Unit tests: passed.
- Public OHLC walk-forward research: passed for 9/9 pair/timeframe combinations.
- Four rolling folds per market/timeframe; 220 warmup bars excluded from each test window.
- Closed Kraken OHLC candles only; entries/exits at next candle open.
- Cost assumption: 26 bps fee + 2 bps half-spread + 5 bps slippage = 33 bps per side. This is a research assumption, not a verified account-specific execution cost.
- No private Kraken endpoints, order APIs, Worker deployment, or live execution.
- `executionEnabled:false`, `ordersSupported:false`.

## Mean-reversion variants

Unweighted arithmetic means across the nine pair/timeframe combinations:

| Variant | Mean net return | Mean excess vs buy-and-hold | Mean max drawdown | Trades | Active markets | Robust markets |
|---|---:|---:|---:|---:|---:|---:|
| classic_reclaim | -0.979% | -1.987% | 1.416% | 55 | 9/9 | 0/9 |
| trend_pullback | +0.501% | -0.507% | 0.278% | 6 | 4/9 | 0/9 |
| range_reclaim | -0.125% | -1.133% | 0.147% | 10 | 5/9 | 0/9 |

No variant meets the robustness criteria. The small positive mean of trend_pullback is not meaningful evidence of an edge: it produced only six trades, was inactive in five markets, and underperformed buy-and-hold on average.

## Regime allocator comparison

| Allocator | Mean net return | Mean excess vs buy-and-hold | Mean drawdown | Trades | Robust markets |
|---|---:|---:|---:|---:|---:|
| trend-plus-range | -1.348% | -2.355% | 2.719% | 61 | 0/9 |
| trend-momentum-only | -1.348% | -2.355% | 2.719% | 61 | 0/9 |
| trend-breakout-only | -1.097% | -2.105% | 1.521% | 17 | 0/9 |

The identical trend-plus-range and trend-momentum-only results indicate that the RANGE-to-mean-reversion allocation did not contribute trades or change performance in this sample.

## Decision

Do not promote any candidate to paper execution or production. Do not merge this research PR as a strategy promotion. Preserve the existing paper-only production configuration and all risk settings.

## Next research direction

The next experiment should isolate exit logic and trade economics before widening entry-parameter searches:
1. Export per-trade entry/exit timestamps, prices, gross PnL, fee, spread, slippage, net PnL, holding duration, and exit reason.
2. Add accounting tests for buy-side and sell-side costs, terminal open positions, and mark-to-market drawdown.
3. Compare fixed/ATR-based stop, time stop, and current EMA/RSI exit as separate hypotheses, with entries held constant.
4. Include a stricter cost sensitivity (e.g. 33/50/75 bps per side) and require minimum trade counts before ranking candidates.
5. Keep all experiments isolated to this research branch and read-only.

The current sample is recent and limited to the Kraken public OHLC endpoint's 720-candle window per timeframe. Results are exploratory, not evidence of durable profitability.
