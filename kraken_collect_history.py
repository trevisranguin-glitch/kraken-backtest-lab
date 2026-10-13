#!/usr/bin/env python3
"""Read-only Kraken 4-hour candle collector. No credentials or trading endpoints."""
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PAIRS = ("XBTEUR", "ETHEUR", "SOLEUR")
INTERVAL = 240

def collect(directory=Path("data")):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for pair in PAIRS:
        url = f"https://api.kraken.com/0/public/OHLC?pair={pair}&interval={INTERVAL}"
        request = urllib.request.Request(url, headers={"User-Agent": "KRAKEN-paper-research/1.0"})
        with urllib.request.urlopen(request, timeout=35) as response:
            data = json.load(response)
        if data.get("error"):
            raise RuntimeError(f"{pair}: {data['error']}")
        key = next(k for k in data["result"] if k != "last")
        rows = data["result"][key][:-1]  # Exclude unfinished candle
        timestamps = [int(r[0]) for r in rows]
        if len(rows) < 210:
            raise ValueError(f"{pair}: only {len(rows)} completed candles")
        if any(b - a != 14400 for a, b in zip(timestamps, timestamps[1:])):
            raise ValueError(f"{pair}: non-contiguous 4h candles")
        if any(float(r[4]) <= 0 for r in rows):
            raise ValueError(f"{pair}: non-positive close")
        (directory / f"{pair}.json").write_text(json.dumps(rows))
        manifest[pair] = {
            "count": len(rows),
            "first": datetime.fromtimestamp(timestamps[0], timezone.utc).isoformat(),
            "last": datetime.fromtimestamp(timestamps[-1], timezone.utc).isoformat(),
        }
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest

if __name__ == "__main__":
    print(json.dumps(collect(), indent=2))
