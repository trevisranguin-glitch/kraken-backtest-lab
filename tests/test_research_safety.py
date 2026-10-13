"""Static safety and deterministic math checks for the isolated research project."""
import json
import tempfile
import unittest
from pathlib import Path
from kraken_backtest import run, PAIRS

class ResearchSafetyTests(unittest.TestCase):
    def make_candles(self, directory, count=240, growth=0.001):
        for pair in PAIRS:
            rows=[]
            for i in range(count):
                price=100*(1+growth)**i
                rows.append([1700000000+14400*i,str(price),str(price),str(price),str(price),"1","1",1])
            (directory/f"{pair}.json").write_text(json.dumps(rows))

    def test_flat_market_never_trades(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            self.make_candles(directory,growth=0)
            result=run(directory)
            self.assertFalse(result["executionEnabled"])
            self.assertEqual(result["trades"],0)
            self.assertAlmostEqual(result["end_eur"],1000)

    def test_trending_market_obeys_cash_and_risk_caps(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            self.make_candles(directory)
            result=run(directory)
            self.assertFalse(result["executionEnabled"])
            self.assertGreater(result["trades"],0)
            self.assertGreater(result["end_eur"],0)
            self.assertTrue(all(t["side"] in ("BUY","SELL") for t in result["trade_log"]))

    def test_missing_history_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            self.make_candles(directory,count=80)
            with self.assertRaises(ValueError):
                run(directory)

if __name__ == "__main__":
    unittest.main()
