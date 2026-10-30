import test from "node:test";
import assert from "node:assert/strict";
import { compareMeanReversionVariants, evaluateMeanReversionVariant } from "../adaptive/mean-reversion-study.mjs";

function syntheticBars(n=1000) {
  return Array.from({length:n},(_,i)=>{
    const c=100 + Math.sin(i/17)*5 + Math.sin(i/4)*1.2;
    const p=i?100 + Math.sin((i-1)/17)*5 + Math.sin((i-1)/4)*1.2:c;
    return {t:i*3600000,o:p,h:Math.max(p,c)*1.008,l:Math.min(p,c)*0.992,c,v:1000};
  });
}
test("mean-reversion study compares three independent entries and stays read-only",()=>{
  const out=compareMeanReversionVariants(syntheticBars());
  assert.equal(out.executionEnabled,false);
  assert.equal(out.ordersSupported,false);
  assert.equal(out.variants.length,3);
  for(const item of out.variants){
    assert.ok(Number.isInteger(item.signalCount));
    assert.ok(Number.isInteger(item.trades));
    assert.ok(Number.isFinite(item.returnPct));
    assert.ok(Number.isFinite(item.maxDrawdownPct));
    assert.equal(item.executionEnabled,false);
  }
});
test("mean-reversion study rejects invalid inputs",()=>{
  assert.throws(()=>evaluateMeanReversionVariant(syntheticBars(200),"classic_reclaim"),/260/);
  assert.throws(()=>evaluateMeanReversionVariant(syntheticBars(),"unknown"),/Unknown/);
});
