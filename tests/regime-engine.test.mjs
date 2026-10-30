import test from "node:test";
import assert from "node:assert/strict";
import { detectMarketRegimes } from "../adaptive/regime-engine.mjs";

function bars(n=500,fn=(i)=>100+i*0.1){
  return Array.from({length:n},(_,i)=>{
    const c=fn(i),o=i?fn(i-1):c;
    return {t:i*3600000,o,h:Math.max(o,c)*1.004,l:Math.min(o,c)*0.996,c,v:100};
  });
}
test("regime classifier emits valid labels and explicit safety flags",()=>{
  const out=detectMarketRegimes(bars());
  assert.equal(out.executionEnabled,false);
  assert.equal(out.ordersSupported,false);
  assert.equal(out.regimes.length,500);
  const allowed=new Set(["WARMUP","HIGH_VOLATILITY","TREND_UP","TREND_DOWN","RANGE","TRANSITION"]);
  assert.ok(out.regimes.every(x=>allowed.has(x.regime)));
  assert.equal(out.regimes[199].regime,"WARMUP");
  assert.notEqual(out.regimes[250].regime,"WARMUP");
});
test("future candles cannot alter an already classified past regime",()=>{
  const source=bars(500,(i)=>100+i*.08+Math.sin(i/13));
  const a=detectMarketRegimes(source).regimes;
  const changed=source.map((b,i)=>i>350?{...b,c:b.c*4,o:b.o*4,h:b.h*4,l:b.l*4}:b);
  const b=detectMarketRegimes(changed).regimes;
  for(let i=200;i<=350;i++) assert.deepEqual(a[i],b[i]);
});
test("invalid OHLC input is rejected",()=>{
  const data=bars();data[300].h=NaN;
  assert.throws(()=>detectMarketRegimes(data),/Invalid OHLC/);
});
test("flat price history is classified as range after warmup",()=>{
  const out=detectMarketRegimes(bars(400,()=>100));
  assert.equal(out.regimes[399].regime,"RANGE");
});

test("persistent rising and falling trends receive directional labels",()=>{
  const up=detectMarketRegimes(bars(500,i=>100+i*0.2)).regimes;
  const down=detectMarketRegimes(bars(500,i=>200-i*0.2)).regimes;
  assert.equal(up.at(-1).regime,"TREND_UP");
  assert.equal(down.at(-1).regime,"TREND_DOWN");
});

test("a sudden volatility shock is classified using only prior volatility history",()=>{
  const data=bars(400,()=>100);
  data[399]={...data[399],o:100,h:130,l:70,c:100};
  const out=detectMarketRegimes(data).regimes;
  assert.equal(out[398].regime,"RANGE");
  assert.equal(out[399].regime,"HIGH_VOLATILITY");
});

test("invalid classifier parameters are rejected",()=>{
  assert.throws(()=>detectMarketRegimes(bars(),{efficiencyPeriod:0}),/efficiencyPeriod/);
  assert.throws(()=>detectMarketRegimes(bars(),{volatilityWindow:5}),/volatilityWindow/);
});
