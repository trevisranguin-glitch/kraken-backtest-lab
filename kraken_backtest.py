#!/usr/bin/env python3
"""Research-only SMA20/50 4h, next-bar open fills; not a production execution replica."""
import json
from pathlib import Path

PAIRS = ("XBTEUR", "ETHEUR", "SOLEUR")
FEE = 0.008
SLIPPAGE = 0.001
START_EUR = 1000.0
MAX_ASSET_WEIGHT = 0.10
MAX_CRYPTO_WEIGHT = 0.25
MIN_TRADE_EUR = 20.0
MIN_DRIFT_EUR = 35.0
COOLDOWN_BARS = 6  # 24h at 4h interval

def run(directory=Path("data")):
    candles = {pair: json.loads((Path(directory) / f"{pair}.json").read_text()) for pair in PAIRS}
    common = sorted(set.intersection(*(set(int(row[0]) for row in candles[p]) for p in PAIRS)))
    if len(common) < 210:
        raise ValueError("Need >=210 aligned closed candles")
    aligned = {p: {int(row[0]): row for row in candles[p]} for p in PAIRS}
    cash = START_EUR
    units = {p: 0.0 for p in PAIRS}
    last_trade = {p: -10**9 for p in PAIRS}
    trades = []
    equity_curve = []
    for i in range(50, len(common)-1):
        t = common[i]
        next_t = common[i+1]
        close = {p: float(aligned[p][t][4]) for p in PAIRS}
        equity = cash + sum(units[p] * close[p] for p in PAIRS)
        equity_curve.append(equity)
        desired = {}
        for p in PAIRS:
            history = [float(aligned[p][stamp][4]) for stamp in common[i-49:i+1]]
            sma20 = sum(history[-20:])/20
            sma50 = sum(history)/50
            desired[p] = MAX_ASSET_WEIGHT if close[p] > sma20 > sma50 else 0.0
        total_target = sum(desired.values())
        if total_target > MAX_CRYPTO_WEIGHT:
            desired = {p: w * MAX_CRYPTO_WEIGHT / total_target for p,w in desired.items()}
        # Sell first to free cash. Never sell more than holdings.
        for p in PAIRS:
            next_open = float(aligned[p][next_t][1])
            delta = desired[p]*equity - units[p]*close[p]
            if delta >= -max(MIN_TRADE_EUR, MIN_DRIFT_EUR) or i-last_trade[p]<COOLDOWN_BARS:
                continue
            quantity = min(units[p], -delta/(next_open*(1-SLIPPAGE)))
            if quantity <= 0: continue
            proceeds = quantity*next_open*(1-SLIPPAGE)*(1-FEE)
            units[p] -= quantity
            cash += proceeds
            last_trade[p] = i
            trades.append({"pair":p,"side":"SELL","time":next_t,"eur":round(proceeds,2)})
        for p in PAIRS:
            next_open = float(aligned[p][next_t][1])
            delta = desired[p]*equity - units[p]*close[p]
            if delta <= max(MIN_TRADE_EUR, MIN_DRIFT_EUR) or i-last_trade[p]<COOLDOWN_BARS:
                continue
            budget = min(delta, cash)
            if budget < MIN_TRADE_EUR: continue
            quantity = budget/(next_open*(1+SLIPPAGE)*(1+FEE))
            units[p] += quantity
            cash -= budget
            last_trade[p] = i
            trades.append({"pair":p,"side":"BUY","time":next_t,"eur":round(budget,2)})
    final_close = {p:float(aligned[p][common[-1]][4]) for p in PAIRS}
    final_equity = cash + sum(units[p]*final_close[p] for p in PAIRS)
    equity_curve.append(final_equity)
    peak = START_EUR
    max_drawdown = 0
    for value in equity_curve:
        peak=max(peak,value)
        max_drawdown=min(max_drawdown,value/peak-1)
    return {"mode":"RESEARCH_ONLY","executionEnabled":False,"strategy":"SMA20_50_4h",
            "bars":len(common),"start_eur":START_EUR,"end_eur":round(final_equity,2),
            "return_pct":round(100*(final_equity/START_EUR-1),3),
            "max_drawdown_pct":round(100*max_drawdown,3),
            "fees_pct":FEE*100,"slippage_pct":SLIPPAGE*100,
            "trades":len(trades),"trade_log":trades,
            "limitations":"Approximate next-bar open fills; not production-exact. Short Kraken API history; no 12-month or walk-forward claim."}

if __name__=="__main__":
    print(json.dumps(run(),indent=2))
