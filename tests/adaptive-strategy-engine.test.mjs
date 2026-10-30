import test from "node:test";
import assert from "node:assert/strict";
import { ema, rsi, simulate, walkForward, DEFAULT_COSTS } from "../adaptive/strategy-engine.mjs";

function fixture(n=700){
  return Array.from({length:n},(_,i)=>{
    const trend=100+i*0.045;
    const wave=Math.sin(i/9)*2.2+Math.sin(i/31)*1.4;
    const c=trend+wave, o=c+(Math.sin(i/4)*0.25);
    return {t:i*3600000,o,h:Math.max(o,c)+0.8,l:Math.min(o,c)-0.8,c,v:1000+Math.abs(Math.sin(i))*300};
  });
}
test("EMA and RSI return bounded, correctly sized series",()=>{
  const values=Array.from({length:50},(_,i)=>100+i);
  assert.equal(ema(values,10).length,50);
  assert.equal(ema(values,10)[8],null);
  const rs=rsi(values);
  assert.equal(rs.length,50);
  assert.ok(rs[49]<=100 && rs[49]>=0);
});
test("all three candidates produce finite cost-aware results",()=>{
  const bars=fixture();
  for(const name of ["adaptive-momentum","filtered-mean-reversion","volatility-breakout"]){
    const out=simulate(bars,name);
    assert.equal(out.strategy,name);
    assert.ok(Number.isFinite(out.returnPct));
    assert.ok(Number.isFinite(out.maxDrawdownPct));
    assert.ok(out.maxDrawdownPct>=0);
    assert.ok(out.costsBpsPerSide>0);
  }
});
test("walk-forward uses warmup only for indicators and evaluates separate test folds",()=>{
  const out=walkForward(fixture(),{folds:4,warmupBars:220});
  assert.equal(out.executionEnabled,false);
  assert.equal(out.ordersSupported,false);
  for(const name of Object.keys(out.results)){
    assert.equal(out.results[name].windows.length,4);
    assert.ok(out.results[name].windows.every(w=>w.testBars>=30));
    assert.ok(out.results[name].windows.every(w=>Number.isFinite(w.returnPct)));
  }
});
test("higher transaction costs cannot improve a fixed strategy's result",()=>{
  const bars=fixture();
  const cheap=simulate(bars,"adaptive-momentum",{feeBps:0,spreadBps:0,slippageBps:0});
  const costly=simulate(bars,"adaptive-momentum",{feeBps:40,spreadBps:20,slippageBps:20});
  assert.ok(costly.returnPct<=cheap.returnPct+1e-9);
});
test("insufficient history and invalid candles are rejected",()=>{
  assert.throws(()=>simulate(fixture(210),"adaptive-momentum"),/220/);
  const bad=fixture();bad[300].c=NaN;
  assert.throws(()=>simulate(bad,"adaptive-momentum"),/Invalid OHLC/);
});
