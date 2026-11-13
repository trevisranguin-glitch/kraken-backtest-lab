#!/usr/bin/env python3
"""Safely merge Kraken OHLCVT CSV parts without inventing candles.

Each input is a headerless CSV with seven columns:
timestamp,open,high,low,close,volume,trades.
Rows are merged chronologically. Duplicate timestamps are accepted only when
all seven original field values match exactly. Conflicts abort the operation.
This tool is offline and has no exchange, credential, or trading capability.
"""
import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

INTERVAL_MINUTES = (1, 5, 15, 30, 60, 240, 720, 1440)


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_rows(path, interval_minutes):
    path = Path(path)
    step = interval_minutes * 60
    rows = []
    with path.open("r", newline="", encoding="utf-8") as handle:
        for line_number, raw in enumerate(csv.reader(handle), start=1):
            if not raw or all(not cell.strip() for cell in raw):
                continue
            if len(raw) != 7:
                raise ValueError(f"{path}:{line_number}: expected 7 columns, got {len(raw)}")
            try:
                timestamp = int(raw[0])
                open_, high, low, close, volume = map(float, raw[1:6])
                trades = int(raw[6])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{path}:{line_number}: invalid numeric field") from exc
            if timestamp < 0 or timestamp % step:
                raise ValueError(f"{path}:{line_number}: timestamp not aligned to {interval_minutes}m")
            if min(open_, high, low, close) <= 0 or volume < 0 or trades < 0:
                raise ValueError(f"{path}:{line_number}: non-positive price or negative volume/trades")
            if high < max(open_, close, low) or low > min(open_, close, high):
                raise ValueError(f"{path}:{line_number}: inconsistent OHLC bounds")
            rows.append((timestamp, tuple(raw)))
    if not rows:
        raise ValueError(f"{path}: no candles")
    return rows


def merge_csv_files(inputs, interval_minutes, output_csv, manifest_path=None):
    if interval_minutes not in INTERVAL_MINUTES:
        raise ValueError(f"unsupported interval: {interval_minutes}")
    if not inputs:
        raise ValueError("at least one input file is required")

    merged = {}
    input_metadata = []
    input_rows = 0
    duplicate_rows = 0
    for source in inputs:
        path = Path(source)
        rows = read_rows(path, interval_minutes)
        input_rows += len(rows)
        input_metadata.append({
            "source_file": path.name,
            "sha256": sha256_file(path),
            "rows": len(rows),
            "first_timestamp": rows[0][0],
            "last_timestamp": rows[-1][0],
        })
        for timestamp, raw in rows:
            existing = merged.get(timestamp)
            if existing is None:
                merged[timestamp] = raw
            elif existing == raw:
                duplicate_rows += 1
            else:
                raise ValueError(
                    f"conflicting duplicate timestamp {timestamp}: "
                    f"existing={existing!r}, incoming={raw!r} from {path}"
                )

    ordered = [merged[key] for key in sorted(merged)]
    step = interval_minutes * 60
    gaps = []
    for previous, current in zip(sorted(merged), sorted(merged)[1:]):
        if current - previous > step:
            gaps.append({
                "after": previous,
                "before": current,
                "missing_intervals": (current - previous) // step - 1,
            })

    output_csv = Path(output_csv)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerows(ordered)

    manifest = {
        "source": "Kraken official OHLCVT CSV inputs",
        "mode": "READ_ONLY_RESEARCH",
        "executionEnabled": False,
        "interval_minutes": interval_minutes,
        "inputs": input_metadata,
        "input_rows_total": input_rows,
        "merged_rows": len(ordered),
        "identical_duplicate_rows_removed": duplicate_rows,
        "conflicting_duplicates": 0,
        "first_utc": datetime.fromtimestamp(ordered[0][0], timezone.utc).isoformat(),
        "last_utc": datetime.fromtimestamp(ordered[-1][0], timezone.utc).isoformat(),
        "gap_count": len(gaps),
        "gaps": gaps[:100],
        "gaps_truncated": len(gaps) > 100,
        "gap_semantics": "Kraken omits intervals with no trades; gaps are reported, never filled.",
        "output_file": output_csv.name,
        "output_sha256": sha256_file(output_csv),
    }
    if manifest_path:
        manifest_path = Path(manifest_path)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=int, required=True, choices=INTERVAL_MINUTES)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("inputs", nargs="+", type=Path, help="CSV parts in any order")
    args = parser.parse_args()
    result = merge_csv_files(args.inputs, args.interval, args.output, args.manifest)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
