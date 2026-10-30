import test from "node:test";
import assert from "node:assert/strict";
import { validateExitPoliciesWalkForward } from "../adaptive/walk-forward-exit-validation.mjs";
import { evaluateExitPolicy } from "../adaptive/exit-policy-study.mjs";
import { COST_SCENARIOS } from "../adaptive/exit-policy-study.mjs";

function bars(n=720){
  return Array.from({length:n},(_,i)=>{
    const c=100+Math.sin(i/17)*5+Math.sin(i/4)*1.2;
    const p=i?100+Math.sin((i-1)/17)*5+Math.sin((i-1)/4)*1.2:c;
    return {t:i*3600000,o:p,h:Math.max(p,c)*1.008,l:Math.min(p,c)*.992,c,v:1000};
  });
}

test("walk-forward uses four disjoint test windows after warmup",()=>{
  const out=validateExitPoliciesWalkForward(bars());
  assert.equal(out.executionEnabled,false);
  assert.equal(out.ordersSupported,false);
  assert.equal(out.noParameterOptimization,true);
  assert.equal(out.windows.length,4*4*3);
  const indicator=out.windows.filter(x=>x.exitPolicy==="indicator"&&x.costScenario==="base_33bps");
  assert.equal(indicator.length,4);
  for(let i=1;i<indicator.length;i++) assert.equal(indicator[i].startIndex,indicator[i-1].endIndex+1);
  assert.equal(indicator[0].startIndex,220);
  assert.equal(indicator.at(-1).endIndex,719);
});

test("each fold compares to same-window buy-and-hold and exposes trade ledger",()=>{
  const out=validateExitPoliciesWalkForward(bars());
  for(const row of out.windows){
    assert.ok(Number.isFinite(row.returnPct));
    assert.ok(Number.isFinite(row.benchmarkReturnPct));
    assert.ok(Math.abs(row.excessVsBuyHoldPct-(row.returnPct-row.benchmarkReturnPct))<1e-10);
    assert.ok(Array.isArray(row.tradeLedger));
    for(const trade of row.tradeLedger){
      assert.ok(trade.entryIndex>=row.startIndex);
      assert.ok(trade.exitIndex<=row.endIndex);
    }
  }
  assert.equal(out.summary.length,12);
});

test("future bars cannot alter an earlier fold result",()=>{
  const full=bars();
  const first=evaluateExitPolicy(full,"trend_pullback","indicator",COST_SCENARIOS[0],{startIndex:220,endIndex:344});
  const truncated=evaluateExitPolicy(full.slice(0,345),"trend_pullback","indicator",COST_SCENARIOS[0],{startIndex:220,endIndex:344});
  assert.ok(Math.abs(first.returnPct-truncated.returnPct)<1e-10);
  assert.equal(first.tradeCount,truncated.tradeCount);
});

test("rejects insufficient history and invalid folds",()=>{
  assert.throws(()=>validateExitPoliciesWalkForward(bars(300)));
  assert.throws(()=>validateExitPoliciesWalkForward(bars(),{folds:1}));
});
