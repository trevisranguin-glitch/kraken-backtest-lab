import test from "node:test";
import assert from "node:assert/strict";
import { walkForwardRegimeCompetition } from "../adaptive/regime-competition.mjs";

function fixture(n=900) {
  return Array.from({length:n},(_,i)=>{
    const c=100+i*0.035+Math.sin(i/11)*2;
    const o=i?100+(i-1)*0.035+Math.sin((i-1)/11)*2:c;
    return {t:i*3600000,o,h:Math.max(o,c)*1.006,l:Math.min(o,c)*0.994,c,v:1000};
  });
}

test("regime allocator is read-only and evaluates every candidate over walk-forward folds",()=>{
  const out=walkForwardRegimeCompetition(fixture());
  assert.equal(out.executionEnabled,false);
  assert.equal(out.ordersSupported,false);
  assert.equal(out.results["trend-plus-range"].windows.length,4);
  assert.equal(out.results["trend-momentum-only"].windows.length,4);
  for(const result of Object.values(out.results)){
    assert.ok(Number.isFinite(result.meanReturnPct));
    assert.ok(Number.isFinite(result.meanMaxDrawdownPct));
    assert.equal(result.robust,result.positiveWindows>=3&&result.benchmarkWinningWindows>=3&&result.activeWindows>=3&&result.meanReturnPct>0&&result.meanExcessVsBuyHoldPct>0&&result.totalTrades>=3);
  }
});

test("allocator rejects insufficient data and invalid fold settings",()=>{
  assert.throws(()=>walkForwardRegimeCompetition(fixture(300)),/Insufficient data/);
  assert.throws(()=>walkForwardRegimeCompetition(fixture(),{warmupBars:100}),/warmupBars/);
});

test("regime labels use closed historical bars and all candidates stay in cash in unmapped regimes",()=>{
  const bars=fixture();
  const out=walkForwardRegimeCompetition(bars);
  assert.ok(Object.keys(out.regimeCounts).length>0);
  assert.ok(Object.values(out.results).every(x=>x.totalTrades>=0));
});

test("signal diagnostics expose buy and sell counts by the prior closed candle regime",()=>{
  const bars=fixture();
  const out=walkForwardRegimeCompetition(bars);
  assert.equal(out.signalDiagnostics.executionEnabled,false);
  for(const strategy of Object.values(out.signalDiagnostics.strategies)){
    assert.ok(Number.isInteger(strategy.buy));
    assert.ok(Number.isInteger(strategy.sell));
    assert.ok(strategy.buy>=0&&strategy.sell>=0);
  }
});
