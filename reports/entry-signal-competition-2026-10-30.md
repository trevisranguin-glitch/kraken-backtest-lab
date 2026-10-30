# Entry signal competition — 2026-10-30

## Decision

**No entry candidate is robust. Do not promote or deploy any candidate.** All results are research-only and based on a limited recent Kraken OHLC sample.

## Validation

- 9 markets: XBTEUR, ETHEUR, SOLEUR × 60, 240, 1440 minutes.
- 720 closed candles per market; 6,480 market-candles in total.
- 4 disjoint chronological test folds per market.
- 220-bar initial warmup; no parameter optimization.
- 3 cost scenarios: 33, 50, 75 bps per side.
- Identical same-window buy-and-hold benchmark and transaction costs.
- 324 market/fold/candidate/cost comparisons (9 × 4 × 3 × 3).
- Unit tests and market-research workflow passed.
- Explicit read-only mode: executionEnabled=false, ordersSupported=false.

## Aggregate results

Averages below are means of the nine market-level walk-forward summaries; each market summary averages its four folds.

| Candidate | Cost | Mean net return | Mean excess vs B&H | Mean drawdown | Active folds / 36 | Trades | Robust markets |
|---|---:|---:|---:|---:|---:|---:|---:|
| Confirmed momentum | 33 bps | -1.558% | -2.474% | 4.169% | 15 | 71 | 0/9 |
| Confirmed momentum | 50 bps | -2.171% | -2.744% | 4.634% | 15 | 71 | 0/9 |
| Confirmed momentum | 75 bps | -3.044% | -3.116% | 5.309% | 15 | 71 | 0/9 |
| EMA20/50 pullback | 33 bps | -1.429% | -2.344% | 4.080% | 15 | 71 | 0/9 |
| EMA20/50 pullback | 50 bps | -2.045% | -2.618% | 4.539% | 15 | 71 | 0/9 |
| EMA20/50 pullback | 75 bps | -2.925% | -2.996% | 5.206% | 15 | 71 | 0/9 |
| Volatility breakout | 33 bps | -0.403% | -1.319% | 3.452% | 17 | 30 | 0/9 |
| Volatility breakout | 50 bps | -0.683% | -1.256% | 3.563% | 17 | 30 | 0/9 |
| Volatility breakout | 75 bps | -1.090% | -1.161% | 3.748% | 17 | 30 | 0/9 |

## Interpretation

1. No candidate generated positive average net returns in any cost scenario.
2. No candidate beat same-window buy-and-hold on average.
3. The volatility-filtered breakout is the least weak candidate on net return and drawdown, but still loses money and underperforms the benchmark. It is **not** a validated strategy.
4. Momentum and pullback produced 71 trades each and were particularly sensitive to transaction costs.
5. The 720-candle endpoint cap means the 1h and 4h samples cover only recent months/days, not a full market cycle. This cannot establish durable edge or profitability.
6. The aggregate does not establish statistical significance. A larger archived dataset and independent period are required before any candidate could be reconsidered.

## Next research direction

Do not add complexity to the losing candidates. First improve data quality and test breadth:
- Build a locally versioned public OHLC archive with pagination where supported, integrity checks, duplicate/gap detection and timestamped snapshots.
- Add more liquid EUR-quoted pairs only after validating minimum history and liquidity.
- Separate calibration periods from untouched final holdout periods; pre-register hypotheses before each test.
- Include realistic spread/slippage by market and time, not a single flat assumption.
- Keep idle cash, active-only results, fold counts, trade ledger and same-window benchmark visible.

## Safety

No Worker or production configuration changed. No private Kraken endpoint, order API, live order, deployment, or risk-parameter change was used. Paper/live execution remains disabled.
