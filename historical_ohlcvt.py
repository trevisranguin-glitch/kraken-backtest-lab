#!/usr/bin/env python3
"""Import official Kraken OHLCVT CSVs into the existing research data format.

Input rows: timestamp,open,high,low,close,volume,trades (no header).
No network calls, credentials, or trading capability. Missing intervals are
reported, never silently filled: Kraken omits intervals with no trades.
"""
import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

PAIRS = ("XBTEUR", "ETHEUR", "SOLEUR")
INTERVAL_MINUTES = (1, 5, 15, 60, 240, 720, 1440)


def inspect_csv(path, interval_minutes):
    path = Path(path)
    step = interval_minutes * 60
    rows = []
    previous = None
    gaps = []
    with path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        for line_number, raw in enumerate(reader, start=1):
            if not raw or all(not cell.strip() for cell in raw):
                continue
            if len(raw) != 7:
                raise ValueError(f"{path}:{line_number}: expected 7 columns, got {len(raw)}")
            try:
                ts = int(raw[0])
                o, h, low, close, volume = map(float, raw[1:6])
                trades = int(raw[6])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{path}:{line_number}: invalid numeric field") from exc
            if ts < 0 or ts % step:
                raise ValueError(f"{path}:{line_number}: timestamp not aligned to {interval_minutes}m")
            if previous is not None:
                if ts <= previous:
                    raise ValueError(f"{path}:{line_number}: duplicate or non-chronological timestamp")
                if ts - previous > step:
                    gaps.append({"after": previous, "before": ts, "missing_intervals": (ts - previous) // step - 1})
            if min(o, h, low, close) <= 0 or volume < 0 or trades < 0:
                raise ValueError(f"{path}:{line_number}: non-positive price or negative volume/trades")
            if h < max(o, close, low) or low > min(o, close, h):
                raise ValueError(f"{path}:{line_number}: inconsistent OHLC bounds")
            rows.append([ts, raw[1], raw[2], raw[3], raw[4], raw[5], trades])
            previous = ts
    if not rows:
        raise ValueError(f"{path}: no candles")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return rows, {
        "source_file": path.name,
        "sha256": digest,
        "interval_minutes": interval_minutes,
        "rows": len(rows),
        "first_utc": datetime.fromtimestamp(rows[0][0], timezone.utc).isoformat(),
        "last_utc": datetime.fromtimestamp(rows[-1][0], timezone.utc).isoformat(),
        "gap_count": len(gaps),
        "gaps": gaps[:100],
        "gaps_truncated": len(gaps) > 100,
        "gap_semantics": "Kraken OHLCVT omits intervals with no trades; gaps are reported, not zero-filled.",
    }


def import_files(inputs, interval_minutes=240, output=Path("data")):
    if interval_minutes not in INTERVAL_MINUTES:
        raise ValueError(f"unsupported interval: {interval_minutes}")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "source": "Kraken official downloadable OHLCVT CSV",
        "interval_minutes": interval_minutes,
        "mode": "READ_ONLY_RESEARCH",
        "executionEnabled": False,
        "markets": {},
    }
    for pair in PAIRS:
        if pair not in inputs:
            raise ValueError(f"missing input for {pair}")
        rows, metadata = inspect_csv(inputs[pair], interval_minutes)
        (output / f"{pair}.json").write_text(json.dumps(rows, separators=(",", ":")) + "\n", encoding="utf-8")
        manifest["markets"][pair] = metadata
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=int, default=240, choices=INTERVAL_MINUTES)
    parser.add_argument("--xbteur", required=True, type=Path)
    parser.add_argument("--etheur", required=True, type=Path)
    parser.add_argument("--soleur", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("data"))
    args = parser.parse_args()
    result = import_files({"XBTEUR": args.xbteur, "ETHEUR": args.etheur, "SOLEUR": args.soleur}, args.interval, args.output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
