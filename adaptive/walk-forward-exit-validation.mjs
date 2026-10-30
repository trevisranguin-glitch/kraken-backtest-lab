import { COST_SCENARIOS, EXIT_POLICIES, evaluateExitPolicy } from "./exit-policy-study.mjs";
import { simulateLongOnlyAccounting } from "./accounting-engine.mjs";

export const VALIDATION_ENTRY = "trend_pullback";
export const DEFAULT_FOLDS = 4;
export const WARMUP_BARS = 220;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  const middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}

function buyAndHold(bars, startIndex, endIndex, costs) {
  const buySignals=Array(bars.length).fill(false);
  const sellSignals=Array(bars.length).fill(false);
  buySignals[startIndex]=true;
  const result=simulateLongOnlyAccounting({
    bars,buySignals,sellSignals,startIndex,endIndex,
    ...costs
  });
  return {
    returnPct:result.returnPct,
    finalEquity:result.finalEquity,
    trades:result.tradeCount,
    costsBpsPerSide:result.costsBpsPerSide
  };
}

export function validateExitPoliciesWalkForward(bars, {
  folds=DEFAULT_FOLDS,
  warmupBars=WARMUP_BARS,
  costScenarios=COST_SCENARIOS
}={}) {
  if(!Array.isArray(bars)||bars.length<warmupBars+folds*30) throw new Error("Insufficient OHLC history for independent walk-forward windows");
  if(!Number.isInteger(folds)||folds<2) throw new Error("At least two folds are required");
  if(!Number.isInteger(warmupBars)||warmupBars<220) throw new Error("warmupBars must be at least 220");
  const testBars=bars.length-warmupBars;
  const foldSize=Math.floor(testBars/folds);
  if(foldSize<30) throw new Error("Each validation fold must contain at least 30 bars");
  const windows=[];
  for(let fold=0;fold<folds;fold++){
    const startIndex=warmupBars+fold*foldSize;
    const endIndex=fold===folds-1?bars.length-1:warmupBars+(fold+1)*foldSize-1;
    const benchmarkByCost={};
    for(const costs of costScenarios){
      benchmarkByCost[costs.name]=buyAndHold(bars,startIndex,endIndex,costs);
    }
    for(const costs of costScenarios) for(const exitPolicy of EXIT_POLICIES){
      const result=evaluateExitPolicy(bars,VALIDATION_ENTRY,exitPolicy,costs,{startIndex,endIndex});
      const benchmark=benchmarkByCost[costs.name];
      windows.push({
        fold:fold+1,startIndex,endIndex,testBars:endIndex-startIndex+1,
        firstTestCandle:new Date(bars[startIndex].t).toISOString(),
        lastTestCandle:new Date(bars[endIndex].t).toISOString(),
        entryVariant:VALIDATION_ENTRY,exitPolicy,costScenario:costs.name,
        costsBpsPerSide:result.costsBpsPerSide,
        returnPct:result.returnPct,benchmarkReturnPct:benchmark.returnPct,
        excessVsBuyHoldPct:result.returnPct-benchmark.returnPct,
        drawdownPct:result.maxDrawdownPct,trades:result.tradeCount,
        winRatePct:result.tradeCount?result.trades.filter(t=>t.netPnl>0).length/result.tradeCount*100:0,
        finalEquity:result.finalEquity,tradeLedger:result.trades
      });
    }
  }
  const groups=new Map();
  for(const row of windows){
    const key=[row.exitPolicy,row.costScenario].join("|");
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  }
  const summary=[...groups.entries()].map(([key,rows])=>{
    const returns=rows.map(x=>x.returnPct), excess=rows.map(x=>x.excessVsBuyHoldPct), drawdowns=rows.map(x=>x.drawdownPct);
    const totalTrades=rows.reduce((s,x)=>s+x.trades,0);
    const positiveFolds=rows.filter(x=>x.returnPct>0).length;
    const benchmarkWinningFolds=rows.filter(x=>x.excessVsBuyHoldPct>0).length;
    const activeFolds=rows.filter(x=>x.trades>0).length;
    const meanReturnPct=returns.reduce((s,x)=>s+x,0)/rows.length;
    const meanExcessVsBuyHoldPct=excess.reduce((s,x)=>s+x,0)/rows.length;
    const meanDrawdownPct=drawdowns.reduce((s,x)=>s+x,0)/rows.length;
    return {
      exitPolicy:rows[0].exitPolicy,costScenario:rows[0].costScenario,
      costsBpsPerSide:rows[0].costsBpsPerSide,folds:rows.length,
      meanReturnPct,medianReturnPct:median(returns),
      meanExcessVsBuyHoldPct,medianExcessVsBuyHoldPct:median(excess),
      meanDrawdownPct,positiveFolds,benchmarkWinningFolds,activeFolds,totalTrades,
      // A candidate must beat same-window buy-and-hold in >=75% of folds,
      // be net-positive in >=75%, and be active in >=75% of folds.
      robust:positiveFolds>=Math.ceil(rows.length*.75)&&
        benchmarkWinningFolds>=Math.ceil(rows.length*.75)&&
        activeFolds>=Math.ceil(rows.length*.75)&&
        meanReturnPct>0&&meanExcessVsBuyHoldPct>0&&totalTrades>=6
    };
  });
  return {
    mode:"read-only-independent-walk-forward-validation",
    executionEnabled:false,ordersSupported:false,
    entryVariant:VALIDATION_ENTRY,folds,warmupBars,
    benchmark:"buy-and-hold over the identical test window with identical transaction-cost assumptions",
    noParameterOptimization:true,
    marketsBars:bars.length,windows,summary
  };
}
