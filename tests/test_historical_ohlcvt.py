import json
import tempfile
import unittest
from pathlib import Path
from historical_ohlcvt import inspect_csv, import_files


class HistoricalOHLCVTTests(unittest.TestCase):
    def write_csv(self, path, timestamps=(0, 14400)):
        path.write_text("".join(f"{t},100,105,95,101,12.5,7\n" for t in timestamps), encoding="utf-8")
        return path

    def test_valid_import_preserves_rows_and_reports_missing_intervals(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            inputs = {}
            for pair in ("XBTEUR", "ETHEUR", "SOLEUR"):
                inputs[pair] = self.write_csv(root / f"{pair}.csv", (0, 28800))
            manifest = import_files(inputs, 240, root / "out")
            self.assertFalse(manifest["executionEnabled"])
            self.assertEqual(manifest["markets"]["XBTEUR"]["gap_count"], 1)
            rows = json.loads((root / "out" / "XBTEUR.json").read_text())
            self.assertEqual(len(rows[0]), 7)
            self.assertEqual(rows[0][4], "101")

    def test_duplicate_timestamp_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_csv(Path(tmp) / "bad.csv", (0, 0))
            with self.assertRaisesRegex(ValueError, "duplicate"):
                inspect_csv(path, 240)

    def test_misaligned_timestamp_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_csv(Path(tmp) / "bad.csv", (1, 14401))
            with self.assertRaisesRegex(ValueError, "not aligned"):
                inspect_csv(path, 240)

    def test_bad_ohlc_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.csv"
            path.write_text("0,100,90,95,101,1,2\n")
            with self.assertRaisesRegex(ValueError, "inconsistent OHLC"):
                inspect_csv(path, 240)

    def test_30_minute_interval_supported(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_csv(Path(tmp) / "30m.csv", (0, 1800))
            rows, metadata = inspect_csv(path, 30)
            self.assertEqual(len(rows), 2)
            self.assertEqual(metadata["interval_minutes"], 30)

    def test_missing_market_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_csv(Path(tmp) / "one.csv")
            with self.assertRaisesRegex(ValueError, "missing input"):
                import_files({"XBTEUR": path}, 240, Path(tmp) / "out")


if __name__ == "__main__":
    unittest.main()
