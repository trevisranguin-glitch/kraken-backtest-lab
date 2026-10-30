# Market regime engine (research only)

This branch adds a causal OHLC regime classifier and corrects the research score so idle cash is not mistaken for strategy skill.

## Regime labels
- `TREND_UP` / `TREND_DOWN`: EMA50/EMA200 spread, EMA50 slope and 20-bar efficiency ratio agree.
- `RANGE`: low directional efficiency and limited EMA spread.
- `HIGH_VOLATILITY`: current ATR percentage exceeds the 80th percentile of the preceding volatility window.
- `TRANSITION`: conditions do not agree.
- `WARMUP`: insufficient prior observations.

All volatility thresholds use past observations only. A future-candle invariance test guards against look-ahead leakage.

## Scoring correction
The primary research score is now mean net strategy return minus half the mean drawdown. Buy-and-hold excess remains a separate metric. A candidate cannot be called robust unless it is active in at least 75% of folds, positive in at least 75%, beats buy-and-hold in at least 75%, and has at least three trades.

This does not prove predictive value. The classifier is a first-pass heuristic, not a calibrated probabilistic model. Thresholds require out-of-sample validation across longer histories and assets.

## Safety
Read-only research only. `executionEnabled: false`; `ordersSupported: false`. No private Kraken endpoints, order placement, production Worker changes, or risk-setting changes.
