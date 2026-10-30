import { writeFile } from "node:fs/promises";
import { fetchClosedOHLC } from "./kraken-data.mjs";
import { validateExitPoliciesWalkForward } from "./walk-forward-exit-validation.mjs";

const pairs=["XBTEUR","ETHEUR","SOLEUR"],intervals=[60,240,1440];
const report={
  generatedAt:new Date().toISOString(),
  mode:"read-only-independent-walk-forward-validation",
  executionEnabled:false,ordersSupported:false,
  methodology:{
    entryVariant:"trend_pullback (pre-registered from prior screening; not re-optimized)",
    exitPolicies:["indicator","atr_close_2x","time_24","time_48"],
    folds:4,warmupBars:220,
    benchmark:"same-window buy-and-hold, same transaction costs",
    costsBpsPerSide:[33,50,75],
    testWindowsDisjoint:true,noParameterOptimization:true,
    limitation:"Kraken public OHLC endpoint supplies at most 720 recent candles; results remain sample-limited."
  },
  markets:[]
};
for(const pair of pairs)for(const interval of intervals){
  try{
    const market=await fetchClosedOHLC({pair,interval});
    if(market.bars.length<340)throw new Error("Insufficient closed candles: "+market.bars.length);
    const validation=validateExitPoliciesWalkForward(market.bars);
    report.markets.push({
      pair,intervalMinutes:interval,bars:market.bars.length,
      firstCandle:new Date(market.bars[0].t).toISOString(),
      lastCandle:new Date(market.bars.at(-1).t).toISOString(),
      validation
    });
  }catch(error){
    report.markets.push({pair,intervalMinutes:interval,error:String(error?.message||error)});
  }
  await new Promise(resolve=>setTimeout(resolve,1500));
}
await writeFile("walk-forward-exit-validation-report.json",JSON.stringify(report,null,2));
const successful=report.markets.filter(x=>x.validation);
console.log(JSON.stringify({
  generatedAt:report.generatedAt,successfulMarkets:successful.length,
  failedMarkets:report.markets.length-successful.length,
  foldRows:successful.reduce((n,m)=>n+m.validation.windows.length,0),
  robustCandidates:successful.flatMap(m=>m.validation.summary.filter(x=>x.robust).map(x=>({pair:m.pair,intervalMinutes:m.intervalMinutes,...x}))),
  errors:report.markets.filter(x=>x.error)
},null,2));
if(!successful.length)process.exitCode=1;
