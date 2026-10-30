# Historical Kraken OHLCVT archive ingestion

## Official source and archive coverage

Kraken publishes headerless CSV files for 1, 5, 15, 30, 60, 240, 720 and 1440-minute intervals. Rows are `timestamp,open,high,low,close,volume,trades`. Intervals with no trades are omitted, so gaps are not automatically data loss.

Official instructions and current links: https://support.kraken.com/articles/360047124832-downloadable-historical-ohlcvt-open-high-low-close-volume-trades-data

As of the official page last updated 12 October 2026, the full archive covers all pairs through 30 June 2026 and is split into five parts (~2 GB each). Kraken publishes quarterly incremental ZIPs; the Q3 2026 update is available. Do not assume the full archive alone includes Q3.

## Download and verify

Download all five full-history parts from the official page, then concatenate them in order. Kraken's published SHA-256 for the assembled full ZIP is:

`bc273e9027470b07d790a7fa4df9bb43f0dfc527c20c6ecae48402e123e7b1c7`

Example on macOS/Linux (run in a dedicated data directory; requires substantial free disk space):

```bash
for i in 00 01 02 03 04; do
  curl -fL -O "https://assets.kraken.com/marketing/institutions/Kraken_OHLCVT_Full.zip.part$i"
done
cat Kraken_OHLCVT_Full.zip.part* > Kraken_OHLCVT_Full.zip
echo "bc273e9027470b07d790a7fa4df9bb43f0dfc527c20c6ecae48402e123e7b1c7  Kraken_OHLCVT_Full.zip" | sha256sum -c -
unzip -l Kraken_OHLCVT_Full.zip | grep -E '(^|/)(XBTEUR|ETHEUR|SOLEUR)_240.csv$'
```

Also download and extract the official Q3 2026 incremental archive:
`https://assets.kraken.com/marketing/institutions/Kraken_OHLCVT_2026Q3.zip`

Keep the full archive and quarterly update separate. Before appending quarterly rows, compare timestamps and deduplicate only byte-identical records; conflicting duplicates must stop the pipeline for investigation. The importer below intentionally does not merge quarterly archives automatically.

## Import

Extract the three 240-minute CSVs to a local directory and run:

```bash
python historical_ohlcvt.py --interval 240 \
  --xbteur /path/to/XBTEUR_240.csv \
  --etheur /path/to/ETHEUR_240.csv \
  --soleur /path/to/SOLEUR_240.csv \
  --output data
```

Use the actual filenames shown by `unzip -l`; paths above are illustrative. The importer converts data into the seven-column row format consumed by the existing research scripts.

## Integrity rules

- Reject malformed rows, nonnumeric fields, nonpositive prices, negative volume/trade counts, invalid OHLC bounds, duplicate/out-of-order timestamps, and timestamps not aligned to the selected interval.
- Record SHA-256, row count, UTC coverage and detected gaps in `data/manifest.json`.
- Never fill missing intervals with synthetic zero-volume candles.
- The importer is offline/read-only: no exchange calls, credentials, order endpoints, or execution settings.

## Validation before backtesting

Run `python -m unittest discover -s tests -v`, then import all three markets from the same interval. Review coverage and gaps in the manifest. Existing portfolio backtests intersect timestamps across all pairs, so asynchronous gaps reduce the common sample. Preserve raw archives and manifests outside Git; never commit multi-GB market data or API secrets.

## Research gates

1. Verify full ZIP checksum and preserve the archive manifest.
2. Apply quarterly updates with explicit duplicate/conflict checks.
3. Confirm common timestamp coverage and gap semantics.
4. Use chronological train/validation/test windows and an untouched final holdout.
5. Include fees, slippage and realistic execution assumptions.
6. No strategy promotion, Worker deployment or live trading based on ingestion alone.
