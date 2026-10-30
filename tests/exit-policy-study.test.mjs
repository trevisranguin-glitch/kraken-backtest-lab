import test from "node:test";
import assert from "node:assert/strict";
import { compareExitPolicies, evaluateExitPolicy, COST_SCENARIOS, EXIT_POLICIES } from "../adaptive/exit-policy-study.mjs";
function bars(n=900){return Array.from({length:n},(_,i)=>{const c=100+Math.sin(i/17)*5+Math.sin(i/4)*1.2;const p=i?100+Math.sin((i-1)/17)*5+Math.sin((i-1)/4)*1.2:c;return {t:i*3600000,o:p,h:Math.max(p,c)*1.008,l:Math.min(p,c)*.992,c,v:1000};});}
test("exit study evaluates all policy and cost combinations in read-only mode",()=>{const out=compareExitPolicies(bars(),"classic_reclaim");assert.equal(out.executionEnabled,false);assert.equal(out.rows.length,12);for(const x of out.rows){assert.equal(x.executionEnabled,false);assert.equal(x.ordersSupported,false);assert.ok(Number.isFinite(x.returnPct));assert.ok(Number.isFinite(x.maxDrawdownPct));assert.equal(x.costsBpsPerSide>=33,true);}});
test("cost stress cannot improve an identical policy result",()=>{const b=bars();const a=evaluateExitPolicy(b,"classic_reclaim","indicator",COST_SCENARIOS[0]);const z=evaluateExitPolicy(b,"classic_reclaim","indicator",COST_SCENARIOS[2]);assert.ok(z.finalEquity<=a.finalEquity+1e-12);});
test("invalid variant and short history are rejected",()=>{assert.throws(()=>evaluateExitPolicy(bars(200),"classic_reclaim","indicator"));assert.throws(()=>evaluateExitPolicy(bars(),"x","indicator"));});
