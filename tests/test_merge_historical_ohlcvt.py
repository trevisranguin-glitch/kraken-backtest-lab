import csv
import json
import tempfile
import unittest
from pathlib import Path

from merge_historical_ohlcvt import merge_csv_files


class MergeHistoricalOHLCVTTests(unittest.TestCase):
    def write(self, path, rows):
        with Path(path).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            writer.writerows(rows)
        return Path(path)

    def row(self, timestamp, close="101"):
        return [timestamp, "100", "105", "95", close, "12.5", "7"]

    def test_merges_multiple_parts_chronologically_and_reports_identical_overlap(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            later = self.write(root / "q3.csv", [self.row(28800), self.row(43200)])
            earlier = self.write(root / "full.csv", [self.row(0), self.row(28800)])
            output, manifest = root / "merged.csv", root / "manifest.json"
            result = merge_csv_files([later, earlier], 240, output, manifest)
            rows = list(csv.reader(output.open()))
            self.assertEqual([int(row[0]) for row in rows], [0, 28800, 43200])
            self.assertEqual(result["input_rows_total"], 4)
            self.assertEqual(result["merged_rows"], 3)
            self.assertEqual(result["identical_duplicate_rows_removed"], 1)
            self.assertEqual(result["gap_count"], 0)
            self.assertFalse(result["executionEnabled"])
            self.assertEqual(json.loads(manifest.read_text())["output_sha256"], result["output_sha256"])

    def test_conflicting_duplicate_aborts_without_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            a = self.write(root / "a.csv", [self.row(0)])
            b = self.write(root / "b.csv", [self.row(0, "102")])
            output = root / "merged.csv"
            with self.assertRaisesRegex(ValueError, "conflicting duplicate"):
                merge_csv_files([a, b], 240, output)
            self.assertFalse(output.exists())

    def test_invalid_ohlc_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bad = self.write(root / "bad.csv", [[0, "100", "90", "95", "101", "1", "2"]])
            with self.assertRaisesRegex(ValueError, "inconsistent OHLC"):
                merge_csv_files([bad], 240, root / "out.csv")

    def test_misaligned_timestamp_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bad = self.write(root / "bad.csv", [self.row(1)])
            with self.assertRaisesRegex(ValueError, "not aligned"):
                merge_csv_files([bad], 240, root / "out.csv")

    def test_reports_gaps_without_synthetic_fill(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self.write(root / "source.csv", [self.row(0), self.row(28800)])
            result = merge_csv_files([source], 240, root / "out.csv")
            self.assertEqual(result["merged_rows"], 2)
            self.assertEqual(result["gap_count"], 1)
            self.assertEqual(result["gaps"][0]["missing_intervals"], 1)

    def test_empty_input_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            empty = root / "empty.csv"
            empty.write_text("")
            with self.assertRaisesRegex(ValueError, "no candles"):
                merge_csv_files([empty], 240, root / "out.csv")


if __name__ == "__main__":
    unittest.main()
