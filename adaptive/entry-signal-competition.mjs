import { ema, rsi, atr } from "./strategy-engine.mjs";
import { simulateLongOnlyAccounting } from "./accounting-engine.mjs";

export const ENTRY_CANDIDATES = Object.freeze(["trend_momentum_confirmed","ema20_50_pullback","volatility_filtered_breakout"]);
export const ENTRY_COSTS = Object.freeze([
  {name:"base_33bps",feeBps:26,spreadBps:4,slippageBps:5},
  {name:"stress_50bps",feeBps:43,spreadBps:4,slippageBps:5},
  {name:"severe_75bps",feeBps:68,spreadBps:4,slippageBps:5}
]);
export const ENTRY_WARMUP_BARS = 220;

export function buildEntrySignals(bars, candidate) {
  if(!Array.isArray(bars)||bars.length<ENTRY_WARMUP_BARS+1) throw new Error("At least 221 OHLC bars are required");
  if(!ENTRY_CANDIDATES.includes(candidate)) throw new Error("Unknown entry candidate");
  for(const b of bars) if(![b.o,b.h,b.l,b.c].every(Number.isFinite)||b.o<=0||b.c<=0||b.h<b.l) throw new Error("Invalid OHLC bar");
  const close=bars.map(b=>b.c), e20=ema(close,20), e50=ema(close,50), e200=ema(close,200), strength=rsi(close,14), volatility=atr(bars,14);
  const buy=Array(bars.length).fill(false), sell=Array(bars.length).fill(false);
  for(let i=ENTRY_WARMUP_BARS;i<bars.length;i++){
    const p=i-1, prev=p-1;
    const valid=[e20[p],e50[p],e200[p],e20[prev],e50[prev],strength[p],strength[prev],volatility[p]].every(Number.isFinite);
    if(!valid) continue;
    const trend=e50[p]>e200[p] && e50[p]>e50[Math.max(0,p-5)];
    if(candidate==="trend_momentum_confirmed"){
      buy[i]=trend && e20[p]>e50[p] && close[prev]<=e20[prev] && close[p]>e20[p] && strength[p]>=50;
    }else if(candidate==="ema20_50_pullback"){
      buy[i]=trend && e20[p]>e50[p] && close[prev]<e20[prev] && close[p]>=e20[p] && strength[p]>=45 && strength[p]<=65;
    }else{
      const priorHigh=Math.max(...bars.slice(Math.max(0,p-20),p).map(b=>b.h));
      const atrPct=volatility[p]/close[p];
      buy[i]=trend && close[p]>priorHigh && atrPct>=0.002 && atrPct<=0.08;
    }
    // Common, pre-registered exit: close below EMA20, executed at next open.
    sell[i]=close[p]<e20[p] || e20[p]<e50[p];
  }
  return {buy,sell,mode:"read-only-entry-signal-research",executionEnabled:false,ordersSupported:false};
}

export function evaluateEntryCandidate(bars,candidate,costs,{startIndex=ENTRY_WARMUP_BARS,endIndex=bars?.length-1}={}){
  if(!Number.isInteger(startIndex)||startIndex<ENTRY_WARMUP_BARS||startIndex>=bars.length)throw new Error("Invalid startIndex");
  if(!Number.isInteger(endIndex)||endIndex<startIndex||endIndex>=bars.length)throw new Error("Invalid endIndex");
  const {buy,sell}=buildEntrySignals(bars,candidate);
  const result=simulateLongOnlyAccounting({bars,buySignals:buy,sellSignals:sell,startIndex,endIndex,...costs});
  const benchmarkBuy=Array(bars.length).fill(false),benchmarkSell=Array(bars.length).fill(false);
  benchmarkBuy[startIndex]=true;
  const benchmark=simulateLongOnlyAccounting({bars,buySignals:benchmarkBuy,sellSignals:benchmarkSell,startIndex,endIndex,...costs});
  return {...result,candidate,benchmarkReturnPct:benchmark.returnPct,excessVsBuyHoldPct:result.returnPct-benchmark.returnPct};
}

export function validateEntryCandidatesWalkForward(bars,{folds=4,warmupBars=ENTRY_WARMUP_BARS,costScenarios=ENTRY_COSTS}={}){
  if(!Array.isArray(bars)||bars.length<warmupBars+folds*30)throw new Error("Insufficient OHLC history");
  if(!Number.isInteger(folds)||folds<2)throw new Error("At least two folds are required");
  if(!Number.isInteger(warmupBars)||warmupBars<ENTRY_WARMUP_BARS)throw new Error("Warmup must be at least 220 bars");
  const size=Math.floor((bars.length-warmupBars)/folds),windows=[];
  for(let f=0;f<folds;f++){
    const startIndex=warmupBars+f*size,endIndex=f===folds-1?bars.length-1:warmupBars+(f+1)*size-1;
    for(const candidate of ENTRY_CANDIDATES)for(const costs of costScenarios){
      const r=evaluateEntryCandidate(bars,candidate,costs,{startIndex,endIndex});
      windows.push({fold:f+1,startIndex,endIndex,testBars:endIndex-startIndex+1,candidate,costScenario:costs.name,costsBpsPerSide:r.costsBpsPerSide,returnPct:r.returnPct,benchmarkReturnPct:r.benchmarkReturnPct,excessVsBuyHoldPct:r.excessVsBuyHoldPct,drawdownPct:r.maxDrawdownPct,trades:r.tradeCount,tradeLedger:r.trades});
    }
  }
  const summary=[];
  for(const candidate of ENTRY_CANDIDATES)for(const costs of costScenarios){
    const rows=windows.filter(x=>x.candidate===candidate&&x.costScenario===costs.name);
    const mean=k=>rows.reduce((s,x)=>s+x[k],0)/rows.length;
    const active=rows.filter(x=>x.trades>0),totalTrades=rows.reduce((s,x)=>s+x.trades,0);
    const positive=rows.filter(x=>x.returnPct>0).length,beat=rows.filter(x=>x.excessVsBuyHoldPct>0).length;
    const robust=positive>=Math.ceil(folds*.75)&&beat>=Math.ceil(folds*.75)&&active.length>=Math.ceil(folds*.75)&&mean("returnPct")>0&&mean("excessVsBuyHoldPct")>0&&totalTrades>=6;
    summary.push({candidate,costScenario:costs.name,folds,meanReturnPct:mean("returnPct"),meanExcessVsBuyHoldPct:mean("excessVsBuyHoldPct"),meanDrawdownPct:mean("drawdownPct"),positiveFolds:positive,benchmarkWinningFolds:beat,activeFolds:active.length,totalTrades,robust});
  }
  return {mode:"read-only-independent-entry-walk-forward",executionEnabled:false,ordersSupported:false,warmupBars,folds,benchmark:"same-window buy-and-hold with identical transaction costs",parameterOptimization:false,windows,summary};
}
