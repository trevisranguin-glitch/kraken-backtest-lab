"""Read-only strategy comparison using the same historical data and risk limits."""
import json
from pathlib import Path
from kraken_backtest import PAIRS, START_EUR, FEE, SLIPPAGE, MAX_ASSET_WEIGHT, MAX_CRYPTO_WEIGHT, MIN_TRADE_EUR, MIN_DRIFT_EUR, COOLDOWN_BARS

def evaluate(rows, method, first, end):
    cash=START_EUR
    holdings={p:0.0 for p in PAIRS}
    last={p:-10000 for p in PAIRS}
    trades=0
    values=[]
    for i in range(first,end-1):
        close={p:float(rows[p][i][4]) for p in PAIRS}
        equity=cash+sum(holdings[p]*close[p] for p in PAIRS)
        values.append(equity)
        target={}
        for p in PAIRS:
            h=[float(r[4]) for r in rows[p][i-199:i+1]]
            sma20=sum(h[-20:])/20
            sma50=sum(h[-50:])/50
            sma200=sum(h)/200
            active={"sma20_50":h[-1]>sma20>sma50,
                    "sma50_200":h[-1]>sma50>sma200,
                    "momentum20":h[-1]>h[-21],
                    "sma20_50_momentum":h[-1]>sma20>sma50 and h[-1]>h[-21]}[method]
            target[p]=MAX_ASSET_WEIGHT if active else 0
        total=sum(target.values())
        if total>MAX_CRYPTO_WEIGHT:
            target={p:w*MAX_CRYPTO_WEIGHT/total for p,w in target.items()}
        for side in ("SELL","BUY"):
            for p in PAIRS:
                price=float(rows[p][i+1][1])
                drift=target[p]*equity-holdings[p]*close[p]
                if i-last[p]<COOLDOWN_BARS:continue
                if side=="SELL" and drift<-max(MIN_TRADE_EUR,MIN_DRIFT_EUR):
                    qty=min(holdings[p],-drift/(price*(1-SLIPPAGE)))
                    if qty<=0:continue
                    holdings[p]-=qty
                    cash+=qty*price*(1-SLIPPAGE)*(1-FEE)
                elif side=="BUY" and drift>max(MIN_TRADE_EUR,MIN_DRIFT_EUR):
                    budget=min(cash,drift)
                    if budget<MIN_TRADE_EUR:continue
                    holdings[p]+=budget/(price*(1+SLIPPAGE)*(1+FEE))
                    cash-=budget
                else:continue
                trades+=1
                last[p]=i
        if cash<-1e-8:raise AssertionError("negative cash")
    final=cash+sum(holdings[p]*float(rows[p][end-1][4]) for p in PAIRS)
    values.append(final)
    peak=START_EUR
    dd=0.0
    for v in values:
        peak=max(peak,v)
        dd=min(dd,v/peak-1)
    return {"return_pct":round(100*(final/START_EUR-1),3),"end_eur":round(final,2),
            "max_drawdown_pct":round(dd*100,3),"trades":trades,"bars":end-first}

def run(directory=Path("data")):
    raw={p:json.loads((Path(directory)/f"{p}.json").read_text()) for p in PAIRS}
    indexed={p:{int(r[0]):r for r in raw[p]} for p in PAIRS}
    common=sorted(set.intersection(*(set(indexed[p]) for p in PAIRS)))
    if len(common)<300:raise ValueError("Need at least 300 aligned candles")
    rows={p:[indexed[p][t] for t in common] for p in PAIRS}
    split=200+int((len(common)-200)*0.65)
    strategies=("sma20_50","sma50_200","momentum20","sma20_50_momentum")
    results={s:{"train":evaluate(rows,s,200,split),
                "validation":evaluate(rows,s,split,len(common))} for s in strategies}
    # Passive reference: 25% equally allocated across three assets, 75% EUR,\n    # with entry and exit trading costs charged for a comparable closed period.\n    def passive(first,end):\n        allocation=START_EUR*MAX_CRYPTO_WEIGHT/len(PAIRS)\n        proceeds=0.0\n        for p in PAIRS:\n            entry=float(rows[p][first][1])*(1+SLIPPAGE)\n            exit_price=float(rows[p][end-1][4])*(1-SLIPPAGE)\n            qty=allocation/(entry*(1+FEE))\n            proceeds+=qty*exit_price*(1-FEE)\n        return round(100*((START_EUR*(1-MAX_CRYPTO_WEIGHT)+proceeds)/START_EUR-1),3)\n    benchmark={"train":passive(200,split),"validation":passive(split,len(common))}\n    return {"mode":"RESEARCH_ONLY","executionEnabled":False,\n            "passive_25pct_crypto_return_pct":benchmark,
            "aligned_bars":len(common),"train_bars":split-200,
            "validation_bars":len(common)-split,"strategies":results,
            "warning":"Short historical sample; validation starts flat with 200-bar warmup. Not production-equivalent."}

if __name__=="__main__":
    print(json.dumps(run(),indent=2))
