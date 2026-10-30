# Historical Kraken OHLCVT archive ingestion

## Why this exists

The REST OHLC endpoint is capped at 720 recent candles. Kraken publishes downloadable OHLCVT CSV archives covering each pair from its first trade through the archive cutoff, plus quarterly updates. Use those files for long-horizon research rather than treating the REST sample as a market-cycle backtest.

Official source: https://support.kraken.com/articles/360047124832-downloadable-historical-ohlcvt-open-high-low-close-volume-trades-data

## Import

Download/extract the Kraken archive outside this repository (the complete archive is multi-part and several GB). Select the exact pair CSVs for the same interval, then run:

```bash
python historical_ohlcvt.py --interval 240 \
  --xbteur /path/to/XBTEUR_240.csv \
  --etheur /path/to/ETHEUR_240.csv \
  --soleur /path/to/SOLEUR_240.csv \
  --output data
```

The file names above are illustrative; pass the actual extracted CSV paths. CSVs have no header and columns are timestamp, open, high, low, close, volume, trades. The importer converts to the 7-column row format already consumed by the research scripts.

## Integrity rules

- Reject malformed rows, nonnumeric fields, nonpositive prices, negative volume/trade counts, invalid OHLC bounds, duplicate/out-of-order timestamps, and timestamps not aligned to the selected interval.
- Record SHA-256, row count, UTC coverage and detected gaps in `data/manifest.json`.
- Do not fill gaps with synthetic zero-volume candles. Kraken states that OHLCVT only includes intervals in which trades occurred; a gap may therefore mean no trades, not missing data.
- The importer is offline/read-only. It does not call the exchange, access credentials, submit orders, or change execution settings.

## Validation before backtesting

Run `python -m unittest discover -s tests -v`, then import all three markets from the same interval. Review manifest coverage and gaps. The existing portfolio backtests intersect timestamps across all pairs, so asynchronous market gaps reduce the common sample. Preserve the raw CSVs and manifest outside Git; do not commit multi-GB market data or API secrets.

## Remaining research gates

1. Import a verified archive snapshot and record its SHA-256 manifest.
2. Confirm common timestamp coverage and quantify gaps before running strategies.
3. Use chronological train/validation/test windows, with a final untouched holdout.
4. Include fees, slippage, and realistic execution assumptions.
5. No strategy is promoted based on this ingestion alone; no production deployment or live trading is authorized.
