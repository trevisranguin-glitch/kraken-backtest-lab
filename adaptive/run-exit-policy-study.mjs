import { writeFile } from "node:fs/promises";
import { fetchClosedOHLC } from "./kraken-data.mjs";
import { compareExitPolicies, ENTRY_VARIANTS } from "./exit-policy-study.mjs";
const pairs=["XBTEUR","ETHEUR","SOLEUR"],intervals=[60,240,1440];
const report={generatedAt:new Date().toISOString(),mode:"read-only-exit-policy-walk-forward-extension",executionEnabled:false,ordersSupported:false,markets:[]};
for(const pair of pairs)for(const interval of intervals){
 try{
  const market=await fetchClosedOHLC({pair,interval});
  if(market.bars.length<260)throw new Error("Insufficient closed candles: "+market.bars.length);
  const item={pair,intervalMinutes:interval,bars:market.bars.length,firstCandle:new Date(market.bars[0].t).toISOString(),lastCandle:new Date(market.bars.at(-1).t).toISOString(),entries:{}};
  for(const entry of ENTRY_VARIANTS)item.entries[entry]=compareExitPolicies(market.bars,entry).rows.map(x=>({exitPolicy:x.exitPolicy,costsBpsPerSide:x.costsBpsPerSide,returnPct:x.returnPct,drawdownPct:x.maxDrawdownPct,trades:x.tradeCount,winRatePct:x.trades.length?x.trades.filter(t=>t.netPnl>0).length/x.trades.length*100:0,finalEquity:x.finalEquity,tradeLedger:x.trades}));
  report.markets.push(item);
 }catch(e){report.markets.push({pair,intervalMinutes:interval,error:String(e?.message||e)});}
 await new Promise(r=>setTimeout(r,1300));
}
await writeFile("exit-policy-research-report.json",JSON.stringify(report,null,2));
const ok=report.markets.filter(x=>x.entries);
console.log(JSON.stringify({generatedAt:report.generatedAt,successfulMarkets:ok.length,failedMarkets:report.markets.length-ok.length,rows:ok.reduce((n,m)=>n+Object.values(m.entries).reduce((s,a)=>s+a.length,0),0),errors:report.markets.filter(x=>x.error)},null,2));
if(!ok.length)process.exitCode=1;
