// Research runner intentionally remains separate from all Worker deployments.\nimport { writeFile } from "node:fs/promises";
import { fetchClosedOHLC } from "./kraken-data.mjs";
import { evaluateMeanReversionVariant } from "./mean-reversion-study.mjs";
import { DEFAULT_COSTS } from "./strategy-engine.mjs";

const pairs=["XBTEUR","ETHEUR","SOLEUR"], intervals=[60,240,1440];
const variants=["classic_reclaim","trend_pullback","range_reclaim"];
const folds=4,warmup=220;
const report={generatedAt:new Date().toISOString(),mode:"read-only-mean-reversion-walk-forward",executionEnabled:false,ordersSupported:false,costs:DEFAULT_COSTS,folds,warmupBars:warmup,results:[]};
for(const pair of pairs) for(const interval of intervals){
  try{
    const market=await fetchClosedOHLC({pair,interval});
    const bars=market.bars;
    if(bars.length<warmup+folds*30) throw new Error("Insufficient closed candles: "+bars.length);
    const foldSize=Math.floor((bars.length-warmup)/folds);
    const marketResult={pair,intervalMinutes:interval,bars:bars.length,firstCandle:new Date(bars[0].t).toISOString(),lastCandle:new Date(bars.at(-1).t).toISOString(),variants:{}};
    for(const variant of variants){
      const windows=[];
      for(let fold=0;fold<folds;fold++){
        const start=warmup+fold*foldSize,end=fold===folds-1?bars.length:warmup+(fold+1)*foldSize;
        const segment=bars.slice(start-warmup,end);
        windows.push({...evaluateMeanReversionVariant(segment,variant,DEFAULT_COSTS),window:fold+1,testBars:end-start});
      }
      const meanReturnPct=windows.reduce((s,x)=>s+x.returnPct,0)/folds;
      const meanExcessVsBuyHoldPct=windows.reduce((s,x)=>s+x.excessVsBuyHoldPct,0)/folds;
      const meanDrawdownPct=windows.reduce((s,x)=>s+x.maxDrawdownPct,0)/folds;
      const activeWindows=windows.filter(x=>x.trades>0).length;
      const robust=windows.filter(x=>x.returnPct>0).length>=3&&windows.filter(x=>x.excessVsBuyHoldPct>0).length>=3&&activeWindows>=3&&meanReturnPct>0&&meanExcessVsBuyHoldPct>0&&windows.reduce((s,x)=>s+x.trades,0)>=3;
      marketResult.variants[variant]={windows,meanReturnPct,meanExcessVsBuyHoldPct,meanDrawdownPct,activeWindows,totalTrades:windows.reduce((s,x)=>s+x.trades,0),robust};
    }
    report.results.push(marketResult);
  }catch(error){report.results.push({pair,intervalMinutes:interval,error:String(error?.message||error)});}
  await new Promise(resolve=>setTimeout(resolve,1300));
}
await writeFile("mean-reversion-research-report.json",JSON.stringify(report,null,2));
const ok=report.results.filter(x=>x.variants);
console.log(JSON.stringify({generatedAt:report.generatedAt,successfulMarkets:ok.length,failedMarkets:report.results.length-ok.length,aggregates:variants.map(v=>({variant:v,meanNetReturnPct:ok.length?ok.reduce((s,m)=>s+m.variants[v].meanReturnPct,0)/ok.length:null,meanExcessPct:ok.length?ok.reduce((s,m)=>s+m.variants[v].meanExcessVsBuyHoldPct,0)/ok.length:null,robustMarkets:ok.filter(m=>m.variants[v].robust).length,totalTrades:ok.reduce((s,m)=>s+m.variants[v].totalTrades,0)})),errors:report.results.filter(x=>x.error)},null,2));
if(!ok.length) process.exitCode=1;
