import {writeFile} from "node:fs/promises";
import {fetchClosedOHLC} from "./kraken-data.mjs";
import {validateEntryCandidatesWalkForward} from "./entry-signal-competition.mjs";
const pairs=["XBTEUR","ETHEUR","SOLEUR"],intervals=[60,240,1440];
const report={generatedAt:new Date().toISOString(),mode:"read-only-independent-entry-walk-forward",executionEnabled:false,ordersSupported:false,methodology:{candidates:["trend_momentum_confirmed","ema20_50_pullback","volatility_filtered_breakout"],exit:"common close below EMA20 or EMA20 below EMA50; next-open execution",folds:4,warmupBars:220,costsBpsPerSide:[33,50,75],benchmark:"same-window buy-and-hold with identical costs",parameterOptimization:false,limitation:"Kraken public OHLC endpoint supplies at most 720 recent candles; this is sample-limited and not proof of profitability."},markets:[]};
for(const pair of pairs)for(const interval of intervals){try{const m=await fetchClosedOHLC({pair,interval});if(m.bars.length<340)throw new Error("Insufficient closed candles: "+m.bars.length);const validation=validateEntryCandidatesWalkForward(m.bars);report.markets.push({pair,intervalMinutes:interval,bars:m.bars.length,firstCandle:new Date(m.bars[0].t).toISOString(),lastCandle:new Date(m.bars.at(-1).t).toISOString(),validation});}catch(e){report.markets.push({pair,intervalMinutes:interval,error:String(e?.message||e)});}await new Promise(r=>setTimeout(r,1500));}
await writeFile("entry-signal-competition-report.json",JSON.stringify(report,null,2));
const ok=report.markets.filter(x=>x.validation),robust=ok.flatMap(m=>m.validation.summary.filter(x=>x.robust).map(x=>({pair:m.pair,intervalMinutes:m.intervalMinutes,...x})));
console.log(JSON.stringify({generatedAt:report.generatedAt,successfulMarkets:ok.length,failedMarkets:report.markets.length-ok.length,comparisons:ok.reduce((n,m)=>n+m.validation.windows.length,0),robustCandidates:robust,errors:report.markets.filter(x=>x.error)},null,2));
if(!ok.length)process.exitCode=1;
