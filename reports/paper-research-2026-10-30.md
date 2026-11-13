# KRAKEN paper research — 2026-10-30

## Evidence

GitHub Actions run: https://github.com/trevisranguin-glitch/kraken-backtest-lab/actions/runs/41133276003

- Workflow conclusion: success.
- Public Kraken OHLC, 4h interval, closed candles only.
- Three markets: XBTEUR, ETHEUR, SOLEUR.
- 720 candles per market; common sample 2026-07-02 20:00 UTC to 2026-10-30 16:00 UTC.
- 338 train bars and 182 validation bars after warmup.
- Initial capital: €1,000; research-only; `executionEnabled:false`.

## Chronological strategy comparison

| Strategy | Train return | Validation return | Validation max drawdown | Validation trades |
|---|---:|---:|---:|---:|
| SMA20/50 | +1.261% | -2.870% | -3.094% | 18 |
| SMA50/200 | +0.708% | -2.177% | -2.441% | 16 |
| Momentum20 | +2.793% | -6.884% | -7.569% | 50 |
| SMA20/50 + momentum | +1.528% | -3.208% | -3.430% | 20 |
| Passive 25% crypto reference | +11.367% | -3.894% | n/a | one entry per asset |

The isolated SMA20/50 4h backtest reports -3.326% net return, -7.397% maximum drawdown and 89 trades over the same 720-bar window.

## Interpretation

- No tested strategy is profitable in validation.
- SMA50/200 has the least negative validation return and lowest reported validation drawdown, but the sample is short and this is not proof of an edge.
- Momentum20 is materially worse in validation despite leading training: a clear overfitting / regime-sensitivity warning.
- The passive benchmark is a reference, not a directly identical risk allocation to every strategy.
- These results do not authorize strategy promotion or changes to the production bot.

## Data quality limitation

This run still uses the REST sample capped at 720 candles per market. It is not the full downloadable archive and does not cover a complete market cycle. The newly added OHLCVT archive importer is the next data-quality step; the archive has not yet been imported into this run.

## Safety

Read-only public market data. No private endpoints, order API, production Worker changes, deployments, or risk-parameter changes. `executionEnabled:false`, `ordersSupported:false`.
